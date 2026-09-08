$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$checker = Join-Path $root 'scripts\verify-intel-hex.ps1'
$validHex = Join-Path $root 'firmware\compact\ctrl\output\AcceptanceCtrlCompact.hex'
if (-not (Test-Path -LiteralPath $checker)) { throw "Intel HEX checker missing: $checker" }
& powershell -NoProfile -ExecutionPolicy Bypass -File $checker -Path $validHex
if ($LASTEXITCODE -ne 0) { throw 'Valid Compact HEX was rejected.' }

$badHex = [System.IO.Path]::GetTempFileName()
try {
    $lines = @(Get-Content -LiteralPath $validHex)
    $line = $lines[0]
    $replacement = if ($line.Substring($line.Length - 2) -eq '00') { 'FF' } else { '00' }
    $lines[0] = $line.Substring(0, $line.Length - 2) + $replacement
    $lines | Set-Content -LiteralPath $badHex -Encoding ascii
    $oldPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $checker -Path $badHex 2>&1 | Out-String
    $exitCode = $LASTEXITCODE
    $ErrorActionPreference = $oldPreference
    if ($exitCode -eq 0 -or $output -notmatch '(?i)checksum') {
        throw "Corrupt checksum was not rejected: $output"
    }
} finally {
    Remove-Item -LiteralPath $badHex -Force -ErrorAction SilentlyContinue
}
Write-Output 'Intel HEX valid and corrupt-checksum cases passed.'
