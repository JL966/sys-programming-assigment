$ErrorActionPreference = 'Stop'
$compactRoot = $PSScriptRoot
$workspace = Split-Path -Parent (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $compactRoot)))
$template = Join-Path $workspace '作业5-0\file\01-Uart1'
$mcuHeader = Join-Path $template 'inc\STC15F2K60S2.H'
if (-not (Test-Path -LiteralPath $mcuHeader)) { throw "STC register header missing: $mcuHeader" }

$roles = @(
    @{ Dir='ctrl'; Role='1' },
    @{ Dir='dut'; Role='2' },
    @{ Dir='ref'; Role='3' }
)
foreach ($role in $roles) {
    $root = Join-Path $compactRoot $role.Dir
    $inc = Join-Path $root 'inc'
    $source = Join-Path $root 'source'
    New-Item -ItemType Directory -Force -Path $inc, $source, (Join-Path $root 'output'), (Join-Path $root 'list') | Out-Null
    Copy-Item -LiteralPath $mcuHeader -Destination (Join-Path $inc 'STC15F2K60S2.H') -Force
    Copy-Item -LiteralPath (Join-Path $compactRoot 'common\compact_app.h') -Destination (Join-Path $inc 'compact_app.h') -Force
    Copy-Item -LiteralPath (Join-Path $compactRoot 'common\compact_protocol.h') -Destination (Join-Path $inc 'compact_protocol.h') -Force
    Copy-Item -LiteralPath (Join-Path $compactRoot 'common\compact_app.c') -Destination (Join-Path $source 'compact_app.c') -Force
    Copy-Item -LiteralPath (Join-Path $compactRoot 'common\compact_protocol.c') -Destination (Join-Path $source 'compact_protocol.c') -Force
    @"
#ifndef ACCEPTANCE_COMPACT_ROLE_H
#define ACCEPTANCE_COMPACT_ROLE_H
#define APP_ROLE $($role.Role)
#endif
"@ | Set-Content -LiteralPath (Join-Path $inc 'app_role.h') -Encoding ascii
    @'
#include "STC15F2K60S2.H"
#include "compact_app.h"

#define SYS_CLOCK 11059200UL

void main(void)
{
    CompactApp_Init();
    while (1) MySTC_OS();
}
'@ | Set-Content -LiteralPath (Join-Path $source 'main.c') -Encoding ascii
}
Write-Output 'Compact role sources and STC register headers synchronized.'
