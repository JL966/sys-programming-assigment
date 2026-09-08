$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$generator = Join-Path $root 'scripts\generate-compact-manifest.ps1'
$manifestPath = Join-Path $root 'compact-release-manifest.json'
if (-not (Test-Path -LiteralPath $generator)) { throw "Compact manifest generator missing: $generator" }
& powershell -NoProfile -ExecutionPolicy Bypass -File $generator
if ($LASTEXITCODE -ne 0) { throw 'Compact manifest generation failed.' }
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
if ($manifest.profile -ne 'EVAL_COMPACT') { throw 'Wrong compact manifest profile.' }
if ($manifest.hardwareValidated -ne $false) { throw 'Compact manifest must not claim hardware validation.' }
if (@($manifest.artifacts).Count -ne 3) { throw 'Compact manifest must contain three artifacts.' }
foreach ($artifact in $manifest.artifacts) {
    if ($artifact.codeBytes -gt 2048) { throw "Manifest CODE exceeds 2048: $($artifact.role)" }
    $path = Join-Path $root $artifact.path
    $fileBytes = (Get-Item -LiteralPath $path).Length
    if ($artifact.hexBytes -ne $fileBytes -or $artifact.hexBytes -gt 2048) {
        throw "Manifest HEX size mismatch or exceeds 2048: $($artifact.role)"
    }
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $path).Hash
    if ($actual -ne $artifact.sha256) { throw "Manifest hash mismatch: $($artifact.role)" }
}
Write-Output 'Compact manifest content and hashes passed.'
