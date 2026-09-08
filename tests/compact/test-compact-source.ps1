$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$verifier = Join-Path $root 'firmware\compact\verify-source.ps1'
if (-not (Test-Path -LiteralPath $verifier)) { throw "Compact source verifier missing: $verifier" }
& powershell -NoProfile -ExecutionPolicy Bypass -File $verifier
if ($LASTEXITCODE -ne 0) { throw 'Compact source verification failed.' }
