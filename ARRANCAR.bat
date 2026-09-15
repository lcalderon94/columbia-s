@echo off
REM Arranca Columbia's y abre la aplicacion en el navegador.
REM Doble clic para empezar el turno. Cierra esta ventana para apagarlo.

chcp 65001 >nul
cd /d "%~dp0"

if not exist "node_modules" (
  echo.
  echo [ERROR] Falta la instalacion. Ejecuta primero INSTALAR.bat
  echo.
  pause
  exit /b 1
)

echo.
echo ===============================================
echo   Columbia's - Arrancando
echo ===============================================
echo.
echo La aplicacion se abrira sola en el navegador.
echo.
echo NO CIERRES ESTA VENTANA mientras el local este abierto:
echo si la cierras, se apaga el programa.
echo.

REM Da margen a que el servidor levante antes de abrir el navegador
start "" /b cmd /c "timeout /t 8 >nul && start http://localhost:5173"

call npm.cmd run dev

echo.
echo El programa se ha detenido.
pause
