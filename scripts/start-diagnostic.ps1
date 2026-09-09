param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
$release='2.1.1'
Write-Output "STC Diagnostic $release"
$root=Split-Path $PSScriptRoot -Parent
$node=Get-Command node -ErrorAction SilentlyContinue
if(!$node){throw 'Node.js not found. Install Node.js LTS, then try again.'}
$url='http://127.0.0.1:8000'
try{$response=Invoke-WebRequest "$url/health" -UseBasicParsing -TimeoutSec 2}catch{$response=$null}
if($response -and $response.Content -notmatch 'stc-diagnostic-v2'){throw 'Port 8000 is used by another application.'}
if(!$response){
 Start-Process -FilePath $node.Source -ArgumentList ('"'+(Join-Path $root 'scripts/serve.mjs')+'"') -WorkingDirectory $root -WindowStyle Hidden
 $up=$false
 for($i=0;$i -lt 25;$i++){
  try{$r=Invoke-WebRequest "$url/health" -UseBasicParsing -TimeoutSec 1;if($r.Content -match 'stc-diagnostic-v2'){$up=$true;break}}catch{}
  Start-Sleep -Milliseconds 200
 }
 if(!$up){throw 'Local service did not start. Check port 8000.'}
}
$stamp=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
# The existing static server reads files on every request. Reuse it only when
# its served application matches this checkout, without stopping other processes.
foreach($asset in @('index.html','js/diagnostic-app.js','js/diagnostic-runner.js','js/diagnostic-core.js','js/diagnostic-client.js','js/diagnostic-feedback.js','js/diagnostic-store.js','style.css')){
 $served=Invoke-WebRequest "$url/$asset`?launch=$stamp" -UseBasicParsing -TimeoutSec 5
 $local=[IO.File]::ReadAllText((Join-Path $root "web/$asset"),[Text.Encoding]::UTF8)
 if($served.Content -cne $local){throw "Port 8000 serves different project files ($asset). Close the old diagnostic service and try again."}
}
Write-Output "Verified: current checkout web files match http://127.0.0.1:8000 (release $release)."
if($CheckOnly){return}
$browsers=@("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe","$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe","$env:ProgramFiles\Google\Chrome\Application\chrome.exe","${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe","$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe")
$browser=$browsers|Where-Object {Test-Path -LiteralPath $_}|Select-Object -First 1
if(!$browser){throw 'Chrome or Edge is required for USB serial access.'}
$launchUrl="$url/?release=$release&launch=$stamp"
Start-Process -FilePath $browser -ArgumentList @('--new-window',('"'+$launchUrl+'"'))
