& (Join-Path (Split-Path -Parent $PSScriptRoot) 'build-role.ps1') -Role 'dut' -Name 'AcceptanceDut'
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
