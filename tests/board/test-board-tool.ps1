# tests/board/test-board-tool.ps1
# 不需要硬件：验证 scripts/verify-board.ps1 的编码/解码/CRC、反例构造、报告落盘和退出码。
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$tool = Join-Path $root 'scripts\verify-board.ps1'
$failures = New-Object System.Collections.Generic.List[string]

# ---- 1) 脚本自检（-SelfTest）必须通过
& powershell -ExecutionPolicy Bypass -File $tool -SelfTest | Out-Null
if ($LASTEXITCODE -ne 0) { $failures.Add('-SelfTest 退出码不是 0') }

# ---- 2) 把工具的函数加载进本进程（去掉 param 块和入口 switch），用虚拟板跑完整流程
$src = Get-Content -LiteralPath $tool -Raw
$start = $src.IndexOf('$ErrorActionPreference')
$end = $src.LastIndexOf('switch ($PSCmdlet.ParameterSetName)')
if ($start -lt 0 -or $end -lt 0) { throw 'verify-board.ps1 结构变化，测试需要更新' }
$libPath = Join-Path $PSScriptRoot '_tmp-boardlib.ps1'
Set-Content -LiteralPath $libPath -Value $src.Substring($start, $end - $start) -Encoding UTF8
. $libPath
# lib 里的 $root 是按 scripts\ 目录算的，这里在 tests\board\ 下要改回仓库根目录
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

# 虚拟板：实现 compact_protocol.c 的行为
$script:boardRole = 1
$script:boardRx = New-Object System.Collections.Generic.List[byte]
$script:boardTx = New-Object System.Collections.Generic.List[byte]
$script:boardDrop = $false

function Reset-VirtualBoard {
    param([int]$RoleId = 1, [switch]$Drop)
    $script:boardRole = $RoleId
    $script:boardRx.Clear()
    $script:boardTx.Clear()
    $script:boardDrop = [bool]$Drop
}

function Invoke-CompactHandle {
    param([byte[]]$Frame, [int]$RoleId)
    if ($Frame[0] -ne 0xA5 -or $Frame[1] -ne 0x5A) { return $null }
    if ($Frame[2] -ne 1 -or $Frame[3] -ne 1) { return $null }
    if ($Frame[5] -ne $RoleId -and $Frame[5] -ne 0xFF) { return $null }
    if ($Frame[12] -gt 8 -or $Frame[13] -ne 0) { return $null }
    $expected = [int]$Frame[22] -bor ([int]$Frame[23] -shl 8)
    if ((Get-Crc16 ([byte[]]($Frame[2..21]))) -ne $expected) { return $null }
    $out = [byte[]]($Frame.Clone())
    $requester = $out[4]
    $out[4] = [byte]$RoleId
    $out[5] = $requester
    $out[12] = 8
    $out[13] = 1
    $out[14] = 0
    $out[15] = [byte]$RoleId
    $out[16] = 0xE1
    $out[17] = 1
    $out[18] = 0
    $out[19] = 1
    $out[20] = 0
    $out[21] = 1
    $out = Set-FrameCrc $out
    return , $out
}

function Receive-Byte {
    param([byte]$Value)
    if ($script:boardRx.Count -eq 0) {
        if ($Value -ne 0xA5) { return }
    } elseif ($script:boardRx.Count -eq 1 -and $Value -ne 0x5A) {
        $script:boardRx.Clear()
        if ($Value -eq 0xA5) { $script:boardRx.Add($Value) }
        return
    }
    $script:boardRx.Add($Value)
    if ($script:boardRx.Count -eq 24) {
        $frame = $script:boardRx.ToArray()
        $script:boardRx.Clear()
        if ($script:boardDrop) { return }
        $resp = Invoke-CompactHandle -Frame $frame -RoleId $script:boardRole
        if ($resp) { foreach ($b in $resp) { $script:boardTx.Add($b) } }
    }
}

function Open-SerialPort {
    param($Name, $Rate)
    $mock = [pscustomobject]@{ Name = $Name; IsOpen = $true }
    $mock | Add-Member -MemberType ScriptMethod -Name Close -Value { }
    $mock | Add-Member -MemberType ScriptMethod -Name Dispose -Value { }
    return $mock
}
function Send-Frame { param($Serial, [byte[]]$Bytes) foreach ($b in $Bytes) { Receive-Byte -Value $b } }
function Read-SerialBytes {
    param($Serial, [int]$TimeoutMs, [int]$Want = 24)
    if ($script:boardTx.Count -eq 0) { return , ([byte[]]@()) }
    $out = $script:boardTx.ToArray()
    $script:boardTx.Clear()
    return , $out
}

# ---- 2a) 正常板：应 PASS 并写出记录
$Port = 'COM_TEST'
$Role = 'CTRL'
$Baud = 2400
$Challenges = 5
$TimeoutMs = 200
$OutDir = 'tests\_tmp-records'
$Operator = 'selftest'
$SkipNegative = $false
Reset-VirtualBoard -RoleId 1
Invoke-Check | Out-Null
if (-not $script:VerifyBoardVerdict) { $failures.Add('正常虚拟板未被判定 PASS') }
$jsonFile = Get-ChildItem -LiteralPath (Join-Path $root $OutDir) -Filter '*COM_TEST.json' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $jsonFile) { $failures.Add('没有生成 JSON 记录') }
else {
    $rec = Get-Content -LiteralPath $jsonFile.FullName -Raw | ConvertFrom-Json
    if ($rec.verdict -ne 'PASS') { $failures.Add("记录 verdict 不是 PASS: $($rec.verdict)") }
    if ($rec.challengePass -ne 5) { $failures.Add("challengePass 应为 5，实际 $($rec.challengePass)") }
    if ($rec.negativePass -ne $rec.negativeTotal) { $failures.Add('反例未全部符合预期') }
    if (-not $rec.firmwareSha256) { $failures.Add('记录缺少固件 SHA-256') }
}

# ---- 2b) 角色不匹配的板（烧错固件）：应 FAIL
$Role = 'DUT'
Reset-VirtualBoard -RoleId 3
Invoke-Check | Out-Null
if ($script:VerifyBoardVerdict) { $failures.Add('烧错角色的虚拟板被错误判定 PASS') }

# ---- 2c) 完全无响应的板：应 FAIL 且提前中止
$Role = 'REF'
Reset-VirtualBoard -RoleId 3 -Drop
Invoke-Check | Out-Null
if ($script:VerifyBoardVerdict) { $failures.Add('无响应虚拟板被错误判定 PASS') }

# ---- 3) 清理
Remove-Item -LiteralPath $libPath -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath (Join-Path $root $OutDir) -Recurse -Force -ErrorAction SilentlyContinue

if ($failures.Count -eq 0) {
    Write-Output 'Board tool tests passed: 自检 + 虚拟板 PASS/FAIL 路径 + 记录落盘。'
    exit 0
}
foreach ($f in $failures) { Write-Output ("Board tool test FAILED: {0}" -f $f) }
exit 1
