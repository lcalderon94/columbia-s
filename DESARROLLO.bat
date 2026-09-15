@echo off
REM Modo desarrollo: recarga sola al tocar el codigo. No usar en el local.

chcp 65001 >nul
cd /d "%~dp0"
echo.
echo Modo desarrollo. Mostrador en http://localhost:5173
echo.
call npm.cmd run dev
pause
