param(
    [Parameter(Mandatory=$true)][string]$Role,
    [Parameter(Mandatory=$true)][string]$Name
)
$ErrorActionPreference = 'Stop'
$firmware = $PSScriptRoot
$roleRoot = Join-Path $firmware $Role
$driveRoot = [System.IO.Path]::GetPathRoot($roleRoot)
$uv4 = Join-Path $driveRoot 'Program Files (x86)\system_programming\UV4\UV4.exe'
$project = Join-Path $roleRoot ($Name + '.uvproj')
$log = Join-Path $roleRoot 'build.log'
$hex = Join-Path $roleRoot ('output\' + $Name + '.hex')

if (-not (Test-Path -LiteralPath $uv4)) { throw "Keil not found: $uv4" }
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
