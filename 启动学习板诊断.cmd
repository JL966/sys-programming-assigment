@echo off
setlocal
title STC Diagnostic 2.1.1
echo Starting STC Diagnostic 2.1.1...
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-diagnostic.ps1"
if errorlevel 1 pause
endlocal
