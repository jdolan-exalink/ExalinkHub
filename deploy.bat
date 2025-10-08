@echo off
echo ========================================
echo    DESPLIEGUE DEL SISTEMA EXALINK
echo ========================================
echo.

cd /d "%~dp0"

echo [1/4] Deteniendo servicios existentes...
docker compose down

echo.
echo [2/4] Construyendo imagenes...
docker compose build --no-cache

echo.
echo [3/4] Iniciando servicios backend...
docker compose up -d lpr-backend lpr-redis conteo-backend notificaciones-backend

echo.
echo [4/4] Iniciando frontend...
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