param([switch]$ExpectMissing)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$verifier = Join-Path $root 'firmware\compact\verify-compact.ps1'

if (-not (Test-Path -LiteralPath $verifier)) {
    throw "Compact verifier missing: $verifier"
}

if ($ExpectMissing) {
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $verifier 2>&1 | Out-String
    $ErrorActionPreference = $previousPreference
    if ($LASTEXITCODE -eq 0) { throw 'Compact verifier unexpectedly passed without artifacts.' }
    if ($output -notmatch '(?i)missing') { throw "Expected a missing-artifact failure, got: $output" }
    Write-Output 'Compact gate correctly rejects missing artifacts.'
    exit 0
}

& powershell -NoProfile -ExecutionPolicy Bypass -File $verifier
if ($LASTEXITCODE -ne 0) { throw 'Compact artifact gate failed.' }
