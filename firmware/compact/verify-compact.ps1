$ErrorActionPreference = 'Stop'
$compactRoot = $PSScriptRoot
$roles = @(
    @{ Dir='ctrl'; Name='AcceptanceCtrlCompact'; Role='CTRL' },
    @{ Dir='dut'; Name='AcceptanceDutCompact'; Role='DUT' },
    @{ Dir='ref'; Name='AcceptanceRefCompact'; Role='REF' }
)
$rows = @()

foreach ($role in $roles) {
    $roleRoot = Join-Path $compactRoot $role.Dir
    $log = Join-Path $roleRoot 'build.log'
    $map = Join-Path $roleRoot ('list\' + $role.Name + '.m51')
    $hex = Join-Path $roleRoot ('output\' + $role.Name + '.hex')
    foreach ($required in @($log, $map, $hex)) {
        if (-not (Test-Path -LiteralPath $required)) {
            throw "Compact artifact missing: $required"
        }
    }

    $logText = Get-Content -Raw -LiteralPath $log
    if ($logText -match 'FATAL ERROR|RESTRICTED VERSION' -or $logText -notmatch '0 Error\(s\)') {
        throw "Compact build log is not successful: $log"
    }
    $sizeMatch = [regex]::Match($logText, 'Program Size:\s*data=[^\r\n]*?code=(\d+)')
    if (-not $sizeMatch.Success) { throw "Program Size missing from: $log" }
    $codeBytes = [int]$sizeMatch.Groups[1].Value
    if ($codeBytes -gt 2048) { throw "Compact CODE exceeds 2048 bytes ($codeBytes): $log" }

    $records = @(Get-Content -LiteralPath $hex | Where-Object { $_.Trim().Length -gt 0 })
    if ($records.Count -lt 2 -or $records[0] -notmatch '^:' -or $records[-1].Trim() -ne ':00000001FF') {
        throw "Invalid Intel HEX structure: $hex"
    }
    foreach ($record in $records) {
        if ($record -notmatch '^:[0-9A-Fa-f]+$' -or (($record.Length - 1) % 2) -ne 0) {
            throw "Invalid Intel HEX record: $hex"
        }
    }
    & (Join-Path (Split-Path -Parent (Split-Path -Parent $compactRoot)) 'scripts\verify-intel-hex.ps1') -Path $hex | Out-Null
    $hexBytes = (Get-Item -LiteralPath $hex).Length
    if ($hexBytes -gt 2048) { throw "Compact HEX file exceeds 2048 bytes ($hexBytes): $hex" }

    $rows += [pscustomobject]@{
        Role = $role.Role
        CodeBytes = $codeBytes
        HexBytes = $hexBytes
        Hex = $hex
        Sha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $hex).Hash
    }
}

$rows | Format-Table Role, CodeBytes, HexBytes, Hex -AutoSize
Write-Output 'All compact artifacts passed the 2048-byte CODE and HEX file-size gates.'
