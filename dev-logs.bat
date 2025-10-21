@echo off
REM Script para ver logs de servicios de desarrollo
REM Uso: .\dev-logs.bat [servicio] [lineas] [follow]
REM Ejemplos:
REM   .\dev-logs.bat              - Logs de todos los servicios backend (ultimas 100 lineas)
REM   .\dev-logs.bat matriculas-listener - Logs del backend LPR (ultimas 100 lineas)
REM   .\dev-logs.bat frontend     - Info sobre logs del frontend (corre localmente)
REM   .\dev-logs.bat conteo-backend 50  - Ultimas 50 lineas del backend conteo

if "%1"=="" (
    echo Mostrando logs de todos los servicios backend (ultimas 100 lineas)...
    docker-compose -f docker-compose.dev.yml logs --tail=100
) else (
    if "%1"=="frontend" (
        echo 📋 Información sobre logs del frontend:
        echo.
        echo El frontend corre directamente con 'npm run dev' (no en Docker)
        echo Para ver los logs del frontend:
        echo.
        echo 1. Si está corriendo en otra terminal/consola:
        echo    - Los logs se muestran en la terminal donde ejecutaste 'npm run dev'
        echo.
        echo 2. Para ver logs en tiempo real:
        echo    - Ejecuta: npm run dev
        echo.
        echo 3. Para verificar si está corriendo:
        echo    - tasklist ^| findstr node
        echo    - O visita: http://localhost:9002
        echo.
    ) else (
        if "%2"=="" (
            echo Mostrando logs del servicio '%1' (ultimas 100 lineas)...
            docker-compose -f docker-compose.dev.yml logs --tail=100 %1
        ) else (
            if "%3"=="follow" (
                echo Siguiendo logs del servicio '%1'...
                docker-compose -f docker-compose.dev.yml logs -f --tail=%2 %1
            ) else (
                echo Mostrando logs del servicio '%1' (ultimas %2 lineas)...
                docker-compose -f docker-compose.dev.yml logs --tail=%2 %1
            )
        )
    )
)