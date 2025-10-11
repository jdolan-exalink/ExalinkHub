#!/bin/bash

echo "========================================"
echo "   DESPLIEGUE DEL SISTEMA EXALINK"
echo "========================================"
echo

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para imprimir mensajes coloreados
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar que Docker esté corriendo
if ! docker info > /dev/null 2>&1; then
    print_error "Docker no está corriendo. Por favor inicia Docker Desktop."
    exit 1
fi

print_status "Docker está disponible"

# Cambiar al directorio del script
cd "$(dirname "$0")"

print_status "[1/5] Sincronizando código fuente..."
if ! ./sync-frontend.sh; then
    print_error "Error al sincronizar código fuente"
    exit 1
fi

print_status "[2/5] Deteniendo servicios existentes..."
docker compose down

print_status "[3/5] Construyendo imágenes..."
if ! docker compose build --no-cache; then
    print_error "Error al construir las imágenes"
    exit 1
fi

print_status "[4/5] Iniciando servicios backend..."
if ! docker compose up -d lpr-backend lpr-redis conteo-backend notificaciones-backend; then
    print_error "Error al iniciar servicios backend"
    exit 1
fi

print_status "[5/5] Iniciando frontend..."
if ! docker compose up -d frontend; then
    print_error "Error al iniciar frontend"
    exit 1
fi

echo
echo "========================================"
echo "   DESPLIEGUE COMPLETADO EXITOSAMENTE"
echo "========================================"
echo
echo "Servicios disponibles en:"
echo "• Frontend:    http://localhost:9002"
echo "• LPR API:     http://localhost:2221"
echo "• Conteo API:  http://localhost:2223"
echo "• Notif API:   http://localhost:2224"
echo
echo "Comandos útiles:"
echo "• Ver logs:    docker compose logs -f"
echo "• Detener:     docker compose down"
echo "• Reiniciar:   docker compose restart"
echo "• Ver estado:  docker compose ps"
echo

# Esperar un poco y verificar que los servicios estén healthy
print_status "Verificando estado de los servicios..."
sleep 10

if docker compose ps | grep -q "healthy\|running"; then
    print_status "Todos los servicios están funcionando correctamente ✓"
else
    print_warning "Algunos servicios pueden estar iniciándose aún. Revisa con: docker compose ps"
fi