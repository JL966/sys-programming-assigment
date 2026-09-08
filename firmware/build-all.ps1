$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'sync-shared.ps1')
& (Join-Path $PSScriptRoot 'create-projects.ps1')
& (Join-Path $PSScriptRoot 'verify-source.ps1')
foreach ($role in @(
    @{ Dir='ctrl'; Name='AcceptanceCtrl' },
    @{ Dir='dut'; Name='AcceptanceDut' },
    @{ Dir='ref'; Name='AcceptanceRef' }
)) {
    & (Join-Path $PSScriptRoot 'build-role.ps1') -Role $role.Dir -Name $role.Name
}
Write-Output 'All three firmware builds passed.'
