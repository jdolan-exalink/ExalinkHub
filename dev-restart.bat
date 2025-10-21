@echo off
REM Script para reiniciar servicios de desarrollo
REM Uso: .\dev-restart.bat [servicio]
REM Si no se especifica servicio, reinicia todos

if "%1"=="" (
    echo 🔄 Reiniciando todos los servicios de desarrollo...
    docker-compose -f docker-compose.dev.yml restart
) else (
    echo 🔄 Reiniciando servicio: %1
    docker-compose -f docker-compose.dev.yml restart %1
)

echo.
echo ✅ Servicios reiniciados
echo.

REM Mostrar estado después del reinicio
timeout /t 2 /nobreak >nul
docker-compose -f docker-compose.dev.yml ps --format "table {{.Name}}\t{{.Service}}\t{{.Status}}"