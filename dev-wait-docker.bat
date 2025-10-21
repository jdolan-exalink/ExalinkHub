@echo off
echo Esperando que Docker esté disponible...

:check_docker
docker ps >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker aún no está disponible. Esperando 5 segundos...
    timeout /t 5 /nobreak >nul
    goto check_docker
)

echo Docker está listo! Iniciando entorno de desarrollo...
call .\dev-start.bat