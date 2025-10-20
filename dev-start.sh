#!/bin/bash

# Script para iniciar el entorno de desarrollo con Docker Compose
# Uso: ./dev-start.sh

echo "🚀 Iniciando entorno de desarrollo ExalinkHub..."
echo

# Verificar si docker-compose está disponible
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: docker-compose no está instalado o no está en el PATH"
    echo "Por favor instala Docker Desktop o docker-compose"
    exit 1
fi

# Verificar si docker está ejecutándose
if ! docker info &> /dev/null; then
    echo "❌ Error: Docker no está ejecutándose"
    echo "Por favor inicia Docker Desktop"
    exit 1
fi

echo "✅ Docker está disponible"
echo

# Crear directorios necesarios si no existen
mkdir -p DB MEDIA LOG data

echo "📁 Directorios verificados/creados"
echo

# Iniciar servicios de desarrollo
echo "🐳 Iniciando servicios con docker-compose.dev.yml..."
echo
echo "💡 Los cambios en el código se reflejarán automáticamente (hot reload)"
echo "💡 Frontend: http://localhost:9002"
echo "💡 Backend LPR: http://localhost:2221"
echo "💡 Backend Conteo: http://localhost:2223"
echo "💡 Backend Notificaciones: http://localhost:2224"
echo
echo "🔄 Para detener: Ctrl+C o ./dev-stop.sh"
echo

docker-compose -f docker-compose.dev.yml up --build