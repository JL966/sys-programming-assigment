$ErrorActionPreference = 'Stop'
$firmware = $PSScriptRoot
$project = Split-Path -Parent $firmware
$shared = Join-Path $project 'shared'
$workspace = Split-Path -Parent (Split-Path -Parent $project)
$templateProject = Get-ChildItem -LiteralPath $workspace -Recurse -Filter '01-Uart1.uvproj' |
    Select-Object -First 1
if (-not $templateProject) { throw 'Cannot locate the verified 01-Uart1 BSP template.' }
$template = $templateProject.DirectoryName

foreach ($role in @('ctrl', 'dut', 'ref')) {
    $root = Join-Path $firmware $role
    Copy-Item -Path (Join-Path $template 'inc\*') -Destination (Join-Path $root 'inc') -Force
    Copy-Item -LiteralPath (Join-Path $template 'source\STCBSP_V3.6.LIB') -Destination (Join-Path $root 'source\STCBSP_V3.6.LIB') -Force
    Copy-Item -LiteralPath (Join-Path $firmware 'common\firmware_app.c') -Destination (Join-Path $root 'source\firmware_app.c') -Force
    Copy-Item -LiteralPath (Join-Path $firmware 'common\firmware_app.h') -Destination (Join-Path $root 'inc\firmware_app.h') -Force
    foreach ($extra in @('checkpoint','test_adapters')) {
        Copy-Item -LiteralPath (Join-Path $firmware ('common\' + $extra + '.h')) -Destination (Join-Path $root 'inc') -Force
        Copy-Item -LiteralPath (Join-Path $firmware ('common\' + $extra + '.c')) -Destination (Join-Path $root 'source') -Force
    }
    foreach ($name in @('protocol','platform_types','session','records','test_engine')) {
        Copy-Item -LiteralPath (Join-Path $shared ($name + '.h')) -Destination (Join-Path $root 'inc') -Force
        if (Test-Path -LiteralPath (Join-Path $shared ($name + '.c'))) {
            Copy-Item -LiteralPath (Join-Path $shared ($name + '.c')) -Destination (Join-Path $root 'source') -Force
        }
    }
}

Write-Output 'Shared firmware and matching BSP assets synchronized.'
