@echo off
REM Script para limpiar contenedores e imágenes de desarrollo
REM Uso: .\dev-clean.bat

echo 🧹 Limpiando entorno de desarrollo ExalinkHub...

REM Verificar si docker-compose está disponible
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: docker-compose no está instalado
    exit /b 1
)

echo 🛑 Deteniendo servicios...
docker-compose -f docker-compose.dev.yml down

echo 🗑️  Eliminando contenedores...
docker-compose -f docker-compose.dev.yml down --volumes --remove-orphans

echo 🖼️  Eliminando imágenes de desarrollo...
docker rmi exalink-frontend-dev 2>nul
docker rmi exalink/matriculas-listener-dev 2>nul
docker rmi exalink/conteo-backend-dev 2>nul
docker rmi exalink/notificaciones-backend-dev 2>nul

echo ✅ Limpieza completada
echo.
echo 💡 Para reiniciar desde cero: .\dev-start.bat

pause