& (Join-Path (Split-Path -Parent $PSScriptRoot) 'build-role.ps1') -Role 'ref' -Name 'AcceptanceRef'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
