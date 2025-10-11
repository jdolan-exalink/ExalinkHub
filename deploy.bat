@echo off
echo ========================================
echo    DESPLIEGUE DEL SISTEMA EXALINK
echo ========================================
echo.

cd /d "%~dp0"

echo [1/5] Sincronizando codigo fuente...
call sync-frontend.bat
if errorlevel 1 (
    echo [ERROR] Error al sincronizar codigo fuente
    pause
    exit /b 1
)

echo.
echo [2/5] Deteniendo servicios existentes...
docker compose down

echo.
echo [3/5] Construyendo imagenes...
docker compose build --no-cache

echo.
echo [4/5] Iniciando servicios backend...
docker compose up -d lpr-backend lpr-redis conteo-backend notificaciones-backend

echo.
echo [5/5] Iniciando frontend...
docker compose up -d frontend

echo.
echo ========================================
echo    DESPLIEGUE COMPLETADO
echo ========================================
echo.
echo Servicios disponibles en:
echo - Frontend:    http://localhost:9002
echo - LPR API:     http://localhost:2221
echo - Conteo API:  http://localhost:2223
echo - Notif API:   http://localhost:2224
echo.
echo Para ver logs: docker compose logs -f
echo Para detener: docker compose down
echo.
pause