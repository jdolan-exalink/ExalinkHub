@echo off
REM Script para ver el estado de los servicios de desarrollo
REM Servicios backend en Docker + Frontend local
REM Uso: .\dev-status.bat

echo 📊 Estado de servicios de desarrollo ExalinkHub
echo ===============================================
echo.

REM Verificar estado del frontend (Node.js)
echo ⚛️ Frontend (local):
tasklist /fi "imagename eq node.exe" /fo table | findstr node >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Node.js está corriendo
    for /f "tokens=2" %%i in ('tasklist /fi "imagename eq node.exe" /fo table ^| findstr node') do (
        echo    PID: %%i
    )
) else (
    echo ❌ Node.js no está corriendo
)
echo    Puerto esperado: 9002
echo.

REM Verificar si docker-compose está disponible
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: docker-compose no está disponible
    goto :end
)

echo 🐳 Servicios Docker:
docker-compose -f docker-compose.dev.yml ps
echo.

echo 🔍 Estado detallado:
echo.
docker-compose -f docker-compose.dev.yml ps --format "table {{.Name}}\t{{.Service}}\t{{.Status}}\t{{.Ports}}"
echo.

echo 📈 Uso de recursos Docker:
echo.
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}" 2>nul | findstr exalink
if %errorlevel% neq 0 (
    echo No se encontraron contenedores corriendo
)
echo.

echo 🌐 Puertos disponibles:
echo Frontend:    http://localhost:9002 (local)
echo Backend LPR: http://localhost:2221 (Docker)
echo Backend Conteo: http://localhost:2223 (Docker)
echo Backend Notificaciones: http://localhost:2224 (Docker)
echo.

:end
pause