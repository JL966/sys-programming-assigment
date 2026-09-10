@echo off
setlocal
title STC Diagnostic 2.4.0
echo Starting STC Diagnostic 2.4.0...
rem UI defaults: learning board collapsed; diagnostic checklist expanded.
rem Both panels use reversible expand/collapse motion.
rem Callout and result details use smooth, compact transitions.
rem Straight red arrows: refined sensor/socket endpoints and raised IR label.
rem No manual notes; all result statuses share the same typography.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-diagnostic.ps1"
if errorlevel 1 pause
endlocal
