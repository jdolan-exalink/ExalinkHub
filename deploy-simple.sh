#!/bin/bash

# Script simple para despliegue en Linux
# Uso: ./deploy-simple.sh

echo "🚀 Desplegando ExalinkHub..."

# Cambiar al directorio del script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "📁 Ejecutando desde: $SCRIPT_DIR"

# Verificar archivos necesarios
if [ ! -f "docker-compose.yml" ]; then
    echo "❌ Error: docker-compose.yml no encontrado"
    exit 1
fi

# Verificar Docker
if ! docker info >/dev/null 2>&1; then
    echo "❌ Error: Docker no está corriendo"
    exit 1
fi

echo "🐳 Docker OK"

# Ejecutar despliegue
echo "🏗️  Construyendo y levantando servicios..."
if docker compose up -d --build; then
    echo "✅ Despliegue completado!"
    echo ""
    echo "🌐 Servicios disponibles:"
    echo "• Frontend: http://localhost:9002"
    echo "• LPR API:  http://localhost:2221"
    echo "• Conteo:   http://localhost:2223"
    echo ""
    echo "📊 Ver estado: docker compose ps"
    echo "📝 Ver logs:   docker compose logs -f"
else
    echo "❌ Error en el despliegue"
    exit 1
fi