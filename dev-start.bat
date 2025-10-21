@echo off
REM Script para iniciar el entorno de desarrollo
REM Servicios backend en Docker + Frontend en modo dev local
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

REM Verificar si Node.js está disponible
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Node.js no está instalado o no está en el PATH
    echo Por favor instala Node.js
    pause
    exit /b 1
)

REM Verificar si npm está disponible
npm --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: npm no está disponible
    echo Por favor verifica tu instalación de Node.js
    pause
    exit /b 1
)

echo ✅ Node.js y npm están disponibles
echo.

REM Crear directorios necesarios si no existen
if not exist "DB" mkdir DB
if not exist "MEDIA" mkdir MEDIA
if not exist "LOG" mkdir LOG
if not exist "data" mkdir data

echo 📁 Directorios verificados/creados
echo.

REM Instalar dependencias del frontend si node_modules no existe
if not exist "node_modules" (
    echo 📦 Instalando dependencias del frontend...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Error instalando dependencias
        pause
        exit /b 1
    )
    echo ✅ Dependencias instaladas
    echo.
)

REM Iniciar servicios backend con Docker
echo 🐳 Iniciando servicios backend con docker-compose.dev.yml...
echo.
docker-compose -f docker-compose.dev.yml up -d --build

if %errorlevel% neq 0 (
    echo ❌ Error iniciando servicios Docker
    pause
    exit /b 1
)

echo ✅ Servicios backend iniciados
echo.

REM Esperar un poco para que los servicios estén listos
echo ⏳ Esperando que los servicios backend estén listos...
timeout /t 10 /nobreak >nul

REM Iniciar frontend en modo desarrollo
echo ⚛️ Iniciando frontend en modo desarrollo...
echo.
echo 💡 Frontend: http://localhost:9002 (hot reload automático)
echo 💡 Backend LPR: http://localhost:2221
echo 💡 Backend Conteo: http://localhost:2223
echo 💡 Backend Notificaciones: http://localhost:2224
echo.
echo 🔄 Para detener: .\dev-stop.bat
echo 🔍 Para ver logs backend: .\dev-logs.bat [servicio]
echo 📊 Para ver estado: .\dev-status.bat
echo ⚛️ Para iniciar solo frontend: .\dev-frontend.bat
echo.

REM Iniciar frontend en background
start "ExalinkHub Frontend" cmd /c "npm run dev"

echo.
echo ✅ Entorno de desarrollo iniciado completamente!
echo 💡 Frontend corriendo en: http://localhost:9002
echo 💡 Servicios backend corriendo en Docker
echo � Los cambios en el código frontend se reflejan automáticamente
echo.