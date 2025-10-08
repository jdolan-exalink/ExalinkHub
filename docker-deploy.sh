#!/bin/bash

# Script de despliegue completo para ExalinkHub con Docker
# Automatiza build, deploy y gestión del stack de contenedores

set -e

# Configuración
PROJECT_NAME="exalinkhub"
COMPOSE_FILE="docker-compose.yml"
ENV_FILE=".env"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Funciones de utilidad
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Verificar prerrequisitos
check_prerequisites() {
    log_info "Verificando prerrequisitos..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker no está instalado"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose no está instalado"
        exit 1
    fi
    
    if [ ! -f "$ENV_FILE" ]; then
        log_warning "Archivo .env no encontrado, creando desde ejemplo..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_info "Archivo .env creado. Revisa la configuración antes de continuar."
        else
            log_error "Archivo .env.example no encontrado"
            exit 1
        fi
    fi
    
    log_success "Prerrequisitos verificados"
}

# Construir imágenes
build_images() {
    log_info "Construyendo imágenes Docker..."
    
    docker-compose build --no-cache lpr-backend conteo-backend notificaciones-backend
    
    log_success "Imágenes construidas exitosamente"
}

# Desplegar servicios
deploy_services() {
    log_info "Desplegando servicios..."
    
    # Crear redes si no existen
    docker network create exalink-lpr-network 2>/dev/null || true
    docker network create exalink-public 2>/dev/null || true
    
    # Iniciar servicios base
    docker-compose up -d lpr-redis lpr-backend conteo-backend notificaciones-backend
    
    # Esperar a que los servicios estén listos
    log_info "Esperando a que los servicios estén listos..."
    sleep 15
    
    # Verificar salud de los servicios
    if docker-compose ps | grep -q "Up"; then
        log_success "Servicios desplegados exitosamente"
    else
        log_error "Error en el despliegue de servicios"
        docker-compose logs
        exit 1
    fi
}

# Verificar estado de servicios
check_services() {
    log_info "Verificando estado de servicios..."
    
    echo "Estado de contenedores:"
    docker-compose ps
    
    echo -e "\nEstado de salud de los backends:"
    
    # Verificar LPR backend
    if curl -f http://localhost:2221/health &> /dev/null; then
        log_success "Backend LPR responde correctamente"
    else
        log_warning "Backend LPR no responde en el puerto 2221"
    fi
    
    # Verificar Conteo backend
    if curl -f http://localhost:2223/health &> /dev/null; then
        log_success "Backend Conteo responde correctamente"
    else
        log_warning "Backend Conteo no responde en el puerto 2223"
    fi
    
    # Verificar Notificaciones backend
    if curl -f http://localhost:2224/health &> /dev/null; then
        log_success "Backend Notificaciones responde correctamente"
    else
        log_warning "Backend Notificaciones no responde en el puerto 2224"
    fi
}

# Mostrar logs
show_logs() {
    local service=${1:-}
    
    if [ -n "$service" ]; then
        log_info "Mostrando logs de $service..."
        docker-compose logs -f --tail=50 "$service"
    else
        log_info "Mostrando logs de todos los servicios..."
        docker-compose logs -f --tail=50
    fi
}

# Detener servicios
stop_services() {
    log_info "Deteniendo servicios..."
    docker-compose down
    log_success "Servicios detenidos"
}

# Limpiar sistema
cleanup() {
    log_info "Limpiando sistema..."
    
    # Detener y remover contenedores
    docker-compose down -v
    
    # Remover imágenes no utilizadas
    docker image prune -f
    
    # Remover volúmenes huérfanos
    docker volume prune -f
    
    log_success "Sistema limpiado"
}

# Backup de datos
backup_data() {
    local backup_dir="backups/$(date +%Y%m%d_%H%M%S)"
    
    log_info "Creando backup en $backup_dir..."
    
    mkdir -p "$backup_dir"
    
    # Backup de volúmenes Docker
    docker run --rm \
        -v "$(pwd)/${backup_dir}:/backup" \
        -v "exalink-lpr_lpr-data:/data:ro" \
        alpine tar czf /backup/lpr-data.tar.gz -C /data .
    
    # Backup de configuración
    cp .env "$backup_dir/"
    cp docker-compose.yml "$backup_dir/"
    
    log_success "Backup creado en $backup_dir"
}

# Restaurar desde backup
restore_data() {
    local backup_path=${1:-}
    
    if [ -z "$backup_path" ] || [ ! -d "$backup_path" ]; then
        log_error "Ruta de backup no válida: $backup_path"
        exit 1
    fi
    
    log_info "Restaurando desde $backup_path..."
    
    # Detener servicios
    docker-compose down
    
    # Restaurar datos
    if [ -f "$backup_path/lpr-data.tar.gz" ]; then
        docker run --rm \
            -v "$backup_path:/backup:ro" \
            -v "exalink-lpr_lpr-data:/data" \
            alpine tar xzf /backup/lpr-data.tar.gz -C /data
    fi
    
    # Restaurar configuración
    if [ -f "$backup_path/.env" ]; then
        cp "$backup_path/.env" .env
    fi
    
    log_success "Datos restaurados desde $backup_path"
}

# Actualizar sistema
update_system() {
    log_info "Actualizando sistema..."
    
    # Crear backup antes de actualizar
    backup_data
    
    # Actualizar código
    if [ -d ".git" ]; then
        log_info "Actualizando código desde Git..."
        git pull
    fi
    
    # Reconstruir y redesplegar
    build_images
    deploy_services
    
    log_success "Sistema actualizado"
}

# Mostrar ayuda
show_help() {
    echo "Script de gestión Docker para ExalinkHub"
    echo ""
    echo "Uso: $0 [comando] [opciones]"
    echo ""
    echo "Comandos disponibles:"
    echo "  deploy        - Desplegar sistema completo (LPR, Conteo, Notificaciones)"
    echo "  build         - Construir imágenes Docker"
    echo "  start         - Iniciar servicios"
    echo "  stop          - Detener servicios"
    echo "  restart       - Reiniciar servicios"
    echo "  status        - Mostrar estado de servicios"
    echo "  logs [service]- Mostrar logs (opcional: servicio específico)"
    echo "  cleanup       - Limpiar sistema"
    echo "  backup        - Crear backup de datos"
    echo "  restore <path>- Restaurar desde backup"
    echo "  update        - Actualizar sistema"
    echo "  shell <service>- Acceder a shell del contenedor"
    echo ""
    echo "Ejemplos:"
    echo "  $0 deploy                    # Despliegue completo"
    echo "  $0 logs lpr-backend         # Logs del backend LPR"
    echo "  $0 restore backups/20231201 # Restaurar backup"
    echo "  $0 shell conteo-backend     # Shell del backend de conteo"
}

# Función principal
main() {
    local command=${1:-}
    
    case "$command" in
        "deploy")
            check_prerequisites
            build_images
            deploy_services
            check_services
            ;;
        "build")
            check_prerequisites
            build_images
            ;;
        "start")
            docker-compose up -d
            check_services
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            docker-compose restart
            check_services
            ;;
        "status")
            check_services
            ;;
        "logs")
            show_logs "$2"
            ;;
        "cleanup")
            cleanup
            ;;
        "backup")
            backup_data
            ;;
        "restore")
            restore_data "$2"
            ;;
        "update")
            update_system
            ;;
        "shell")
            local service=${2:-lpr-backend}
            docker-compose exec "$service" /bin/bash
            ;;
        "help"|"-h"|"--help"|"")
            show_help
            ;;
        *)
            log_error "Comando no reconocido: $command"
            show_help
            exit 1
            ;;
    esac
}

# Ejecutar función principal
main "$@"