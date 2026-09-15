@echo off
REM Instalacion de Columbia's en el PC del local.
REM Se ejecuta con doble clic: no hace falta abrir ninguna consola.
REM Los .bat usan npm.cmd, asi que la politica de scripts de PowerShell no estorba.

chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ===============================================
echo   Columbia's - Instalacion
echo ===============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encuentra Node.js en este equipo.
  echo.
  echo Descargalo de https://nodejs.org ^(version LTS^), instalalo
  echo y vuelve a ejecutar este archivo.
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set VERSION=%%v
echo Node.js detectado: %VERSION%
echo.
echo Instalando dependencias y preparando la base de datos...
echo Esto tarda unos minutos la primera vez.
echo.

call npm.cmd run setup
if errorlevel 1 (
  echo.
  echo [ERROR] La instalacion no ha terminado bien. Revisa el texto de arriba.
  echo.
  pause
  exit /b 1
)

echo.
echo ===============================================
echo   Listo. Ya puedes usar ARRANCAR.bat
echo ===============================================
echo.
pause
