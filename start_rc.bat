@echo off
:: ─────────────────────────────────────────────────────────
::  ARTMODUL KONFIGURATOR — Remote Control Session starten
::  Doppelklick → Claude Code öffnet sich, QR-Code erscheint
::  Claude App auf dem Handy → QR scannen → verbunden
:: ─────────────────────────────────────────────────────────

cd /d "%~dp0"

echo.
echo  ARTMODUL — Remote Control wird gestartet...
echo  Warte auf QR-Code, dann Claude App oeffnen und scannen.
echo  (Abbruch: Strg+C)
echo.

claude remote-control --name "Artmodul Konfigurator" --spawn=same-dir
