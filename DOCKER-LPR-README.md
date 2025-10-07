# Sistema LPR con Docker - Guía Completa

## Descripción

Esta guía detalla cómo desplegar y gestionar el Sistema LPR usando Docker y Docker Compose. La containerización proporciona:

- ✅ **Despliegue simplificado**: Un comando para desplegar todo el stack
- ✅ **Gestión via API**: Control del estado de servicios desde ExalinkHub  
- ✅ **Escalabilidad**: Fácil escalamiento horizontal y vertical
- ✅ **Aislamiento**: Servicios isolados con sus dependencias
- ✅ **Portabilidad**: Funciona igual en desarrollo y producción

## Prerequisitos

### Software Requerido
- **Docker Engine** 20.10+
- **Docker Compose** 2.0+
- **curl** (para verificaciones de salud)

### Hardware Recomendado
- **CPU**: 2+ cores
- **RAM**: 4GB mínimo, 8GB recomendado
- **Almacenamiento**: 20GB disponibles
- **Red**: Acceso a internet para pull de imágenes

## Instalación Rápida

### 1. Verificar Docker
```bash
docker --version
docker-compose --version
```

### 2. Clonar/Configurar Proyecto
```bash
# Si no tienes el proyecto
git clone <repo-url>
cd ExalinkHub

# Configurar variables de entorno
cp .env.example .env
# Editar .env según tu entorno
```

### 3. Despliegue Automático

**Linux/macOS:**
```bash
chmod +x docker-deploy.sh
./docker-deploy.sh deploy
```

**Windows:**
```cmd
docker-deploy.bat deploy
```

### 4. Verificar Despliegue
```bash
# Verificar estado
./docker-deploy.sh status

# Ver logs
./docker-deploy.sh logs

# Probar API
curl http://localhost:2221/health
```

## Configuración Detallada

### Variables de Entorno

El archivo `.env` controla toda la configuración:

```env
# Puertos del servicio
LPR_PORT=2221
LPR_HTTP_PORT=2280
LPR_HTTPS_PORT=2443

# Base de datos
DATABASE_URL=sqlite:///./data/lpr.db

# MQTT/Frigate
MQTT_HOST=localhost
MQTT_PORT=1883
FRIGATE_HOST=localhost
FRIGATE_PORT=5000

# Sistema
LOG_LEVEL=INFO
TZ=America/Mexico_City
```

### Servicios Incluidos

#### 1. **lpr-backend** (Principal)
- **Imagen**: `exalink/lpr-backend:latest`
- **Puerto**: 2221
- **Función**: API FastAPI para LPR
- **Dependencias**: Redis, Base de datos

#### 2. **lpr-redis** (Cache)
- **Imagen**: `redis:7-alpine`  
- **Función**: Cache y sesiones
- **Persistencia**: Volumen `lpr-redis-data`

#### 3. **lpr-proxy** (Opcional)
- **Imagen**: `nginx:alpine`
- **Puertos**: 80, 443
- **Función**: Proxy reverso con SSL
- **Profile**: `proxy`

#### 4. **lpr-monitor** (Opcional)
- **Imagen**: `prom/node-exporter`
- **Función**: Métricas del sistema
- **Profile**: `monitoring`

### Perfiles de Despliegue

#### Básico (Por defecto)
```bash
docker-compose up -d
```
Incluye: `lpr-backend`, `lpr-redis`

#### Con Proxy SSL
```bash
docker-compose --profile proxy up -d
```
Incluye servicios básicos + `lpr-proxy`

#### Con Monitoreo
```bash
docker-compose --profile monitoring up -d
```
Incluye servicios básicos + `lpr-monitor`

#### Completo
```bash
docker-compose --profile proxy --profile monitoring up -d
```

## Gestión de Servicios

### Scripts de Gestión

Los scripts `docker-deploy.sh` (Linux) y `docker-deploy.bat` (Windows) proporcionan comandos simplificados:

```bash
# Despliegue completo
./docker-deploy.sh deploy

# Gestión básica
./docker-deploy.sh start
./docker-deploy.sh stop  
./docker-deploy.sh restart

# Construcción
./docker-deploy.sh build

# Monitoreo
./docker-deploy.sh status
./docker-deploy.sh logs [servicio]

# Mantenimiento
./docker-deploy.sh backup
./docker-deploy.sh cleanup
./docker-deploy.sh update

# Acceso a contenedores
./docker-deploy.sh shell [servicio]
```

### Comandos Docker Compose Directos

```bash
# Iniciar servicios
docker-compose up -d

# Ver estado
docker-compose ps

# Ver logs
docker-compose logs -f lpr-backend

# Escalar servicios
docker-compose up -d --scale lpr-backend=2

# Parar servicios
docker-compose down

# Parar y limpiar volúmenes
docker-compose down -v
```

## Gestión via API (ExalinkHub)

### Endpoints Disponibles

#### GET `/api/docker/lpr`
Obtener estado del servicio:
```bash
curl "http://localhost:3000/api/docker/lpr?service=lpr-backend"
```

#### POST `/api/docker/lpr` 
Controlar servicio:
```bash
# Iniciar
curl -X POST http://localhost:3000/api/docker/lpr \
  -H "Content-Type: application/json" \
  -d '{"action": "start", "service_name": "lpr-backend"}'

# Detener  
curl -X POST http://localhost:3000/api/docker/lpr \
  -H "Content-Type: application/json" \
  -d '{"action": "stop", "service_name": "lpr-backend"}'

# Reiniciar
curl -X POST http://localhost:3000/api/docker/lpr \
  -H "Content-Type: application/json" \
  -d '{"action": "restart", "service_name": "lpr-backend"}'
```

### Interfaz Web

En ExalinkHub → Sistema LPR → Configuración → Tab "Docker":
- ✅ Estado en tiempo real del servicio
- ✅ Controles start/stop/restart
- ✅ Logs en tiempo real
- ✅ Indicadores de salud
- ✅ Información del contenedor

## Redes y Comunicación

### Redes Docker Creadas

```yaml
# Red interna LPR
exalink-lpr-network:
  - lpr-backend ↔ lpr-redis
  - lpr-backend ↔ lpr-proxy

# Red externa Frigate  
frigate_default:
  - lpr-backend ↔ Frigate/MQTT

# Red pública
exalink-public:
  - lpr-proxy ↔ Internet
```

### Comunicación entre Servicios

```
ExalinkHub (host:3000)
    ↓ API calls
lpr-backend (container:2221)
    ↓ cache
lpr-redis (container:6379)
    ↓ MQTT/API
Frigate (external:5000)
```

## Persistencia de Datos

### Volúmenes Docker

```yaml
# Datos LPR (base de datos, configuración)
lpr-data:
  location: /var/lib/docker/volumes/exalink-lpr_lpr-data

# Logs del sistema  
lpr-logs:
  location: /var/lib/docker/volumes/exalink-lpr_lpr-logs

# Cache Redis
lpr-redis-data:
  location: /var/lib/docker/volumes/exalink-lpr_lpr-redis-data
```

### Backup y Restauración

#### Crear Backup
```bash
# Automático
./docker-deploy.sh backup

# Manual
docker run --rm \
  -v "$(pwd)/backup:/backup" \
  -v "exalink-lpr_lpr-data:/data:ro" \
  alpine tar czf /backup/lpr-data.tar.gz -C /data .
```

#### Restaurar Backup
```bash
# Automático
./docker-deploy.sh restore backup/20231201_120000

# Manual
docker run --rm \
  -v "$(pwd)/backup:/backup:ro" \
  -v "exalink-lpr_lpr-data:/data" \
  alpine tar xzf /backup/lpr-data.tar.gz -C /data
```

## Monitoreo y Logs

### Logs en Tiempo Real
```bash
# Todos los servicios
docker-compose logs -f

# Servicio específico
docker-compose logs -f lpr-backend

# Últimas líneas
docker-compose logs --tail=100 lpr-backend
```

### Health Checks

Los contenedores incluyen health checks automáticos:

```bash
# Estado de salud
docker-compose ps

# Detalles de salud
docker inspect exalink-lpr-backend | grep -A 10 Health
```

### Métricas (Opcional)

Con el profile `monitoring`:
```bash
# Métricas del sistema
curl http://localhost:9100/metrics

# Integración con Prometheus/Grafana
# Ver docker-compose.yml para configuración
```

## Seguridad

### Configuración de Seguridad

1. **Usuario no-root**: Los contenedores ejecutan como usuario `lpr` (UID 1000)
2. **Redes aisladas**: Servicios en redes Docker separadas  
3. **Volúmenes con permisos restrictivos**
4. **Variables sensibles en .env** (no en código)

### SSL/TLS (Opcional)

Para HTTPS con certificados:

```bash
# Crear directorio SSL
mkdir -p docker/nginx/ssl

# Generar certificados (desarrollo)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/key.pem \
  -out docker/nginx/ssl/cert.pem

# Activar proxy SSL
docker-compose --profile proxy up -d
```

### Firewall

Asegurar que solo los puertos necesarios estén expuestos:
```bash
# Puertos requeridos
2221/tcp  # LPR Backend API
2280/tcp  # HTTP Proxy (opcional)  
2443/tcp  # HTTPS Proxy (opcional)
```

## Troubleshooting

### Problemas Comunes

#### 1. "Container already exists"
```bash
docker-compose down
docker-compose up -d
```

#### 2. "Port already in use"
```bash
# Cambiar puerto en .env
LPR_PORT=2222

# O encontrar proceso que usa el puerto
netstat -tulpn | grep :2221
```

#### 3. "Network not found"
```bash
# Recrear redes
docker network create exalink-lpr-network
docker network create exalink-public
```

#### 4. "Volume mount failed"
```bash
# Verificar permisos
ls -la /var/lib/docker/volumes/

# Recrear volúmenes
docker volume prune
docker-compose up -d
```

#### 5. "Service unhealthy"
```bash
# Ver logs detallados
docker-compose logs lpr-backend

# Verificar configuración
docker-compose config

# Reiniciar servicio
docker-compose restart lpr-backend
```

### Logs de Depuración

```bash
# Modo debug
echo "LPR_DEBUG=true" >> .env
docker-compose restart lpr-backend

# Logs detallados de Docker
docker-compose --verbose up -d

# Logs del build
docker-compose build --progress=plain
```

### Comandos de Diagnóstico

```bash
# Información del sistema
docker system info
docker system df

# Estado de servicios
docker-compose ps
docker-compose top

# Configuración activa
docker-compose config

# Eventos en tiempo real
docker events --filter container=exalink-lpr-backend
```

## Actualización y Mantenimiento

### Actualizar Imágenes
```bash
# Pull de nuevas imágenes
docker-compose pull

# Recrear contenedores
docker-compose up -d --force-recreate

# O usar script automático
./docker-deploy.sh update
```

### Limpieza del Sistema
```bash
# Limpieza básica
docker system prune

# Limpieza completa (cuidado!)
docker system prune -a --volumes

# Script de limpieza
./docker-deploy.sh cleanup
```

### Rotación de Logs
```bash
# Configurar logrotate para Docker
sudo nano /etc/logrotate.d/docker-compose

# Contenido:
/var/lib/docker/containers/*/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
```

## Producción

### Configuración de Producción

```env
# .env para producción
LPR_DEBUG=false
LOG_LEVEL=WARNING

# Base de datos externa (recomendado)
DATABASE_URL=postgresql://user:pass@postgres:5432/lpr

# SSL habilitado
ENABLE_PROXY=true
ENABLE_MONITORING=true
```

### Despliegue en Producción
```bash
# Con todas las opciones
docker-compose \
  --profile proxy \
  --profile monitoring \
  up -d

# Con reinicio automático
docker-compose up -d --restart=unless-stopped
```

### Backup Automatizado
```bash
# Cron job para backup diario
0 2 * * * /path/to/docker-deploy.sh backup

# Retention de backups (mantener 7 días)
find /path/to/backups -name "*.tar.gz" -mtime +7 -delete
```

## Conclusión

El sistema Docker para LPR proporciona:
- ✅ Despliegue simplificado y reproducible
- ✅ Gestión centralizada via API
- ✅ Escalabilidad y mantención facilitada  
- ✅ Monitoreo y logs integrados
- ✅ Backup y restauración automatizados

Para soporte adicional, consultar:
- **Logs**: `./docker-deploy.sh logs`
- **Estado**: `./docker-deploy.sh status`  
- **Documentación API**: `http://localhost:2221/docs`