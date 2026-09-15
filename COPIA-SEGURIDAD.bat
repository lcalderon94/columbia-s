@echo off
REM Copia de seguridad de Columbia's: base de datos y recibos emitidos.
REM Conviene ejecutarlo al cerrar el local, o programarlo cada dia.

chcp 65001 >nul
cd /d "%~dp0"

set FECHA=%date:~-4%-%date:~3,2%-%date:~0,2%
set DESTINO=copias\%FECHA%

echo.
echo ===============================================
echo   Columbia's - Copia de seguridad
echo ===============================================
echo.

if not exist "server\prisma\columbias.db" (
  echo [ERROR] No se encuentra la base de datos.
  echo Ejecuta INSTALAR.bat primero.
  echo.
  pause
  exit /b 1
)

if not exist "%DESTINO%" mkdir "%DESTINO%"

copy /y "server\prisma\columbias.db" "%DESTINO%\" >nul
echo   Base de datos copiada

if exist "server\datos\recibos" (
  xcopy /e /i /y /q "server\datos\recibos" "%DESTINO%\recibos" >nul
  echo   Recibos copiados
) else (
  echo   Todavia no hay recibos emitidos
)

echo.
echo Copia guardada en: %DESTINO%
echo.
echo Guarda esa carpeta fuera del PC ^(disco externo o nube^).
echo.
pause
