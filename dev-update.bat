@echo off
REM Script para actualizar código y reconstruir contenedores
REM Uso: .\dev-update.bat

echo 🔄 Actualizando entorno de desarrollo ExalinkHub
echo ===============================================
echo.

REM Verificar si hay cambios en git
echo 📋 Verificando cambios en git...
git status --porcelain
if %errorlevel% equ 0 (
    echo ✅ No hay cambios pendientes
) else (
    echo ⚠️  Hay cambios pendientes - considera hacer commit
)
echo.

REM Sincronizar frontend-build
echo 🔄 Sincronizando frontend-build...
if exist "sync-frontend.bat" (
    call sync-frontend.bat
    if %errorlevel% neq 0 (
        echo ❌ Error en sincronización de frontend
        goto :error
    )
) else (
    echo ⚠️  Script sync-frontend.bat no encontrado, omitiendo sincronización
)
echo ✅ Sincronización completada
echo.

REM Detener servicios actuales
echo 🛑 Deteniendo servicios actuales...
docker-compose -f docker-compose.dev.yml down
echo.

REM Reconstruir e iniciar servicios
echo 🏗️  Reconstruyendo servicios...
docker-compose -f docker-compose.dev.yml up -d --build
if %errorlevel% neq 0 (
    echo ❌ Error al reconstruir servicios
    goto :error
)
echo.

REM Verificar estado
echo 📊 Verificando estado de servicios...
timeout /t 5 /nobreak >nul
docker-compose -f docker-compose.dev.yml ps
echo.

echo ✅ Actualización completada exitosamente
echo.
echo 🌐 Servicios disponibles en:
echo Frontend:    http://localhost:9002
echo Backend LPR: http://localhost:2221
echo.

goto :end

:error
echo.
echo ❌ Error durante la actualización
pause
exit /b 1

:end
pause