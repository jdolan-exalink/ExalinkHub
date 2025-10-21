@echo off
REM Script para iniciar solo el frontend en modo desarrollo
REM Uso: .\dev-frontend.bat

echo ⚛️ Iniciando frontend ExalinkHub en modo desarrollo...
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

REM Instalar dependencias si node_modules no existe
if not exist "node_modules" (
    echo 📦 Instalando dependencias...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Error instalando dependencias
        pause
        exit /b 1
    )
    echo ✅ Dependencias instaladas
    echo.
)

echo 🚀 Iniciando servidor de desarrollo...
echo 💡 Frontend: http://localhost:9002
echo 💡 Hot reload automático activado
echo 💡 Presiona Ctrl+C para detener
echo.

npm run dev