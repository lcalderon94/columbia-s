@echo off
REM Arranca Columbia's para el local: un solo programa que sirve el mostrador
REM y las tablets de cocina y barra por la red del local.

chcp 65001 >nul
cd /d "%~dp0"

if not exist "node_modules" (
  echo.
  echo [ERROR] Falta la instalacion. Ejecuta primero INSTALAR.bat
  echo.
  pause
  exit /b 1
)

if not exist "client\dist\index.html" goto compilar
if not exist "server\dist\index.js" goto compilar
goto arrancar

:compilar
echo.
echo Preparando la aplicacion ^(solo la primera vez^)...
echo.
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo [ERROR] No se ha podido preparar la aplicacion.
  pause
  exit /b 1
)

:arrancar
echo.
echo ===============================================
echo   Columbia's
echo ===============================================
echo.
echo NO CIERRES ESTA VENTANA mientras el local este abierto.
echo.

start "" /b cmd /c "timeout /t 5 >nul && start http://localhost:4000"

call npm.cmd start

echo.
echo El programa se ha detenido.
pause
