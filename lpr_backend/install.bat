@echo off
REM Script de instalación del Sistema LPR Backend para Windows
REM Este script configura e instala todas las dependencias necesarias

echo === Instalación del Sistema LPR Backend ===
echo.

REM Verificar Python
echo 1. Verificando Python...
python --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('python --version') do echo ✓ Python disponible: %%i
) else (
    echo ✗ Error: Python no está instalado o no está en el PATH
    pause
    exit /b 1
)

REM Verificar pip
echo.
echo 2. Verificando pip...
pip --version >nul 2>&1
if %errorlevel% equ 0 (
    for /f "tokens=*" %%i in ('pip --version') do echo ✓ pip disponible: %%i
) else (
    echo ✗ Error: pip no está disponible
    pause
    exit /b 1
)

REM Instalar dependencias
echo.
echo 3. Instalando dependencias Python...
cd /d "%~dp0"
pip install -r requirements.txt

if %errorlevel% equ 0 (
    echo ✓ Dependencias instaladas correctamente
) else (
    echo ✗ Error instalando dependencias
    pause
    exit /b 1
)

REM Crear directorios
echo.
echo 4. Creando directorios necesarios...
if not exist "data" mkdir data
if not exist "logs" mkdir logs
echo ✓ Directorios creados

REM Configurar base de datos
echo.
echo 5. Configurando base de datos...
python -c "from app.database import engine, Base; from app.models import PlateEvent, LPRSettings; Base.metadata.create_all(bind=engine); print('✓ Tablas de base de datos creadas')" 2>nul

if %errorlevel% equ 0 (
    echo ✓ Base de datos configurada
) else (
    echo ⚠ Warning: Error configurando base de datos ^(se creará automáticamente al iniciar^)
)

echo.
echo === Instalación Completada ===
echo.
echo Para iniciar el servidor LPR:
echo   python app/main.py
echo.
echo O con uvicorn:
echo   uvicorn app.main:app --host localhost --port 2221 --reload
echo.
echo El servidor estará disponible en: http://localhost:2221
echo Documentación API: http://localhost:2221/docs
echo.
pause