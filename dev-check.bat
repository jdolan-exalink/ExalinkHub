@echo off
REM Script para verificar configuración de desarrollo
REM Uso: .\dev-check.bat

echo 🔍 Verificando configuración de desarrollo ExalinkHub
echo ====================================================
echo.

REM Verificar Docker
echo 🐳 Verificando Docker...
docker --version
if %errorlevel% neq 0 (
    echo ❌ Docker no está instalado o no está corriendo
    goto :error
)
echo ✅ Docker OK
echo.

REM Verificar Docker Compose
echo 🐳 Verificando Docker Compose...
docker-compose --version
if %errorlevel% neq 0 (
    echo ❌ Docker Compose no está disponible
    goto :error
)
echo ✅ Docker Compose OK
echo.

REM Verificar archivos de configuración
echo 📁 Verificando archivos de configuración...

if not exist "docker-compose.dev.yml" (
    echo ❌ Falta docker-compose.dev.yml
    goto :error
)
echo ✅ docker-compose.dev.yml encontrado

if not exist "Dockerfile.dev" (
    echo ❌ Falta Dockerfile.dev
    goto :error
)
echo ✅ Dockerfile.dev encontrado

if not exist "package.json" (
    echo ❌ Falta package.json
    goto :error
)
echo ✅ package.json encontrado

if not exist "src\" (
    echo ❌ Falta directorio src/
    goto :error
)
echo ✅ Directorio src/ encontrado

if not exist "backend\" (
    echo ❌ Falta directorio backend/
    goto :error
)
echo ✅ Directorio backend/ encontrado

echo.

REM Verificar servicios en docker-compose
echo 🔧 Verificando servicios en docker-compose.dev.yml...
docker-compose -f docker-compose.dev.yml config --services
echo.

REM Verificar puertos disponibles
echo 🌐 Verificando puertos...
powershell -Command "try { $conn = New-Object System.Net.Sockets.TcpClient; $conn.Connect('localhost', 9002); echo '⚠️  Puerto 9002 (frontend) está en uso'; $conn.Close() } catch { echo '✅ Puerto 9002 (frontend) disponible' }" 2>nul
powershell -Command "try { $conn = New-Object System.Net.Sockets.TcpClient; $conn.Connect('localhost', 2221); echo '⚠️  Puerto 2221 (LPR backend) está en uso'; $conn.Close() } catch { echo '✅ Puerto 2221 (LPR backend) disponible' }" 2>nul
powershell -Command "try { $conn = New-Object System.Net.Sockets.TcpClient; $conn.Connect('localhost', 2223); echo '⚠️  Puerto 2223 (conteo backend) está en uso'; $conn.Close() } catch { echo '✅ Puerto 2223 (conteo backend) disponible' }" 2>nul
powershell -Command "try { $conn = New-Object System.Net.Sockets.TcpClient; $conn.Connect('localhost', 2224); echo '⚠️  Puerto 2224 (notificaciones backend) está en uso'; $conn.Close() } catch { echo '✅ Puerto 2224 (notificaciones backend) disponible' }" 2>nul

echo.
echo ✅ Verificación completada exitosamente
echo.
echo 💡 Para iniciar desarrollo: .\dev-start.bat
echo 💡 Para ver logs: .\dev-logs.bat
echo 💡 Para ver estado: .\dev-status.bat

goto :end

:error
echo.
echo ❌ Verificación fallida - corrige los errores antes de continuar
pause
exit /b 1

:end
pause