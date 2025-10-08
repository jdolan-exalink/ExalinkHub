#!/bin/bash

# Script de inicialización para el contenedor LPR
# Configura permisos y directorios necesarios

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Inicializando Sistema LPR ===${NC}"

# Función para crear directorio con permisos
create_directory() {
    local dir_path="$1"
    local permissions="$2"
    
    if [ ! -d "$dir_path" ]; then
        echo -e "${YELLOW}Creando directorio: $dir_path${NC}"
        mkdir -p "$dir_path"
    fi
    
    
    echo -e "${GREEN}✓ Directorio configurado: $dir_path${NC}"
}

# Crear directorios necesarios
echo -e "${YELLOW}Configurando directorios...${NC}"

create_directory "/app/data" "755"
create_directory "/app/logs" "755"
create_directory "/DB" "755"
create_directory "/app/config" "755"

# Configurar permisos especiales para base de datos
if [ -d "/DB" ]; then
    echo -e "${YELLOW}Configurando permisos de base de datos...${NC}"
    
    # Crear base de datos si no existe
    if [ ! -f "/DB/matriculas.db" ]; then
        echo -e "${YELLOW}Creando base de datos inicial...${NC}"
        touch "/DB/matriculas.db"
    fi
    
    # Asegurar permisos correctos en archivos existentes
    
    echo -e "${GREEN}✓ Base de datos configurada${NC}"
fi

# Configurar archivos de log
if [ -d "/app/logs" ]; then
    echo -e "${YELLOW}Configurando archivos de log...${NC}"
    
    # Crear archivo de log principal si no existe
    if [ ! -f "/app/logs/lpr.log" ]; then
        touch "/app/logs/lpr.log"
    fi
    
    
    echo -e "${GREEN}✓ Logs configurados${NC}"
fi

# Verificar conectividad con servicios externos
echo -e "${YELLOW}Verificando conectividad...${NC}"

# Función para verificar conexión
check_connection() {
    local service="$1"
    local host="$2"
    local port="$3"
    
    if timeout 5 bash -c "</dev/tcp/$host/$port" 2>/dev/null; then
        echo -e "${GREEN}✓ $service accesible en $host:$port${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠ $service no accesible en $host:$port${NC}"
        return 1
    fi
}

# Verificar MQTT (si está configurado)
if [ -n "$MQTT_HOST" ] && [ "$MQTT_HOST" != "localhost" ] && [ "$MQTT_HOST" != "" ]; then
    check_connection "MQTT" "$MQTT_HOST" "${MQTT_PORT:-1883}"
fi

# Verificar Frigate (si está configurado)
if [ -n "$FRIGATE_HOST" ] && [ "$FRIGATE_HOST" != "localhost" ] && [ "$FRIGATE_HOST" != "" ]; then
    check_connection "Frigate" "$FRIGATE_HOST" "${FRIGATE_PORT:-5000}"
fi

# Verificar Redis
if [ -n "$REDIS_HOST" ]; then
    check_connection "Redis" "$REDIS_HOST" "${REDIS_PORT:-6379}"
else
    check_connection "Redis" "lpr-redis" "6379"
fi

# Configurar variables de entorno por defecto si no están definidas
echo -e "${YELLOW}Configurando variables de entorno...${NC}"

# Crear archivo de configuración de entorno si no existe
if [ ! -f "/app/.env" ]; then
    cat > "/app/.env" << EOF
# Configuración del servidor
LPR_HOST=0.0.0.0
LPR_PORT=2221
LPR_DEBUG=${LPR_DEBUG:-false}

# Base de datos
DATABASE_URL=${DATABASE_URL:-sqlite:///./DB/matriculas.db}
DATABASE_PATH=${DATABASE_PATH:-./DB/matriculas.db}

# MQTT
MQTT_HOST=${MQTT_HOST:-localhost}
MQTT_PORT=${MQTT_PORT:-1883}
MQTT_USERNAME=${MQTT_USERNAME:-}
MQTT_PASSWORD=${MQTT_PASSWORD:-}
MQTT_TOPIC_PREFIX=${MQTT_TOPIC_PREFIX:-frigate}

# Frigate
FRIGATE_HOST=${FRIGATE_HOST:-localhost}
FRIGATE_PORT=${FRIGATE_PORT:-5000}
FRIGATE_PROTOCOL=${FRIGATE_PROTOCOL:-http}

# Retención
RETENTION_EVENTS_DAYS=${RETENTION_EVENTS_DAYS:-30}
RETENTION_CLIPS_DAYS=${RETENTION_CLIPS_DAYS:-7}
RETENTION_SNAPSHOTS_DAYS=${RETENTION_SNAPSHOTS_DAYS:-14}

# Sistema
TZ=${TZ:-UTC}
LOG_LEVEL=${LOG_LEVEL:-INFO}
EOF
    
    echo -e "${GREEN}✓ Archivo de configuración creado${NC}"
fi

# Mostrar información del sistema
echo -e "${GREEN}=== Información del Sistema ===${NC}"
echo -e "Usuario actual: $(whoami)"
echo -e "UID/GID: $(id)"
echo -e "Directorio de trabajo: $(pwd)"
echo -e "Variables de entorno clave:"
echo -e "  - DATABASE_PATH: ${DATABASE_PATH:-./DB/matriculas.db}"
echo -e "  - MQTT_HOST: ${MQTT_HOST:-localhost}"
echo -e "  - FRIGATE_HOST: ${FRIGATE_HOST:-localhost}"
echo -e "  - LOG_LEVEL: ${LOG_LEVEL:-INFO}"

echo -e "${GREEN}=== Inicialización Completada ===${NC}"

# Ejecutar el comando original
exec "$@"