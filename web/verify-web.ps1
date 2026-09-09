$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$required = @(
    'index.html', 'style.css',
    'js\app.js', 'js\protocol.js', 'js\engine.js', 'js\serial-transport.js',
    'js\protocol-client.js', 'js\connection-manager.js', 'js\real-rig.js',
    'js\record-codec.js', 'js\virtual-board.js'
)
foreach ($file in $required) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $file))) { throw "Missing web file: $file" }
}
$html = Get-Content -Raw -LiteralPath (Join-Path $root 'index.html')
foreach ($id in @(
    'mode-banner', 'node-grid', 'serial-connections', 'plan-select',
    'write-authorization', 'start-button', 'cancel-button', 'attempt-list',
    'evidence-panel', 'export-json', 'export-html'
)) {
    if ($html -notmatch ('id="' + [regex]::Escape($id) + '"')) { throw "Missing DOM id: $id" }
}
Write-Output 'Web structure check passed.'
