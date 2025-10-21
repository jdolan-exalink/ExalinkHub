@echo off
REM Script para detener el entorno de desarrollo
REM Detiene servicios Docker y proceso de Node.js del frontend
REM Uso: .\dev-stop.bat

echo 🛑 Deteniendo entorno de desarrollo ExalinkHub...

REM Detener proceso de Node.js (frontend)
echo 🔄 Deteniendo proceso de Node.js...
taskkill /f /im node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Proceso de Node.js detenido
) else (
    echo ℹ️ No se encontraron procesos de Node.js corriendo
)
echo.

REM Verificar si docker-compose está disponible
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: docker-compose no está instalado
    exit /b 1
)

REM Detener servicios Docker
echo 🐳 Deteniendo servicios Docker...
docker-compose -f docker-compose.dev.yml down

echo ✅ Servicios Docker detenidos
echo.

echo 💡 Para reiniciar: .\dev-start.bat
echo 💡 Para limpiar contenedores: .\dev-clean.bat

pause