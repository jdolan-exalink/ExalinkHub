#!/bin/bash

# Script de inicialización para ExalinkHub
# Este script configura las bases de datos y configuraciones iniciales

set -e

echo "🚀 Iniciando configuración de ExalinkHub..."

# Crear directorios necesarios
echo "📁 Creando directorios..."
mkdir -p DB
mkdir -p data
mkdir -p lpr_backend

# Verificar si las bases de datos existen, si no, inicializarlas
echo "🗄️ Verificando bases de datos..."

# Base de datos de configuración
if [ ! -f "DB/config.db" ]; then
    echo "📋 Inicializando base de datos de configuración..."
    # Aquí podríamos ejecutar scripts de inicialización si existen
    touch DB/config.db
fi

# Base de datos de conteo
if [ ! -f "DB/counting.db" ]; then
    echo "🔢 Inicializando base de datos de conteo..."
    touch DB/counting.db
fi

# Base de datos de matrículas
if [ ! -f "DB/matriculas.db" ]; then
    echo "🚗 Inicializando base de datos de matrículas..."
    touch DB/matriculas.db
fi

# Base de datos de lecturas LPR
if [ ! -f "data/lpr-readings.db" ]; then
    echo "📖 Inicializando base de datos de lecturas LPR..."
    touch data/lpr-readings.db
fi

# Configurar permisos
echo "🔐 Configurando permisos..."
chmod 777 DB/*.db 2>/dev/null || true
chmod 777 data/*.db 2>/dev/null || true
chmod 755 DB
chmod 755 data

echo "✅ Configuración inicial completada!"
echo ""
echo "🎯 Servicios disponibles:"
echo "  - Frontend: http://localhost:9002"
echo "  - LPR Backend: http://localhost:2221"
echo "  - Conteo Backend: http://localhost:2223"
echo "  - Notificaciones Backend: http://localhost:2224"
echo ""
echo "📚 Para acceder al dashboard principal: http://localhost:9002/es/dashboard"