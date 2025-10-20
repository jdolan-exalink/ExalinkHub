@echo off
REM Script para iniciar el entorno de desarrollo con Docker Compose
REM Uso: .\dev-start.bat

echo 🚀 Iniciando entorno de desarrollo ExalinkHub...
echo.

REM Verificar si docker-compose está disponible
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: docker-compose no está instalado o no está en el PATH
    echo Por favor instala Docker Desktop o docker-compose
    pause
    exit /b 1
)

REM Verificar si docker está ejecutándose
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Docker no está ejecutándose
    echo Por favor inicia Docker Desktop
    pause
    exit /b 1
)

echo ✅ Docker está disponible
echo.

REM Crear directorios necesarios si no existen
if not exist "DB" mkdir DB
if not exist "MEDIA" mkdir MEDIA
if not exist "LOG" mkdir LOG
if not exist "data" mkdir data

echo 📁 Directorios verificados/creados
echo.

REM Iniciar servicios de desarrollo
echo 🐳 Iniciando servicios con docker-compose.dev.yml...
echo.
echo 💡 Los cambios en el código se reflejarán automáticamente (hot reload)
echo 💡 Frontend: http://localhost:9002
echo 💡 Backend LPR: http://localhost:2221
echo 💡 Backend Conteo: http://localhost:2223
echo 💡 Backend Notificaciones: http://localhost:2224
echo.
echo 🔄 Para detener: Ctrl+C o .\dev-stop.bat
echo.

docker-compose -f docker-compose.dev.yml up --build

pause