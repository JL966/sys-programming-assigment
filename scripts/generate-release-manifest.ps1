$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$firmware = Join-Path $root 'firmware'
$items = @()
foreach ($role in @(
    @{ Dir='ctrl'; Name='AcceptanceCtrl' },
    @{ Dir='dut'; Name='AcceptanceDut' },
    @{ Dir='ref'; Name='AcceptanceRef' }
)) {
    $hex = Join-Path $firmware ($role.Dir + '\output\' + $role.Name + '.hex')
    $log = Join-Path $firmware ($role.Dir + '\build.log')
    if (-not (Test-Path -LiteralPath $hex)) { throw "Refusing release manifest: HEX missing: $hex" }
    if ((Get-Content -Raw -LiteralPath $log) -match 'FATAL ERROR|[1-9][0-9]* Error\(s\)') {
        throw "Refusing release manifest: failed build log: $log"
    }
    $file = Get-Item -LiteralPath $hex
    $items += [ordered]@{ role=$role.Dir; file=$file.FullName; bytes=$file.Length; sha256=(Get-FileHash -Algorithm SHA256 -LiteralPath $hex).Hash }
}
$manifest = [ordered]@{ schema=1; generatedAt=(Get-Date).ToUniversalTime().ToString('o'); protocol=1; hardwareVerified=$false; firmware=$items }
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $root 'release-manifest.json') -Encoding utf8
Write-Output 'release-manifest.json generated; hardwareVerified remains false until on-board records exist.'
