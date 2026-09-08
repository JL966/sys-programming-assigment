param(
    [Parameter(Mandatory=$true)][string]$Role,
    [Parameter(Mandatory=$true)][string]$Name
)
$ErrorActionPreference = 'Stop'
$firmware = $PSScriptRoot
$roleRoot = Join-Path $firmware $Role
$projectRoot = Split-Path -Parent $firmware
$workspace = Split-Path -Parent (Split-Path -Parent $projectRoot)
$driveRoot = [System.IO.Path]::GetPathRoot($projectRoot)
# 不同机器的 Keil 安装位置不同，按顺序找第一个存在的 UV4.exe
$uv4Candidates = @(
    (Join-Path $workspace 'keil\UV4\UV4.exe'),
    (Join-Path $driveRoot 'Program Files (x86)\system_programming\UV4\UV4.exe'),
    (Join-Path $driveRoot 'Keil_v5\UV4\UV4.exe'),
    (Join-Path $driveRoot 'Keil\UV4\UV4.exe'),
    'C:\Keil_v5\UV4\UV4.exe',
    'C:\Keil\UV4\UV4.exe'
)
$uv4 = $uv4Candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
$project = Join-Path $roleRoot ($Name + '.uvproj')
$log = Join-Path $roleRoot 'build.log'
$hex = Join-Path $roleRoot ('output\' + $Name + '.hex')

if (-not $uv4) { throw "Keil UV4.exe not found. Checked: $($uv4Candidates -join '; ')" }
New-Item -ItemType Directory -Force -Path (Join-Path $roleRoot 'output'), (Join-Path $roleRoot 'list') | Out-Null
Remove-Item -LiteralPath $log -Force -ErrorAction SilentlyContinue
Start-Process -FilePath $uv4 -ArgumentList @('-b', $project, '-o', $log) -Wait -WindowStyle Hidden
if (-not (Test-Path -LiteralPath $log)) { throw "Keil did not create $log" }
$text = Get-Content -Raw -LiteralPath $log
if ($text -match 'FATAL ERROR|RESTRICTED VERSION') {
    throw "Keil fatal/restricted build; inspect: $log"
}
if ($text -notmatch '0 Error\(s\)') { throw "Keil build failed: $log" }
if (-not (Test-Path -LiteralPath $hex)) { throw "HEX missing: $hex" }
Write-Output "$Name build passed: $hex"
