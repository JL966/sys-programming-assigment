$ErrorActionPreference = 'Stop'
$roles = @(
    @{ Dir='ctrl'; Name='AcceptanceCtrlCompact'; Role='1' },
    @{ Dir='dut'; Name='AcceptanceDutCompact'; Role='2' },
    @{ Dir='ref'; Name='AcceptanceRefCompact'; Role='3' }
)

foreach ($role in $roles) {
    $root = Join-Path $PSScriptRoot $role.Dir
    $project = Join-Path $root ($role.Name + '.uvproj')
    $main = Join-Path $root 'source\main.c'
    $app = Join-Path $root 'source\compact_app.c'
    $protocol = Join-Path $root 'source\compact_protocol.c'
    $header = Join-Path $root 'inc\app_role.h'
    $mcuHeader = Join-Path $root 'inc\STC15F2K60S2.H'
    foreach ($required in @($project, $main, $app, $protocol, $header, $mcuHeader)) {
        if (-not (Test-Path -LiteralPath $required)) { throw "Compact source missing: $required" }
    }

    [xml]$xml = Get-Content -Raw -LiteralPath $project
    $target = $xml.Project.Targets.Target
    $common = $target.TargetOption.TargetCommonOption
    $files = @($xml.SelectNodes('//Groups/Group/Files/File/FileName') | ForEach-Object { $_.InnerText })
    if ($common.Device -ne 'STC15F2K60S2 Series') { throw "Wrong compact device: $project" }
    if ($common.OutputName -ne $role.Name -or $common.CreateHexFile -ne '1') { throw "Wrong compact output: $project" }
    if ($target.TargetOption.Target51.C51.VariousControls.IncludePath -ne '.\inc') { throw "Wrong compact include path: $project" }
    if ($common.Cpu -notmatch 'XRAM\(0-0x6FF\)') { throw "Compact XRAM must stop at 0x6FF: $project" }
    if ($files -contains 'STCBSP_V3.6.LIB') { throw "Compact target must not link BSP: $project" }
    if ($files.Count -ne 3 -or $files -notcontains 'main.c' -or $files -notcontains 'compact_app.c' -or $files -notcontains 'compact_protocol.c') {
        throw "Compact target must link only main.c, compact_app.c and compact_protocol.c: $project"
    }

    $mainText = Get-Content -Raw -LiteralPath $main
    $appText = Get-Content -Raw -LiteralPath $app
    $roleText = Get-Content -Raw -LiteralPath $header
    if ($mainText -notmatch 'SYS_CLOCK\s+11059200UL') { throw "Compact clock missing: $main" }
    if ($mainText -notmatch 'while\s*\(\s*1\s*\)\s*MySTC_OS\s*\(\s*\)\s*;') { throw "Compact scheduler loop invalid: $main" }
    if ($roleText -notmatch "APP_ROLE\s+$($role.Role)") { throw "Compact role mismatch: $header" }
    if ($appText -notmatch 'COMPACT_FRAME_SIZE\s+24') { throw "Compact frame length missing: $app" }
    if ($appText -notmatch 'T2H\s*=\s*0xFB' -or $appText -notmatch 'T2L\s*=\s*0x80') { throw "UART1 2400 reload missing: $app" }
}

Write-Output 'Compact source and project constraints passed.'
