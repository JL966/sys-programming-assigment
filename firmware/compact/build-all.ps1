$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'sync-assets.ps1')
& (Join-Path $PSScriptRoot 'create-projects.ps1')
& (Join-Path $PSScriptRoot 'verify-source.ps1')
& (Join-Path $PSScriptRoot 'build-role.ps1') -Role ctrl -Name AcceptanceCtrlCompact
& (Join-Path $PSScriptRoot 'build-role.ps1') -Role dut -Name AcceptanceDutCompact
& (Join-Path $PSScriptRoot 'build-role.ps1') -Role ref -Name AcceptanceRefCompact
& (Join-Path $PSScriptRoot 'verify-compact.ps1')
