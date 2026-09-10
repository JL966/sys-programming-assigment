@echo off
setlocal
title STC Diagnostic 2.3.0
echo Starting STC Diagnostic 2.3.0...
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-diagnostic.ps1"
if errorlevel 1 pause
endlocal
