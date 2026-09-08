param([Parameter(Mandatory=$true)][string]$Path)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Path)) { throw "Intel HEX missing: $Path" }
$records = @(Get-Content -LiteralPath $Path | Where-Object { $_.Trim().Length -gt 0 })
if ($records.Count -eq 0) { throw "Intel HEX is empty: $Path" }
$eofSeen = $false

for ($recordIndex = 0; $recordIndex -lt $records.Count; $recordIndex++) {
    $line = $records[$recordIndex].Trim()
    if ($eofSeen) { throw "Intel HEX has data after EOF: $Path" }
    if ($line -notmatch '^:[0-9A-Fa-f]+$' -or (($line.Length - 1) % 2) -ne 0) {
        throw "Intel HEX record syntax error at line $($recordIndex + 1): $Path"
    }
    $bytes = @()
    for ($i = 1; $i -lt $line.Length; $i += 2) {
        $bytes += [Convert]::ToByte($line.Substring($i, 2), 16)
    }
    if ($bytes.Count -lt 5 -or $bytes.Count -ne ($bytes[0] + 5)) {
        throw "Intel HEX byte count error at line $($recordIndex + 1): $Path"
    }
    $sum = 0
    foreach ($value in $bytes) { $sum = ($sum + $value) -band 0xFF }
    if ($sum -ne 0) { throw "Intel HEX checksum error at line $($recordIndex + 1): $Path" }
    $recordType = $bytes[3]
    if ($recordType -eq 1) {
        if ($bytes[0] -ne 0 -or $bytes[1] -ne 0 -or $bytes[2] -ne 0) {
            throw "Intel HEX malformed EOF: $Path"
        }
        $eofSeen = $true
    }
}
if (-not $eofSeen) { throw "Intel HEX EOF missing: $Path" }
Write-Output "Intel HEX checksum validation passed: $Path"
