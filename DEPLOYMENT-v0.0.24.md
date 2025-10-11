# Guía de Despliegue - ExalinkHub v0.0.24

## Resumen de la Versión

La versión 0.0.24 incluye mejoras significativas en la interfaz de usuario y configuración:

- **Renombrado de "Paneles" a "Funciones"** en toda la interfaz
- **Icono actualizado** para matrículas (tarjeta de crédito)
- **Visibilidad restaurada** para todos los paneles en dashboard y navegación
- **Funcionalidad de retención verificada** y corregida en ajustes
- **Traducciones completas** en español, inglés y portugués
- **Mejoras en componentes** de configuración y navegación

## Requisitos Previos

### Sistema Operativo
- Linux (Ubuntu 20.04+ recomendado) o Windows Server 2019+
- Docker y Docker Compose instalados
- Git instalado

### Hardware Mínimo
- CPU: 4 cores
- RAM: 8GB (16GB recomendado)
- Almacenamiento: 100GB SSD (500GB recomendado para grabaciones)
- Red: Conexión estable a internet

## Pasos de Instalación

### 1. Clonar el Repositorio

```bash
# Clonar el repositorio
git clone https://github.com/jdolan-exalink/ExalinkHub.git

# Entrar al directorio
cd ExalinkHub

# Cambiar a la versión específica
git checkout v0.0.24
```

### 2. Configurar Variables de Entorno

```bash
# Copiar archivo de variables de entorno
cp .env.example .env

# Editar el archivo .env con tu configuración
nano .env
```

**Variables importantes a configurar:**
```env
# Configuración de red
FRONTEND_PORT=9002
LPR_PORT=2221
CONTEO_PORT=2223
NOTIFICACIONES_PORT=2224

# Configuración de Frigate
FRIGATE_URL=http://tu-frigate-server:5000
FRIGATE_USERNAME=admin
FRIGATE_PASSWORD=tu-contraseña

# Configuración de base de datos
REDIS_PASSWORD=tu-redis-seguro

# Configuración de dominio (opcional)
DOMAIN=tu-dominio.com
SSL_ENABLED=false
```

### 3. Construir y Levantar Contenedores

```bash
# Construir imágenes Docker
docker-compose build

# Levantar todos los servicios
docker-compose up -d

# Verificar estado de los contenedores
docker-compose ps
```

### 4. Configuración Inicial

1. **Acceder a la aplicación:**
   - URL: `http://localhost:9002` o `http://IP-del-servidor:9002`
   - Usuario inicial: `admin`
   - Contraseña inicial: `admin123`

2. **Configurar servidores Frigate:**
   - Ir a **Configuración → Servidores**
   - Agregar tus servidores Frigate con sus credenciales
   - Probar conexión para verificar que funcionen

3. **Configurar funciones:**
   - Ir a **Configuración → Funciones**
   - Activar las funciones que necesites:
     - Matrículas (LPR)
     - Conteo de Personas
     - Conteo Vehicular
     - Notificaciones

4. **Configurar servicios backend:**
   - Ir a **Configuración → Servicios Backend**
   - Configurar cada servicio según necesites
   - Establecer políticas de retención

## Verificación de Instalación

### Verificar Servicios

```bash
# Verificar que todos los contenedores estén corriendo
docker-compose ps

# Verificar logs de los servicios principales
docker-compose logs -f frontend
docker-compose logs -f lpr-backend
docker-compose logs -f conteo-backend
docker-compose logs -f notificaciones-backend
```

### Verificar Conectividad

1. **Acceso web:**
   - Dashboard: `http://IP:9002`
   - Vista Live: `http://IP:9002/live`
   - Configuración: `http://IP:9002/settings`

2. **APIs:**
   ```bash
   # Verificar API de configuración
   curl http://localhost:9002/api/config/backend/status
   
   # Verificar API de Frigate
   curl http://localhost:9002/api/frigate/status
   ```

## Actualización desde Versiones Anteriores

### Desde v0.0.23 o anterior

```bash
# Hacer backup de la configuración actual
cp -r DB/ DB-backup/
cp -r data/ data-backup/
cp .env .env-backup

# Actualizar código
git fetch origin
git checkout v0.0.24

# Reconstruir contenedores
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Verificar que todo funcione correctamente
```

## Configuración de Producción

### 1. Seguridad

```bash
# Cambiar contraseñas por defecto
# Editar .env y cambiar:
# - REDIS_PASSWORD
# - Contraseñas de usuarios en la interfaz web

# Configurar firewall
sudo ufw allow 9002/tcp
sudo ufw allow 2221/tcp
sudo ufw allow 2223/tcp
sudo ufw allow 2224/tcp
```

### 2. SSL/HTTPS (Opcional)

```bash
# Habilitar SSL en .env
SSL_ENABLED=true
DOMAIN=tu-dominio.com

# O usar nginx como proxy inverso
# Ver docker-compose.override.yml para configuración SSL
```

### 3. Monitoreo

```bash
# Configurar logs rotativos
sudo nano /etc/logrotate.d/exalinkhub

# Contenido:
/var/log/exalinkhub/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 root root
}
```

## Troubleshooting Común

### Problemas Frecuentes

1. **Contenedores no inician:**
   ```bash
   # Verificar Docker
   docker --version
   docker-compose --version
   
   # Verificar puertos disponibles
   netstat -tulpn | grep :9002
   ```

2. **Error de conexión a Frigate:**
   - Verificar URL y credenciales en Configuración → Servidores
   - Probar conexión desde el servidor: `curl http://frigate-server:5000`

3. **Base de datos corrupta:**
   ```bash
   # Reconstruir base de datos
   docker-compose down
   sudo rm -rf DB/config.db
   docker-compose up -d
   ```

4. **Problemas de permisos:**
   ```bash
   # Corregir permisos de directorios
   sudo chown -R $USER:$USER DB/
   sudo chown -R $USER:$USER data/
   ```

### Logs Útiles

```bash
# Logs de frontend
docker-compose logs -f frontend

# Logs de backend LPR
docker-compose logs -f lpr-backend

# Logs de Redis
docker-compose logs -f lpr-redis

# Logs de todos los servicios
docker-compose logs -f
```

## Mantenimiento

### Actualizaciones Futuras

```bash
# Para actualizar a futuras versiones
git fetch origin --tags
git checkout v0.0.25  # Siguiente versión
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Backups Automáticos

```bash
# Script de backup (guardar como backup-exalinkhub.sh)
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/exalinkhub"

mkdir -p $BACKUP_DIR

# Backup de base de datos
cp DB/config.db $BACKUP_DIR/config_$DATE.db

# Backup de configuración
cp .env $BACKUP_DIR/env_$DATE

# Backup de datos importantes
tar -czf $BACKUP_DIR/data_$DATE.tar.gz data/

# Limpiar backups antiguos (mantener 7 días)
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
find $BACKUP_DIR -name "env_*" -mtime +7 -delete
```

## Soporte

- **Documentación:** Revisar archivos README.md en el repositorio
- **Issues:** https://github.com/jdolan-exalink/ExalinkHub/issues
- **Logs:** Siempre incluir logs relevantes al reportar problemas

---

**Nota:** Esta guía está basada en la versión v0.0.24. Asegúrate de estar usando esta versión específica para evitar problemas de compatibilidad.