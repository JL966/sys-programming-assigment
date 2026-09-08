param(
    [Parameter(Mandatory=$true)][string]$Role,
    [Parameter(Mandatory=$true)][string]$Name
)
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot $Role
$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
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
$project = Join-Path $root ($Name + '.uvproj')
$log = Join-Path $root 'build.log'
$hex = Join-Path $root ('output\' + $Name + '.hex')
if (-not $uv4) { throw "Keil UV4.exe not found. Checked: $($uv4Candidates -join '; ')" }
Remove-Item -LiteralPath $log, $hex -Force -ErrorAction SilentlyContinue
Start-Process -FilePath $uv4 -ArgumentList @('-b', $project, '-o', $log) -Wait -WindowStyle Hidden
if (-not (Test-Path -LiteralPath $log)) { throw "Keil did not create: $log" }
$text = Get-Content -Raw -LiteralPath $log
if ($text -match 'FATAL ERROR' -or $text -notmatch '0 Error\(s\)') { throw "Compact Keil build failed: $log" }
$size = [regex]::Match($text, 'Program Size:\s*data=[^\r\n]*?code=(\d+)')
if (-not $size.Success) { throw "Program Size missing: $log" }
$codeBytes = [int]$size.Groups[1].Value
if ($codeBytes -gt 2048) { throw "Compact CODE exceeds 2048 bytes ($codeBytes): $log" }
if (-not (Test-Path -LiteralPath $hex)) { throw "Compact HEX missing: $hex" }
Write-Output "$Name build passed: code=$codeBytes bytes; $hex"
