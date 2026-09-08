param(
    [Parameter(Mandatory=$true)][string]$Role,
    [Parameter(Mandatory=$true)][string]$Name
)
$ErrorActionPreference = 'Stop'
$root = Join-Path $PSScriptRoot $Role
$driveRoot = [System.IO.Path]::GetPathRoot($root)
$uv4 = Join-Path $driveRoot 'Program Files (x86)\system_programming\UV4\UV4.exe'
$project = Join-Path $root ($Name + '.uvproj')
$log = Join-Path $root 'build.log'
$hex = Join-Path $root ('output\' + $Name + '.hex')
if (-not (Test-Path -LiteralPath $uv4)) { throw "Keil not found: $uv4" }
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
