<#
.SYNOPSIS
  PC 端下板验证工具：用真实串口验证 Compact 固件的 UART1 + 24 字节协议 + 角色 HELLO。

.DESCRIPTION
  只做一件事：把协议文档里的黄金 HELLO 帧按指定角色发到真实串口，逐字节校验板子回帧。
  它不会替代完整验收，也不判断红外/RS485/RTC/EEPROM/传感器。

  支持三种用法：
    -ListPorts                     列出本机串口（找 CH340 用）
    -SelfTest                      离线自检：不接板子，校验编码/解码/CRC 与黄金向量一致
    -Port COM5 -Role CTRL         接板验证（单板）

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\verify-board.ps1 -ListPorts
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\verify-board.ps1 -SelfTest
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\verify-board.ps1 -Port COM5 -Role CTRL
#>
[CmdletBinding(DefaultParameterSetName = 'Check')]
param(
    [Parameter(ParameterSetName = 'Check', Mandatory = $true, Position = 0)]
    [string]$Port,

    [Parameter(ParameterSetName = 'Check', Mandatory = $true, Position = 1)]
    [ValidateSet('CTRL', 'DUT', 'REF')]
    [string]$Role,

    [Parameter(ParameterSetName = 'Check')]
    [int]$Baud = 2400,

    [Parameter(ParameterSetName = 'Check')]
    [int]$Challenges = 100,

    [Parameter(ParameterSetName = 'Check')]
    [int]$TimeoutMs = 1500,

    [Parameter(ParameterSetName = 'Check')]
    [string]$OutDir = 'records',

    [Parameter(ParameterSetName = 'Check')]
    [string]$Operator = '',

    [Parameter(ParameterSetName = 'Check')]
    [switch]$SkipNegative,

    [Parameter(ParameterSetName = 'ListPorts', Mandatory = $true)]
    [switch]$ListPorts,

    [Parameter(ParameterSetName = 'SelfTest', Mandatory = $true)]
    [switch]$SelfTest
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$ROLE_ID = @{ CTRL = 1; DUT = 2; REF = 3 }
# 每个角色有两个可能的烧录文件；记录时优先取“完整版”，不存在则退回 Compact 版。
$ROLE_HEX = @{
    CTRL = @('firmware\ctrl\output\AcceptanceCtrl.hex', 'firmware\compact\ctrl\output\AcceptanceCtrlCompact.hex')
    DUT  = @('firmware\dut\output\AcceptanceDut.hex',   'firmware\compact\dut\output\AcceptanceDutCompact.hex')
    REF  = @('firmware\ref\output\AcceptanceRef.hex',   'firmware\compact\ref\output\AcceptanceRefCompact.hex')
}
$NODE_PC = 0
$MSG_HELLO = 0x01
$PROTO_VERSION = 1
$COMPACT_PROFILE = 0xE1

function Get-Crc16 {
    param([byte[]]$Bytes)
    $crc = 0xFFFF
    foreach ($b in $Bytes) {
        $crc = $crc -bxor $b
        for ($bit = 0; $bit -lt 8; $bit++) {
            if ($crc -band 1) { $crc = ($crc -shr 1) -bxor 0xA001 }
            else { $crc = $crc -shr 1 }
        }
    }
    return ($crc -band 0xFFFF)
}

function New-HelloFrame {
    param([int]$RoleId, [int]$Seq)
    $f = New-Object byte[] 24
    $f[0] = 0xA5
    $f[1] = 0x5A
    $f[2] = $PROTO_VERSION
    $f[3] = $MSG_HELLO
    $f[4] = $NODE_PC
    $f[5] = [byte]$RoleId
    $f[6] = 0; $f[7] = 0
    $f[8] = [byte]($Seq -band 0xFF)
    $f[9] = [byte](($Seq -shr 8) -band 0xFF)
    $f[10] = 0; $f[11] = 0
    $f[12] = 1
    $f[13] = 0
    $f[14] = 0
    $crc = Get-Crc16 ([byte[]]($f[2..21]))
    $f[22] = [byte]($crc -band 0xFF)
    $f[23] = [byte](($crc -shr 8) -band 0xFF)
    return , $f
}

function Set-FrameCrc {
    param([byte[]]$Frame)
    $crc = Get-Crc16 ([byte[]]($Frame[2..21]))
    $Frame[22] = [byte]($crc -band 0xFF)
    $Frame[23] = [byte](($crc -shr 8) -band 0xFF)
    return , $Frame
}

function Format-Bytes {
    param([byte[]]$Bytes)
    if ($null -eq $Bytes -or $Bytes.Length -eq 0) { return '(空)' }
    return (($Bytes | ForEach-Object { '{0:X2}' -f $_ }) -join ' ')
}

function Test-HelloResponse {
    param([byte[]]$Frame, [int]$RoleId, [int]$Seq)
    $checks = New-Object System.Collections.Generic.List[object]
    function Add-Check {
        param([string]$Name, [bool]$Pass, [string]$Detail)
        $checks.Add([pscustomobject]@{ Check = $Name; Pass = $Pass; Detail = $Detail })
    }

    if ($Frame.Length -ne 24) {
        Add-Check '长度=24' $false ("收到 {0} 字节" -f $Frame.Length)
        return [pscustomobject]@{ Pass = $false; Checks = $checks; Wire = $Frame }
    }
    $crcCalc = Get-Crc16 ([byte[]]($Frame[2..21]))
    # 注意：PowerShell 的 -shl 保留左操作数类型，byte 左移 8 位会溢出为 0，必须先转 int
    $crcWire = [int]$Frame[22] -bor ([int]$Frame[23] -shl 8)
    $session = [int]$Frame[6] -bor ([int]$Frame[7] -shl 8)
    $seqWire = [int]$Frame[8] -bor ([int]$Frame[9] -shl 8)

    Add-Check '帧头 A5 5A'      (($Frame[0] -eq 0xA5) -and ($Frame[1] -eq 0x5A)) ('{0:X2} {1:X2}' -f $Frame[0], $Frame[1])
    Add-Check '协议版本=1'      ($Frame[2] -eq $PROTO_VERSION)                     ('{0}' -f $Frame[2])
    Add-Check '类型=HELLO'      (($Frame[3] -eq $MSG_HELLO) -or ($Frame[3] -eq 0x81)) ('{0:X2}' -f $Frame[3])
    Add-Check '源地址=角色'     ($Frame[4] -eq $RoleId)                            ('{0}' -f $Frame[4])
    Add-Check '目的地址=PC(0)'  ($Frame[5] -eq $NODE_PC)                           ('{0}' -f $Frame[5])
    Add-Check 'session 回显=0'  ($session -eq 0)                                   ('{0}' -f $session)
    Add-Check 'seq 回显'        ($seqWire -eq $Seq)                                ('收到 {0} / 期望 {1}' -f $seqWire, $Seq)
    Add-Check 'payload_len=8'   ($Frame[12] -eq 8)                                 ('{0}' -f $Frame[12])
    Add-Check 'flags=响应位'    (($Frame[13] -band 0x01) -eq 0x01 -and ($Frame[13] -band 0x02) -eq 0) ('{0:X2}' -f $Frame[13])
    Add-Check 'payload[0]=OK'   ($Frame[14] -eq 0)                                 ('{0}' -f $Frame[14])
    Add-Check 'payload[1]=角色' ($Frame[15] -eq $RoleId)                           ('{0}' -f $Frame[15])
    Add-Check 'payload[7]=协议1' ($Frame[21] -eq $PROTO_VERSION)                   ('{0}' -f $Frame[21])
    Add-Check 'CRC-16/MODBUS'   ($crcCalc -eq $crcWire)                            ('计算 {0:X4} / 收到 {1:X4}' -f $crcCalc, $crcWire)

    $ok = $true
    foreach ($c in $checks) { if (-not $c.Pass) { $ok = $false } }
    return [pscustomobject]@{ Pass = $ok; Checks = $checks; Wire = $Frame }
}

function Open-SerialPort {
    param([string]$Name, [int]$Rate)
    $sp = New-Object System.IO.Ports.SerialPort $Name, $Rate, ([System.IO.Ports.Parity]::None), 8, ([System.IO.Ports.StopBits]::One)
    $sp.Handshake = [System.IO.Ports.Handshake]::None
    $sp.DtrEnable = $false
    $sp.RtsEnable = $false
    $sp.ReadBufferSize = 4096
    $sp.WriteBufferSize = 4096
    $sp.Open()
    $sp.DiscardInBuffer()
    $sp.DiscardOutBuffer()
    return $sp
}

function Send-Frame {
    param([System.IO.Ports.SerialPort]$Serial, [byte[]]$Bytes)
    $Serial.Write($Bytes, 0, $Bytes.Length)
    $Serial.BaseStream.Flush()
}

function Read-SerialBytes {
    param([System.IO.Ports.SerialPort]$Serial, [int]$TimeoutMs, [int]$Want = 24)
    $collected = New-Object System.Collections.Generic.List[byte]
    $deadline = [datetime]::UtcNow.AddMilliseconds($TimeoutMs)
    while ([datetime]::UtcNow -lt $deadline) {
        if ($Serial.BytesToRead -gt 0) {
            $n = $Serial.BytesToRead
            $tmp = New-Object byte[] $n
            $got = $Serial.Read($tmp, 0, $n)
            for ($i = 0; $i -lt $got; $i++) { $collected.Add($tmp[$i]) }
            if ($collected.Count -ge $Want) { break }
            # 已开始收到数据：再等一小段，收满整帧
            $deadline = [datetime]::UtcNow.AddMilliseconds(400)
        } else {
            Start-Sleep -Milliseconds 5
        }
    }
    return , $collected.ToArray()
}

function Get-HexInfo {
    param([string]$Role)
    $candidates = $ROLE_HEX[$Role]
    $rel = $null
    foreach ($candidate in $candidates) {
        if (Test-Path -LiteralPath (Join-Path $root $candidate)) { $rel = $candidate; break }
    }
    if (-not $rel) { $rel = $candidates[0] }
    $path = Join-Path $root $rel
    $info = [pscustomobject]@{ Role = $Role; Path = $rel; Exists = (Test-Path -LiteralPath $path); Sha256 = ''; Bytes = 0 }
    if ($info.Exists) {
        $info.Sha256 = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
        $info.Bytes = (Get-Item -LiteralPath $path).Length
    }
    return $info
}

# ---------------------------------------------------------------- SelfTest
function Invoke-SelfTest {
    $failures = New-Object System.Collections.Generic.List[string]

    # 1) protocol.md 黄金向量：PC -> CTRL, session 0, seq 1
    $goldenCtrl = [byte[]]@(
        0xA5,0x5A,0x01,0x01,0x00,0x01,0x00,0x00,
        0x01,0x00,0x00,0x00,0x01,0x00,0x00,0x00,
        0x00,0x00,0x00,0x00,0x00,0x00,0x24,0xA2
    )
    $built = New-HelloFrame -RoleId 1 -Seq 1
    if ((Format-Bytes $built) -ne (Format-Bytes $goldenCtrl)) {
        $failures.Add("CTRL seq=1 帧与 protocol.md 黄金向量不一致: $(Format-Bytes $built)")
    }

    # 2) tests/c/test_compact_protocol.c 的 DUT 请求/响应字面量
    $dutRequest = [byte[]]@(
        0xA5,0x5A,0x01,0x01,0x00,0x02,0x00,0x00,
        0x01,0x00,0x00,0x00,0x01,0x00,0x00,0x00,
        0x00,0x00,0x00,0x00,0x00,0x00,0xD4,0x52
    )
    $builtDut = New-HelloFrame -RoleId 2 -Seq 1
    if ((Format-Bytes $builtDut) -ne (Format-Bytes $dutRequest)) {
        $failures.Add("DUT seq=1 帧与 C 测试字面量不一致: $(Format-Bytes $builtDut)")
    }

    $dutResponse = [byte[]]@(
        0xA5,0x5A,0x01,0x01,0x02,0x00,0x00,0x00,
        0x01,0x00,0x00,0x00,0x08,0x01,0x00,0x02,
        0xE1,0x01,0x00,0x01,0x00,0x01,0x90,0x84
    )
    $verdict = Test-HelloResponse -Frame $dutResponse -RoleId 2 -Seq 1
    if (-not $verdict.Pass) {
        $bad = ($verdict.Checks | Where-Object { -not $_.Pass } | ForEach-Object { $_.Check }) -join ', '
        $failures.Add("C 测试 DUT 响应字面量未通过解码校验: $bad")
    }

    # 3) 期望响应向量（用于文档与人工对照）：CTRL / DUT / REF, seq 1
    $vectors = @()
    foreach ($r in 1, 2, 3) {
        $resp = [byte[]]@(0xA5,0x5A,0x01,0x01,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x08,0x01,0x00,0x00,0xE1,0x01,0x00,0x01,0x00,0x01,0x00,0x00)
        $resp[4] = [byte]$r
        $resp[5] = 0
        $resp[15] = [byte]$r
        $resp = Set-FrameCrc $resp
        $vectors += [pscustomobject]@{ Role = $r; Wire = (Format-Bytes $resp) }
        $v = Test-HelloResponse -Frame $resp -RoleId $r -Seq 1
        if (-not $v.Pass) { $failures.Add("角色 $r 的合成期望响应未通过解码校验") }
        if (($r -eq 2) -and ((Format-Bytes $resp) -ne (Format-Bytes $dutResponse))) {
            $failures.Add("DUT 合成响应与 C 测试字面量不一致: $(Format-Bytes $resp)")
        }
    }

    # 4) 坏帧必须被解码器拒绝
    $bad = New-HelloFrame -RoleId 1 -Seq 1
    $bad[14] = 0x01
    $v = Test-HelloResponse -Frame $bad -RoleId 1 -Seq 1
    if ($v.Pass) { $failures.Add('被篡改的 CRC 帧被错误接受') }

    Write-Output '=== verify-board 自检（不需要硬件） ==='
    Write-Output ("黄金向量 CTRL seq=1 : {0}" -f (Format-Bytes $goldenCtrl))
    foreach ($vec in $vectors) { Write-Output ("期望响应 角色{0} seq=1 : {1}" -f $vec.Role, $vec.Wire) }
    if ($failures.Count -eq 0) {
        Write-Output 'SelfTest passed: 帧编码/解码/CRC 与黄金向量一致。'
        $script:VerifyBoardVerdict = $true
        return
    }
    foreach ($f in $failures) { Write-Output ("SelfTest FAILED: {0}" -f $f) }
    $script:VerifyBoardVerdict = $false
}

# ---------------------------------------------------------------- ListPorts
function Invoke-ListPorts {
    Write-Output '=== 本机串口 ==='
    $ports = [System.IO.Ports.SerialPort]::GetPortNames() | Sort-Object
    if (-not $ports) { Write-Output '(没有发现串口：先插好板子的 USB 数据线，并安装 CH340 驱动)' ; return }
    $wmi = @{}
    try {
        Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction Stop |
            Where-Object { $_.Name -match '\(COM\d+\)' } |
            ForEach-Object {
                $m = [regex]::Match($_.Name, '\((COM\d+)\)')
                if ($m.Success) { $wmi[$m.Groups[1].Value] = $_.Name }
            }
    } catch { }
    foreach ($p in $ports) {
        $desc = if ($wmi.ContainsKey($p)) { $wmi[$p] } else { '(无描述)' }
        Write-Output ("{0}  {1}" -f $p, $desc)
    }
    Write-Output '提示：CH340 通常显示为 USB-SERIAL CH340 (COMx)。三块板要分别记录各自的 COM 口。'
}

# ---------------------------------------------------------------- Check
function Invoke-Check {
    $roleId = $ROLE_ID[$Role]
    $hexInfo = Get-HexInfo -Role $Role
    $startedUtc = [datetime]::UtcNow
    $negative = New-Object System.Collections.Generic.List[object]
    $challengeRows = New-Object System.Collections.Generic.List[object]
    $timings = New-Object System.Collections.Generic.List[double]
    $challengeTotal = 0
    $challengePass = 0

    Write-Output '=== 学习板 Compact 下板验证 ==='
    Write-Output ("时间(UTC)   : {0:yyyy-MM-dd HH:mm:ss}" -f $startedUtc)
    Write-Output ("串口/波特率 : {0} / {1} 8N1" -f $Port, $Baud)
    Write-Output ("角色        : {0} (地址 {1})" -f $Role, $roleId)
    Write-Output ("固件文件    : {0}" -f $hexInfo.Path)
    if ($hexInfo.Exists) { Write-Output ("SHA-256     : {0} ({1} 字节)" -f $hexInfo.Sha256, $hexInfo.Bytes) }
    else { Write-Output 'SHA-256     : 文件缺失（无法与烧录文件比对）' }
    Write-Output ''

    $serial = $null
    try {
        $serial = Open-SerialPort -Name $Port -Rate $Baud
    } catch {
        Write-Output ("无法打开串口 {0}: {1}" -f $Port, $_.Exception.Message)
        Write-Output '排查顺序:'
        Write-Output '  1) 用 -ListPorts 确认 COM 号，别选错板子'
        Write-Output '  2) 关闭 STC-ISP 的下载/串口助手窗口，它会占用同一个 COM 口'
        Write-Output '  3) 确认已安装 CH340 驱动（设备管理器出现 USB-SERIAL CH340）'
        Write-Output '  4) 确认板子已上电、USB 是数据线而不是纯充电线'
        $script:VerifyBoardVerdict = $false
        return
    }
    try {
        Write-Output ("串口已打开: {0}" -f $Port)

        # ---- 正例：黄金 HELLO 挑战
        $pass = 0
        $fail = 0
        $consecutiveFail = 0
        $aborted = $false
        for ($seq = 1; $seq -le $Challenges; $seq++) {
            $frame = New-HelloFrame -RoleId $roleId -Seq $seq
            $sw = [System.Diagnostics.Stopwatch]::StartNew()
            Send-Frame -Serial $serial -Bytes $frame
            $resp = Read-SerialBytes -Serial $serial -TimeoutMs $TimeoutMs
            $sw.Stop()
            $ms = [math]::Round($sw.Elapsed.TotalMilliseconds, 1)

            if ($resp.Length -eq 0) {
                $fail++
                $consecutiveFail++
                $challengeRows.Add([pscustomobject]@{ Seq = $seq; Result = 'NO_RESPONSE'; Ms = $ms; Detail = '超时未收到任何字节' })
                if ($consecutiveFail -ge 3) {
                    Write-Output ("连续 3 次无响应，提前中止（已完成 {0} 次）。" -f $seq)
                    $aborted = $true
                    break
                }
                continue
            }

            $verdict = Test-HelloResponse -Frame $resp -RoleId $roleId -Seq $seq
            if ($verdict.Pass) {
                $pass++
                $consecutiveFail = 0
                $timings.Add($ms)
                $challengeRows.Add([pscustomobject]@{ Seq = $seq; Result = 'PASS'; Ms = $ms; Detail = '' })
            } else {
                $fail++
                $consecutiveFail++
                $bad = ($verdict.Checks | Where-Object { -not $_.Pass } | ForEach-Object { "$($_.Check)=[$($_.Detail)]" }) -join '; '
                $challengeRows.Add([pscustomobject]@{ Seq = $seq; Result = 'FAIL'; Ms = $ms; Detail = $bad })
                if ($fail -le 3) { Write-Output ("seq {0} 校验失败: {1}" -f $seq, $bad) }
                if ($consecutiveFail -ge 3) {
                    Write-Output ("连续 3 次校验失败，提前中止（已完成 {0} 次）。" -f $seq)
                    $aborted = $true
                    break
                }
            }
        }

        $challengeTotal = $challengeRows.Count
        $challengePass = ($challengeRows | Where-Object { $_.Result -eq 'PASS' }).Count
        Write-Output ''
        Write-Output ("HELLO 挑战: {0}/{1} 首次正确响应" -f $challengePass, $challengeTotal)
        if ($timings.Count -gt 0) {
            $avg = [math]::Round((($timings | Measure-Object -Average).Average), 1)
            $min = [math]::Round((($timings | Measure-Object -Minimum).Minimum), 1)
            $max = [math]::Round((($timings | Measure-Object -Maximum).Maximum), 1)
            Write-Output ("往返耗时  : min {0} ms / avg {1} ms / max {2} ms" -f $min, $avg, $max)
        }

        # ---- 反例：坏帧必须无响应
        if (-not $SkipNegative -and -not $aborted) {
            Write-Output ''
            Write-Output '--- 反例（坏帧必须无响应，随后合法帧仍要能响应）---'
            $base = New-HelloFrame -RoleId $roleId -Seq 500

            $cases = @()
            $c1 = [byte[]]($base.Clone()); $c1[14] = 0x01
            $cases += [pscustomobject]@{ Name = 'CRC 被篡改'; Frame = $c1 }

            $c2 = [byte[]]($base.Clone())
            $c2[5] = [byte]((($roleId % 3) + 1))
            $c2 = Set-FrameCrc $c2
            $cases += [pscustomobject]@{ Name = '目的地址不是本角色'; Frame = $c2 }

            $c3 = [byte[]]($base.Clone()); $c3[2] = 0x02; $c3 = Set-FrameCrc $c3
            $cases += [pscustomobject]@{ Name = '协议版本=2'; Frame = $c3 }

            $c4 = [byte[]]($base.Clone()); $c4[12] = 9; $c4 = Set-FrameCrc $c4
            $cases += [pscustomobject]@{ Name = 'payload_len=9'; Frame = $c4 }

            foreach ($case in $cases) {
                Send-Frame -Serial $serial -Bytes $case.Frame
                $resp = Read-SerialBytes -Serial $serial -TimeoutMs 600
                $ok = ($resp.Length -eq 0)
                $negative.Add([pscustomobject]@{ Case = $case.Name; Expected = '无响应'; Pass = $ok; Detail = (Format-Bytes $resp) })
                $mark = 'FAIL'
                if ($ok) { $mark = 'OK' }
                Write-Output ("{0,-18} {1}  收到: {2}" -f $case.Name, $mark, (Format-Bytes $resp))
            }

            # 半帧：先发前 12 字节，不应响应；再补齐后 12 字节，应完整响应
            $half = [byte[]]($base.Clone())
            Send-Frame -Serial $serial -Bytes $half[0..11]
            $resp = Read-SerialBytes -Serial $serial -TimeoutMs 500
            $ok1 = ($resp.Length -eq 0)
            $negative.Add([pscustomobject]@{ Case = '半帧（前 12 字节）'; Expected = '无响应'; Pass = $ok1; Detail = (Format-Bytes $resp) })
            Send-Frame -Serial $serial -Bytes $half[12..23]
            $resp2 = Read-SerialBytes -Serial $serial -TimeoutMs $TimeoutMs
            $ok2 = $false
            $detail2 = Format-Bytes $resp2
            if ($resp2.Length -eq 24) {
                $v = Test-HelloResponse -Frame $resp2 -RoleId $roleId -Seq 500
                $ok2 = $v.Pass
                if (-not $ok2) { $detail2 = ($v.Checks | Where-Object { -not $_.Pass } | ForEach-Object { $_.Check }) -join ', ' }
            }
            $negative.Add([pscustomobject]@{ Case = '半帧补齐后恢复'; Expected = '完整正确响应'; Pass = $ok2; Detail = $detail2 })
            $mark = 'FAIL'
            if ($ok1 -and $ok2) { $mark = 'OK' }
            Write-Output ("{0,-18} {1}" -f '半帧/恢复', $mark)

            # 垃圾前缀 + 合法帧
            $garbage = [byte[]]@(0x00, 0x13, 0xA5, 0x00, 0x5A)
            Send-Frame -Serial $serial -Bytes $garbage
            Send-Frame -Serial $serial -Bytes $base
            $resp = Read-SerialBytes -Serial $serial -TimeoutMs $TimeoutMs
            $ok3 = $false
            if ($resp.Length -ge 24) {
                $tail = [byte[]]($resp[($resp.Length - 24)..($resp.Length - 1)])
                $v = Test-HelloResponse -Frame $tail -RoleId $roleId -Seq 500
                $ok3 = $v.Pass
            }
            $negative.Add([pscustomobject]@{ Case = '垃圾字节后重新同步'; Expected = '收到 1 个正确响应'; Pass = $ok3; Detail = (Format-Bytes $resp) })
            $mark = 'FAIL'
            if ($ok3) { $mark = 'OK' }
            Write-Output ("{0,-18} {1}" -f '垃圾后重同步', $mark)

            # 恢复：最后一次合法帧
            $final = New-HelloFrame -RoleId $roleId -Seq 501
            Send-Frame -Serial $serial -Bytes $final
            $resp = Read-SerialBytes -Serial $serial -TimeoutMs $TimeoutMs
            $ok4 = $false
            if ($resp.Length -eq 24) { $ok4 = (Test-HelloResponse -Frame $resp -RoleId $roleId -Seq 501).Pass }
            $negative.Add([pscustomobject]@{ Case = '反例后仍可正常响应'; Expected = 'PASS'; Pass = $ok4; Detail = (Format-Bytes $resp) })
            $mark = 'FAIL'
            if ($ok4) { $mark = 'OK' }
            Write-Output ("{0,-18} {1}" -f '最终恢复', $mark)
        }
    } finally {
        if ($serial -and $serial.IsOpen) { $serial.Close(); $serial.Dispose() }
    }

    $negativePass = 0
    if ($negative.Count -gt 0) { $negativePass = ($negative | Where-Object { $_.Pass }).Count }
    $overallPass = (($challengeTotal -eq $Challenges) -and ($challengePass -eq $challengeTotal) -and (($negative.Count -eq 0) -or ($negativePass -eq $negative.Count)))

    Write-Output ''
    if ($overallPass) {
        Write-Output ("结论: PASS —— {0} 号角色在 {1} 上的 UART1 {2}bps 协议 HELLO 全部正确。" -f $Role, $Port, $Baud)
    } else {
        Write-Output ("结论: FAIL —— 挑战 {0}/{1}，反例 {2}/{3}。" -f $challengePass, $challengeTotal, $negativePass, $negative.Count)
    }
    Write-Output '边界: 本结论只证明 UART1 + 24 字节协议 + 角色 HELLO；不证明红外/RS485/RTC/EEPROM/传感器/显示。'

    # ---- 落盘记录
    $outPath = Join-Path $root $OutDir
    if (-not (Test-Path -LiteralPath $outPath)) { New-Item -ItemType Directory -Path $outPath -Force | Out-Null }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmm'
    $baseName = "$stamp-$Role-$Port"
    $jsonPath = Join-Path $outPath ("$baseName.json")
    $mdPath = Join-Path $outPath ("$baseName.md")

    $verdictText = 'FAIL'
    if ($overallPass) { $verdictText = 'PASS' }

    $record = [pscustomobject]@{
        schemaVersion   = 1
        kind            = 'COMPACT_BOARD_CHECK'
        startedUtc      = $startedUtc.ToString('o')
        finishedUtc     = (Get-Date).ToUniversalTime().ToString('o')
        operator        = $Operator
        port            = $Port
        baud            = $Baud
        role            = $Role
        roleAddress     = $roleId
        firmwareFile    = $hexInfo.Path
        firmwareSha256  = $hexInfo.Sha256
        firmwareBytes   = $hexInfo.Bytes
        challenges      = $Challenges
        challengePass   = $challengePass
        challengeTotal  = $challengeTotal
        negativePass    = $negativePass
        negativeTotal   = $negative.Count
        verdict         = $verdictText
        challenges_detail = $challengeRows
        negative_detail   = $negative
        scope           = 'UART1 + PROTO24_CRC16 + ROLE_HELLO only'
    }
    $record | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

    $md = New-Object System.Collections.Generic.List[string]
    $md.Add("# Compact 下板验证记录 $Role @ $Port")
    $md.Add('')
    $md.Add('> 由 `scripts/verify-board.ps1` 自动生成。仅覆盖 UART1 + 24 字节协议 + 角色 HELLO。')
    $md.Add('')
    $md.Add('| 字段 | 值 |')
    $md.Add('| --- | --- |')
    $operatorText = '（待填）'
    if ($Operator) { $operatorText = $Operator }
    # 注意：方法调用的参数列表里逗号会当参数分隔符，-f 的整条表达式必须再加一层括号
    $md.Add(("| 日期与操作者 | {0:yyyy-MM-dd HH:mm} / {1} |" -f $startedUtc.ToLocalTime(), $operatorText))
    $md.Add("| 串口 / 波特率 | $Port / $Baud 8N1 |")
    $md.Add("| 角色 / 节点地址 | $Role / $roleId |")
    $md.Add("| 固件文件 | $($hexInfo.Path) |")
    $md.Add("| 固件 SHA-256 | $($hexInfo.Sha256) |")
    $md.Add("| HELLO 挑战 | $challengePass / $challengeTotal 首次正确响应 |")
    $md.Add("| 反例 | $negativePass / $($negative.Count) 符合预期 |")
    $md.Add("| 结论 | $(if ($overallPass) { 'PASS' } else { 'FAIL' }) |")
    if ($timings.Count -gt 0) {
        $md.Add(("| 往返耗时 | min {0} ms / avg {1} ms / max {2} ms |" -f [math]::Round((($timings | Measure-Object -Minimum).Minimum),1), [math]::Round((($timings | Measure-Object -Average).Average),1), [math]::Round((($timings | Measure-Object -Maximum).Maximum),1)))
    }
    $md.Add('')
    $md.Add('## 反例明细')
    $md.Add('')
    $md.Add('| 用例 | 期望 | 结果 | 实测 |')
    $md.Add('| --- | --- | --- | --- |')
    foreach ($n in $negative) {
        $md.Add("| $($n.Case) | $($n.Expected) | $(if ($n.Pass) { 'OK' } else { 'FAIL' }) | $($n.Detail) |")
    }
    $md.Add('')
    $md.Add('## 失败明细（最多列出前 10 条）')
    $md.Add('')
    $md.Add('| seq | 结果 | 耗时ms | 详情 |')
    $md.Add('| --- | --- | --- | --- |')
    $badRows = $challengeRows | Where-Object { $_.Result -ne 'PASS' } | Select-Object -First 10
    if ($badRows) { foreach ($r in $badRows) { $md.Add("| $($r.Seq) | $($r.Result) | $($r.Ms) | $($r.Detail) |") } }
    else { $md.Add('| - | 无 | - | 全部通过 |') }
    $md.Add('')
    $md.Add('## 边界与后续')
    $md.Add('')
    $md.Add('- 本记录不代表完整验收：Compact 固件没有会话引擎、RS485 编排、红外/RTC/EEPROM/传感器适配。')
    $md.Add('- 完整功能验收需要合法 C51 许可证后构建 `firmware/*/output/*.hex` 并按下板分层验证执行 G1/G2/G3。')
    $md.Add('- 请补充照片/视频路径、板号标签、接线情况，并同步填写 `docs/test-record-template.md`。')
    $md | Set-Content -LiteralPath $mdPath -Encoding UTF8

    Write-Output ''
    Write-Output ("记录已写入: {0}" -f $mdPath)
    Write-Output ("JSON 已写入: {0}" -f $jsonPath)

    $script:VerifyBoardVerdict = $overallPass
}

switch ($PSCmdlet.ParameterSetName) {
    'SelfTest'  { Invoke-SelfTest;  if ($script:VerifyBoardVerdict) { exit 0 } else { exit 1 } }
    'ListPorts' { Invoke-ListPorts; exit 0 }
    default     { Invoke-Check;     if ($script:VerifyBoardVerdict) { exit 0 } else { exit 1 } }
}
