@echo off
REM Script de despliegue completo para Sistema LPR con Docker (Windows)
REM Automatiza build, deploy y gestión del stack de contenedores

setlocal enabledelayedexpansion

REM Configuración
set PROJECT_NAME=exalink-lpr
set COMPOSE_FILE=docker-compose.yml
set ENV_FILE=.env

REM Verificar prerrequisitos
:check_prerequisites
echo [INFO] Verificando prerrequisitos...

docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker no está instalado
    exit /b 1
)

docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Docker Compose no está instalado
    exit /b 1
)

if not exist "%ENV_FILE%" (
    echo [WARNING] Archivo .env no encontrado, creando desde ejemplo...
    if exist ".env.example" (
        copy .env.example .env >nul
        echo [INFO] Archivo .env creado. Revisa la configuración antes de continuar.
    ) else (
        echo [ERROR] Archivo .env.example no encontrado
        exit /b 1
    )
)

echo [SUCCESS] Prerrequisitos verificados
goto :eof

REM Construir imágenes
:build_images
echo [INFO] Construyendo imágenes Docker...
docker-compose build --no-cache lpr-backend
if %errorlevel% equ 0 (
    echo [SUCCESS] Imágenes construidas exitosamente
) else (
    echo [ERROR] Error construyendo imágenes
    exit /b 1
)
goto :eof

REM Desplegar servicios
:deploy_services
echo [INFO] Desplegando servicios...

REM Crear redes si no existen
docker network create exalink-lpr-network 2>nul
docker network create exalink-public 2>nul

REM Iniciar servicios
docker-compose up -d lpr-redis lpr-backend
if %errorlevel% neq 0 (
    echo [ERROR] Error desplegando servicios
    docker-compose logs
    exit /b 1
)

echo [INFO] Esperando a que los servicios estén listos...
timeout /t 10 /nobreak >nul

REM Verificar servicios
docker-compose ps | findstr "Up" >nul
if %errorlevel% equ 0 (
    echo [SUCCESS] Servicios desplegados exitosamente
) else (
    echo [ERROR] Error en el despliegue de servicios
    docker-compose logs
    exit /b 1
)
goto :eof

REM Verificar estado de servicios
:check_services
echo [INFO] Verificando estado de servicios...
echo Estado de contenedores:
docker-compose ps

echo.
echo Estado de salud del backend LPR:
curl -f http://localhost:2221/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [SUCCESS] Backend LPR responde correctamente
) else (
    echo [WARNING] Backend LPR no responde en el puerto 2221
)
goto :eof

REM Mostrar logs
:show_logs
set service=%1
if "%service%"=="" (
    echo [INFO] Mostrando logs de todos los servicios...
    docker-compose logs -f --tail=50
) else (
    echo [INFO] Mostrando logs de %service%...
    docker-compose logs -f --tail=50 %service%
)
goto :eof

REM Detener servicios
:stop_services
echo [INFO] Deteniendo servicios...
docker-compose down
echo [SUCCESS] Servicios detenidos
goto :eof

REM Limpiar sistema
:cleanup
echo [INFO] Limpiando sistema...
docker-compose down -v
docker image prune -f
docker volume prune -f
echo [SUCCESS] Sistema limpiado
goto :eof

REM Backup de datos
:backup_data
set backup_dir=backups\%date:~6,4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set backup_dir=%backup_dir: =0%

echo [INFO] Creando backup en %backup_dir%...
mkdir "%backup_dir%" 2>nul

REM Backup de volúmenes Docker
docker run --rm -v "%cd%\%backup_dir%:/backup" -v "exalink-lpr_lpr-data:/data:ro" alpine tar czf /backup/lpr-data.tar.gz -C /data .

REM Backup de configuración
copy .env "%backup_dir%\" >nul
copy docker-compose.yml "%backup_dir%\" >nul

echo [SUCCESS] Backup creado en %backup_dir%
goto :eof

REM Mostrar ayuda
:show_help
echo Script de gestión Docker para Sistema LPR
echo.
echo Uso: %~nx0 [comando] [opciones]
echo.
echo Comandos disponibles:
echo   deploy        - Desplegar sistema completo
echo   build         - Construir imágenes Docker
echo   start         - Iniciar servicios
echo   stop          - Detener servicios
echo   restart       - Reiniciar servicios
echo   status        - Mostrar estado de servicios
echo   logs [service]- Mostrar logs (opcional: servicio específico^)
echo   cleanup       - Limpiar sistema
echo   backup        - Crear backup de datos
echo   shell [service]- Acceder a shell del contenedor
echo.
echo Ejemplos:
echo   %~nx0 deploy                    # Despliegue completo
echo   %~nx0 logs lpr-backend         # Logs del backend
echo   %~nx0 shell lpr-backend        # Shell del backend
goto :eof

REM Función principal
set command=%1

if "%command%"=="deploy" (
    call :check_prerequisites
    call :build_images
    call :deploy_services
    call :check_services
) else if "%command%"=="build" (
    call :check_prerequisites
    call :build_images
) else if "%command%"=="start" (
    docker-compose up -d
    call :check_services
) else if "%command%"=="stop" (
    call :stop_services
) else if "%command%"=="restart" (
    docker-compose restart
    call :check_services
) else if "%command%"=="status" (
    call :check_services
) else if "%command%"=="logs" (
    call :show_logs %2
) else if "%command%"=="cleanup" (
    call :cleanup
) else if "%command%"=="backup" (
    call :backup_data
) else if "%command%"=="shell" (
    set service=%2
    if "!service!"=="" set service=lpr-backend
    docker-compose exec !service! /bin/bash
) else if "%command%"=="help" (
    call :show_help
) else if "%command%"=="-h" (
    call :show_help
) else if "%command%"=="--help" (
    call :show_help
) else if "%command%"=="" (
    call :show_help
) else (
    echo [ERROR] Comando no reconocido: %command%
    call :show_help
    exit /b 1
)

endlocal