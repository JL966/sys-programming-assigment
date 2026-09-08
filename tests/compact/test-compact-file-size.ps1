$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$verifier = Join-Path $root 'firmware\compact\verify-compact.ps1'
$output = & powershell -NoProfile -ExecutionPolicy Bypass -File $verifier | Out-String
if ($LASTEXITCODE -ne 0) { throw 'Compact verifier failed.' }
if ($output -notmatch 'HexBytes') { throw 'Compact verifier does not report the HEX file-size gate.' }
Get-ChildItem -LiteralPath (Join-Path $root 'firmware\compact') -Recurse -Filter '*Compact.hex' | ForEach-Object {
    if ($_.Length -gt 2048) { throw "Compact HEX file exceeds 2048 bytes: $($_.FullName)" }
}
Write-Output 'All Compact HEX files are at most 2048 filesystem bytes.'
