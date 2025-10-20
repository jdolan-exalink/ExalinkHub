@echo off
REM Script para detener el entorno de desarrollo
REM Uso: .\dev-stop.bat

echo 🛑 Deteniendo entorno de desarrollo ExalinkHub...

REM Verificar si docker-compose está disponible
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: docker-compose no está instalado
    exit /b 1
)

REM Detener servicios
docker-compose -f docker-compose.dev.yml down

echo ✅ Servicios detenidos
echo.
echo 💡 Para reiniciar: .\dev-start.bat
echo 💡 Para limpiar contenedores: .\dev-clean.bat

pause