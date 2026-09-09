param([string]$Keil='D:\Keil')
$ErrorActionPreference='Stop'
Push-Location $PSScriptRoot
try {
 New-Item -ItemType Directory -Force output,list | Out-Null
 $log=@()
 foreach($name in 'main','diagnostic','hardware','extension','rfid_readonly') {
  $lines=& "$Keil/C51/BIN/C51.exe" "source/$name.c" 'INCDIR(inc)' "OBJECT(output/$name.obj)" "PRINT(list/$name.lst)" 'OPTIMIZE(8,SIZE)' 2>&1
  $log+=$lines; $lines | Write-Output
  if($LASTEXITCODE -gt 1){throw "Compile failed: $name"}
 }
 $lines=& "$Keil/C51/BIN/BL51.exe" 'output/main.obj,output/diagnostic.obj,output/hardware.obj,output/extension.obj,output/rfid_readonly.obj,source/STCBSP_V3.6.LIB' 'TO' 'output/AcceptanceDiagnostic' 'XDATA(0x0000-0x06FF)' 'PRINT(list/AcceptanceDiagnostic.m51)' 2>&1
 $log+=$lines;$lines | Write-Output
 if($LASTEXITCODE -gt 1){throw 'Link failed'}
 $lines=& "$Keil/C51/BIN/OH51.exe" 'output/AcceptanceDiagnostic' 'HEXFILE(output/AcceptanceDiagnostic.hex)' 2>&1
 $log+=$lines;$lines | Write-Output
 if($LASTEXITCODE -ne 0){throw 'HEX generation failed'}
} finally { $log | Out-File build.log -Encoding utf8; Pop-Location }
