@echo off
echo ========================================
echo Reconstruyendo Backend LPR
echo ========================================
echo.

echo [1/3] Deteniendo contenedor lpr-backend...
docker stop exalink-lpr-backend
echo   ✓ Contenedor detenido

echo [2/3] Reconstruyendo imagen del backend LPR...
docker-compose build --no-cache lpr-backend
echo   ✓ Imagen reconstruida

echo [3/3] Iniciando contenedor lpr-backend...
docker-compose up -d lpr-backend
echo   ✓ Contenedor iniciado

echo.
echo ========================================
echo Reconstrucción completada
echo ========================================
echo.
echo Verificando logs del backend LPR...
timeout /t 5 >nul
docker logs --tail 30 exalink-lpr-backend
echo.
echo Para ver logs en tiempo real:
echo   docker logs -f exalink-lpr-backend
echo.
pause
