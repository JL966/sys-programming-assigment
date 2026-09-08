& (Join-Path (Split-Path -Parent $PSScriptRoot) 'build-role.ps1') -Role 'ctrl' -Name 'AcceptanceCtrl'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
