param([switch]$SoftwareOnly)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

& (Join-Path $root 'tests\run-c-tests.ps1')
if ($LASTEXITCODE -ne 0) { throw 'C tests failed' }

Push-Location $root
try {
    node --test '.\tests\js\*.test.mjs'
    if ($LASTEXITCODE -ne 0) { throw 'JavaScript tests failed' }
    Get-ChildItem '.\web\js\*.js' | ForEach-Object {
        node --check $_.FullName
        if ($LASTEXITCODE -ne 0) { throw "JavaScript syntax failed: $($_.Name)" }
    }
    powershell -ExecutionPolicy Bypass -File '.\web\verify-web.ps1'
    if ($LASTEXITCODE -ne 0) { throw 'Web structure check failed' }
    powershell -ExecutionPolicy Bypass -File '.\tests\board\test-board-tool.ps1'
    if ($LASTEXITCODE -ne 0) { throw 'Board tool tests failed' }
    powershell -ExecutionPolicy Bypass -File '.\firmware\verify-source.ps1'
    if ($LASTEXITCODE -ne 0) { throw 'Firmware source check failed' }
    if (-not $SoftwareOnly) {
        powershell -ExecutionPolicy Bypass -File '.\firmware\build-all.ps1'
        if ($LASTEXITCODE -ne 0) { throw 'Keil build failed' }
    }
} finally {
    Pop-Location
}

if ($SoftwareOnly) { Write-Output 'All software-only checks passed. Keil build was intentionally skipped.' }
else { Write-Output 'All checks and all Keil builds passed.' }
