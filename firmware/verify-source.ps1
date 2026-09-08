$ErrorActionPreference = 'Stop'
$firmware = $PSScriptRoot
$roles = @(
    @{ Dir='ctrl'; Name='AcceptanceCtrl'; Role='1' },
    @{ Dir='dut';  Name='AcceptanceDut';  Role='2' },
    @{ Dir='ref';  Name='AcceptanceRef';  Role='3' }
)

foreach ($role in $roles) {
    $root = Join-Path $firmware $role.Dir
    $project = Join-Path $root ($role.Name + '.uvproj')
    $main = Join-Path $root 'source\main.c'
    $roleHeader = Join-Path $root 'inc\app_role.h'
    $library = Join-Path $root 'source\STCBSP_V3.6.LIB'
    foreach ($required in @($project, $main, $roleHeader, $library)) {
        if (-not (Test-Path -LiteralPath $required)) { throw "Missing required firmware file: $required" }
    }

    [xml]$xml = Get-Content -Raw -LiteralPath $project
    $common = $xml.Project.Targets.Target.TargetOption.TargetCommonOption
    $c51 = $xml.Project.Targets.Target.TargetOption.Target51.C51.VariousControls
    if ($common.Device -ne 'STC15F2K60S2 Series') { throw "Wrong device in $project" }
    if ($common.OutputName -ne $role.Name -or $common.CreateHexFile -ne '1') { throw "Wrong output in $project" }
    if ($c51.IncludePath -ne '.\inc') { throw "Wrong include path in $project" }
    if ($common.Cpu -notmatch 'XRAM\(0-0x6FF\)') { throw "XRAM must stop at 0x6FF in $project" }

    $mainText = Get-Content -Raw -LiteralPath $main
    if ($mainText -notmatch 'SysClock\s*=\s*11059200') { throw "SysClock missing in $main" }
    if ($mainText -notmatch 'while\s*\(\s*1\s*\)\s*MySTC_OS\s*\(\s*\)\s*;') {
        throw "main loop must contain only MySTC_OS in $main"
    }
    if ((Get-Content -Raw -LiteralPath $roleHeader) -notmatch "APP_ROLE\s+$($role.Role)") {
        throw "Compiled role mismatch in $roleHeader"
    }
}

Write-Output 'Firmware source and project constraints passed.'
