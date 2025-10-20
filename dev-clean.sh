#!/bin/bash

# Script para limpiar contenedores e imágenes de desarrollo
# Uso: ./dev-clean.sh

echo "🧹 Limpiando entorno de desarrollo ExalinkHub..."

# Verificar si docker-compose está disponible
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: docker-compose no está instalado"
    exit 1
fi

echo "🛑 Deteniendo servicios..."
docker-compose -f docker-compose.dev.yml down

echo "🗑️  Eliminando contenedores..."
docker-compose -f docker-compose.dev.yml down --volumes --remove-orphans

echo "🖼️  Eliminando imágenes de desarrollo..."
docker rmi exalink-frontend-dev 2>/dev/null || true
docker rmi exalink/matriculas-listener-dev 2>/dev/null || true
docker rmi exalink/conteo-backend-dev 2>/dev/null || true
docker rmi exalink/notificaciones-backend-dev 2>/dev/null || true

echo "✅ Limpieza completada"
echo
echo "💡 Para reiniciar desde cero: ./dev-start.sh"