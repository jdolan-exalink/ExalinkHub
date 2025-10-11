@echo off
echo ========================================
echo    SINCRONIZACIÓN DE CÓDIGO FUENTE
echo ========================================
echo.

REM Verificar que estamos en el directorio correcto
if not exist "src" (
    echo [ERROR] Directorio 'src' no encontrado. Ejecuta este script desde la raíz del proyecto.
    exit /b 1
)

if not exist "frontend-build" (
    echo [ERROR] Directorio 'frontend-build' no encontrado.
    exit /b 1
)

echo [INFO] Sincronizando código fuente...

REM Sincronizar directorio src/
echo [INFO] Copiando src\ a frontend-build\src\...
if exist frontend-build\src rmdir /s /q frontend-build\src
xcopy src\* frontend-build\src\ /s /e /i /y >nul

REM Sincronizar archivos de configuración importantes
echo [INFO] Sincronizando archivos de configuración...

set FILES_TO_SYNC=package.json package-lock.json next.config.ts next-intl.config.mjs tailwind.config.ts postcss.config.mjs tsconfig.json middleware.ts i18n.ts components.json

for %%f in (%FILES_TO_SYNC%) do (
    if exist "%%f" (
        copy "%%f" "frontend-build\%%f" >nul
        echo [INFO] Copiado: %%f
    ) else (
        echo [WARN] Archivo no encontrado: %%f
    )
)

REM Sincronizar directorios adicionales
echo [INFO] Sincronizando directorios adicionales...

set DIRS_TO_SYNC=messages public

for %%d in (%DIRS_TO_SYNC%) do (
    if exist "%%d" (
        if exist "frontend-build\%%d" rmdir /s /q "frontend-build\%%d"
        xcopy "%%d" "frontend-build\%%d\" /s /e /i /y >nul
        echo [INFO] Sincronizado: %%d\
    ) else (
        echo [WARN] Directorio no encontrado: %%d
    )
)

echo [INFO] Sincronización completada exitosamente ✓
echo.
echo ========================================
echo    LISTO PARA DESPLIEGUE
echo ========================================
echo.

pause