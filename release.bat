@echo off
title Git Release Tag
cd /d "%~dp0"

echo.
echo  ================================
echo   ARTMODUL - RELEASE TAG SETZEN
echo  ================================
echo.

:: Datum + Uhrzeit als Tag-Name
for /f "tokens=1-3 delims=." %%a in ("%date%") do set D=%%c%%b%%a
for /f "tokens=1-2 delims=:" %%a in ("%time%") do set T=%%a%%b
:: Leerzeichen in der Uhrzeit entfernen
set T=%T: =0%
set TAG=release-%D%-%T%

echo  Tag: %TAG%
echo.

git tag -a %TAG% -m "Release vor Layout-Refactor %date% %time%"
git push origin %TAG%

echo.
echo  ===================================
echo   TAG ERSTELLT UND GEPUSHT: %TAG%
echo  ===================================
echo.
echo  Rollback-Befehl:
echo    git checkout %TAG%
echo.
