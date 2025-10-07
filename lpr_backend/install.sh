#!/bin/bash

# Script de instalación del Sistema LPR Backend
# Este script configura e instala todas las dependencias necesarias

echo "=== Instalación del Sistema LPR Backend ==="
echo ""

# Verificar Python
echo "1. Verificando Python..."
python_version=$(python --version 2>&1)
if [ $? -eq 0 ]; then
    echo "✓ Python disponible: $python_version"
else
    echo "✗ Error: Python no está instalado o no está en el PATH"
    exit 1
fi

# Verificar pip
echo ""
echo "2. Verificando pip..."
pip_version=$(pip --version 2>&1)
if [ $? -eq 0 ]; then
    echo "✓ pip disponible: $pip_version"
else
    echo "✗ Error: pip no está disponible"
    exit 1
fi

# Instalar dependencias
echo ""
echo "3. Instalando dependencias Python..."
cd "$(dirname "$0")"
pip install -r requirements.txt

if [ $? -eq 0 ]; then
    echo "✓ Dependencias instaladas correctamente"
else
    echo "✗ Error instalando dependencias"
    exit 1
fi

# Crear directorio de datos si no existe
echo ""
echo "4. Creando directorio de datos..."
mkdir -p data
mkdir -p logs
echo "✓ Directorios creados"

# Configurar base de datos
echo ""
echo "5. Configurando base de datos..."
python -c "
from app.database import engine, Base
from app.models import PlateEvent, LPRSettings

# Crear tablas
Base.metadata.create_all(bind=engine)
print('✓ Tablas de base de datos creadas')
"

if [ $? -eq 0 ]; then
    echo "✓ Base de datos configurada"
else
    echo "⚠ Warning: Error configurando base de datos (se creará automáticamente al iniciar)"
fi

echo ""
echo "=== Instalación Completada ==="
echo ""
echo "Para iniciar el servidor LPR:"
echo "  python app/main.py"
echo ""
echo "O con uvicorn:"
echo "  uvicorn app.main:app --host localhost --port 2221 --reload"
echo ""
echo "El servidor estará disponible en: http://localhost:2221"
echo "Documentación API: http://localhost:2221/docs"
echo ""