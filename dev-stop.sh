#!/bin/bash

# Script para detener el entorno de desarrollo
# Uso: ./dev-stop.sh

echo "🛑 Deteniendo entorno de desarrollo ExalinkHub..."

# Verificar si docker-compose está disponible
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: docker-compose no está instalado"
    exit 1
fi

# Detener servicios
docker-compose -f docker-compose.dev.yml down

echo "✅ Servicios detenidos"
echo
echo "💡 Para reiniciar: ./dev-start.sh"
echo "💡 Para limpiar contenedores: ./dev-clean.sh"