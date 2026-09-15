@echo off
REM Actualiza Columbia's despues de descargar cambios nuevos.

chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ===============================================
echo   Columbia's - Actualizar
echo ===============================================
echo.
echo Cierra ARRANCAR.bat antes de continuar.
echo.
pause

echo Descargando cambios...
git pull

echo.
echo Instalando y preparando...
call npm.cmd install
call npm.cmd run db:push
call npm.cmd run build
if errorlevel 1 (
  echo.
  echo [ERROR] La actualizacion no ha terminado bien.
  pause
  exit /b 1
)

echo.
echo Listo. Ya puedes abrir ARRANCAR.bat
echo.
pause
