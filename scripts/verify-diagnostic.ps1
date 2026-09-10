$ErrorActionPreference='Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
 & node --test tests/js/diagnostic.test.mjs tests/js/diagnostic-runner.test.mjs tests/js/diagnostic-feedback.test.mjs tests/js/serial-transport.test.mjs tests/js/extension.test.mjs
 if($LASTEXITCODE){throw 'JS regression failed'}
 & gcc -DDIAG_HOST_TEST -Dxdata= -Itests/c -Ifirmware/diagnostic/inc firmware/diagnostic/source/hardware.c firmware/diagnostic/source/extension.c firmware/diagnostic/source/rfid_readonly.c tests/c/extension-bsp-stub.c tests/c/test_diagnostic_hardware.c -o tests/c/diagnostic-test.exe
 if($LASTEXITCODE){throw 'C host build failed'}
 & ./tests/c/diagnostic-test.exe
 if($LASTEXITCODE){throw 'C regression failed'}
 & gcc -DDIAG_HOST_TEST -Dxdata= -Itests/c -Ifirmware/diagnostic/inc firmware/diagnostic/source/rfid_readonly.c tests/c/test_rfid_readonly.c -o tests/c/rfid-test.exe
 if($LASTEXITCODE){throw 'RFID host build failed'}
 & ./tests/c/rfid-test.exe
 if($LASTEXITCODE){throw 'RFID state regression failed'}
 & ./firmware/diagnostic/build.ps1
 & ./scripts/verify-intel-hex.ps1 -Path firmware/diagnostic/output/AcceptanceDiagnostic.hex
 Write-Output 'Software verification passed. Physical-board testing is still required.'
}finally{Pop-Location}
