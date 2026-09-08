$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$compact = Join-Path $root 'firmware\compact'
& (Join-Path $compact 'verify-compact.ps1') | Out-Host

$roles = @(
    @{ Dir='ctrl'; Name='AcceptanceCtrlCompact'; Role='CTRL' },
    @{ Dir='dut'; Name='AcceptanceDutCompact'; Role='DUT' },
    @{ Dir='ref'; Name='AcceptanceRefCompact'; Role='REF' }
)
$artifacts = @()
foreach ($role in $roles) {
    $hex = Join-Path $compact ($role.Dir + '\output\' + $role.Name + '.hex')
    $log = Join-Path $compact ($role.Dir + '\build.log')
    $text = Get-Content -Raw -LiteralPath $log
    $size = [regex]::Match($text, 'Program Size:\s*data=[^\r\n]*?code=(\d+)')
    if (-not $size.Success) { throw "Program Size missing: $log" }
    if (-not $hex.StartsWith($root + '\', [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Artifact is outside project root: $hex"
    }
    $relativePath = $hex.Substring($root.Length + 1).Replace('\','/')
    $artifacts += [ordered]@{
        role = $role.Role
        path = $relativePath
        codeBytes = [int]$size.Groups[1].Value
        hexBytes = (Get-Item -LiteralPath $hex).Length
        sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $hex).Hash
    }
}

$manifest = [ordered]@{
    schemaVersion = 1
    profile = 'EVAL_COMPACT'
    createdUtc = [DateTime]::UtcNow.ToString('o')
    device = 'STC15F2K60S2'
    clockHz = 11059200
    codeLimitBytes = 2048
    hardwareValidated = $false
    capabilities = @('UART1_2400','PROTO24_CRC16','ROLE_HELLO')
    limitations = @('No full session engine','No RS485 orchestration','No P1 adapters','Not a hardware PASS claim')
    artifacts = $artifacts
}
$path = Join-Path $root 'compact-release-manifest.json'
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $path -Encoding utf8
Write-Output "Compact release manifest generated: $path"
