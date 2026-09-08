$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$logs = @(
    'firmware\compact\ctrl\build.log',
    'firmware\compact\dut\build.log',
    'firmware\compact\ref\build.log'
)
foreach ($relative in $logs) {
    $path = Join-Path $root $relative
    if (-not (Test-Path -LiteralPath $path)) { throw "Compact build log missing: $path" }
    $text = Get-Content -Raw -LiteralPath $path
    if ($text -notmatch '0 Error\(s\), 0 Warning\(s\)') { throw "Compact build is not warning-free: $path" }
}
Write-Output 'All Compact builds are warning-free.'
