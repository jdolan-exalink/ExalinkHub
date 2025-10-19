@echo off
echo ========================================
echo Reconstruyendo Frontend con Docker CLI
echo ========================================
echo.

echo [1/3] Deteniendo contenedor frontend...
docker stop exalink-frontend
echo   ✓ Contenedor detenido

echo [2/3] Reconstruyendo imagen del frontend...
docker-compose build --no-cache frontend
echo   ✓ Imagen reconstruida

echo [3/3] Iniciando contenedor frontend...
docker-compose up -d frontend
echo   ✓ Contenedor iniciado

echo.
echo ========================================
echo Reconstrucción completada
echo ========================================
echo.
echo Verificando logs del frontend...
timeout /t 3 >nul
docker logs --tail 20 exalink-frontend
echo.
echo Para ver logs en tiempo real:
echo   docker logs -f exalink-frontend
echo.
pause
