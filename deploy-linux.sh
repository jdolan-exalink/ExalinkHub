#!/bin/bash

echo "========================================"
echo "   DESPLIEGUE DEL SISTEMA EXALINK"
echo "   (Versión Multi-Plataforma)"
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
    print_error "Docker no está corriendo. Por favor inicia Docker."
    exit 1
fi

print_status "Docker está disponible"

# IMPORTANTE: Cambiar al directorio del script para asegurar paths correctos
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_status "Ejecutando desde directorio: $SCRIPT_DIR"

# Verificar que estamos en el directorio correcto
if [ ! -f "docker-compose.yml" ]; then
    print_error "No se encuentra docker-compose.yml. Asegúrate de ejecutar desde el directorio raíz del proyecto."
    exit 1
fi

print_status "[1/4] Sincronizando código fuente..."
if [ -f "./sync-frontend.sh" ]; then
    if ! ./sync-frontend.sh; then
        print_error "Error al sincronizar código fuente"
        exit 1
    fi
elif [ -f "./sync-frontend.bat" ]; then
    # En Windows, intentar ejecutar el batch
    if ! ./sync-frontend.bat; then
        print_warning "No se pudo ejecutar sync-frontend.bat, continuando..."
    fi
else
    print_warning "No se encontró script de sincronización, continuando..."
fi

print_status "[2/4] Deteniendo servicios existentes..."
docker compose down

print_status "[3/4] Construyendo y levantando servicios..."
if ! docker compose up -d --build; then
    print_error "Error al construir/levantar los servicios"
    print_error "Revisa los logs con: docker compose logs"
    exit 1
fi

print_status "[4/4] Verificando estado de servicios..."
sleep 5

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

# Verificar estado final
print_status "Verificando estado final de los servicios..."
if docker compose ps | grep -q "Up\|running\|healthy"; then
    print_status "✓ Servicios funcionando correctamente"
else
    print_warning "⚠ Algunos servicios pueden estar iniciándose. Revisa con: docker compose ps"
fi