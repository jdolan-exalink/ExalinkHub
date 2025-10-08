#!/bin/bash
# ExalinkHub - Script de Inicio Rápido
# Este script facilita el despliegue completo del sistema

echo "🚀 Iniciando ExalinkHub..."

# Verificar si Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado. Por favor instala Docker primero."
    exit 1
fi

# Verificar si Docker Compose está instalado
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose no está instalado. Por favor instala Docker Compose primero."
    exit 1
fi

echo "📦 Construyendo y iniciando servicios..."

# Construir e iniciar todos los servicios
docker-compose up --build -d

echo "⏳ Esperando a que los servicios estén listos..."

# Esperar a que el frontend esté healthy
echo "🔍 Verificando estado del frontend..."
timeout=60
counter=0
while [ $counter -lt $timeout ]; do
    if curl -f http://localhost:9002/api/health &>/dev/null; then
        echo "✅ Frontend listo!"
        break
    fi
    echo "⏳ Esperando... ($counter/$timeout)"
    sleep 2
    ((counter++))
done

if [ $counter -eq $timeout ]; then
    echo "⚠️  El frontend tardó más de lo esperado. Verifica los logs con: docker-compose logs frontend"
fi

echo ""
echo "🎉 ¡ExalinkHub desplegado exitosamente!"
echo ""
echo "📊 Servicios disponibles:"
echo "   🖥️  Dashboard:     http://localhost:9002"
echo "   🚗 LPR Backend:    http://localhost:2221"
echo "   📊 Conteo:         http://localhost:2223"
echo "   📢 Notificaciones: http://localhost:2224"
echo ""
echo "📋 Comandos útiles:"
echo "   Ver estado:        docker-compose ps"
echo "   Ver logs:          docker-compose logs"
echo "   Detener:           docker-compose down"
echo "   Reiniciar:         docker-compose restart"
echo ""
echo "📖 Para desarrollo, restaura el override:"
echo "   mv docker-compose.override.yml.backup docker-compose.override.yml"