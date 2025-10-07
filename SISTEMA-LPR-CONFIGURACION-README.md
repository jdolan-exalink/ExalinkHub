# Sistema LPR - Configuración Completa

## 📋 Resumen de Mejoras Implementadas

Se ha actualizado completamente el sistema de configuración del módulo LPR (License Plate Recognition) con las siguientes mejoras:

### ✅ 1. Página Dedicada para LPR
- **Ubicación**: `/[locale]/(app)/plates-lpr/page.tsx`
- **Características**: 
  - Interfaz completa de gestión LPR
  - Detección automática de disponibilidad del backend
  - Modo sin conexión para configuración
  - Indicadores de estado en tiempo real

### ✅ 2. Configuración MQTT Mejorada
- **Características**:
  - Usuario y contraseña opcionales
  - Configuración SSL/TLS
  - Client ID personalizable
  - Validación de conexión en tiempo real
  - Keep-alive configurable

### ✅ 3. Integración con Servidores Frigate
- **Mejoras**:
  - Selección de servidores predefinidos de `frigate-servers.ts`
  - Configuración personalizada disponible
  - Auto-configuración basada en servidor seleccionado
  - Soporte para autenticación (Basic Auth, API Key)

### ✅ 4. Gestión de Base de Datos
- **Configuración**:
  - Path por defecto: `./DB/matriculas.db`
  - Soporte para SQLite y PostgreSQL
  - Respaldo automático configurable
  - Retención de respaldos configurable
  - Permisos de contenedor configurados

### ✅ 5. Sistema de Retención de Datos
- **Políticas configurables**:
  - Retención de eventos (días)
  - Retención de clips de video (días)
  - Retención de snapshots (días)
  - Límite de almacenamiento (GB)
  - Limpieza automática
  - Estimación de uso de almacenamiento

### ✅ 6. Controles Docker Integrados
- **Funcionalidades**:
  - Iniciar/Detener/Reiniciar contenedores
  - Rebuild de imágenes
  - Visualización de logs en tiempo real
  - Estado de salud del contenedor
  - Auto-refresh de estado

### ✅ 7. Docker Compose Actualizado
- **Mejoras**:
  - Volumen específico para carpeta DB (`./DB:/app/DB:rw`)
  - Variables de entorno para retención
  - Script de inicialización con permisos
  - Health checks mejorados
  - Configuración de usuario no-root

## 🚀 Componentes Nuevos/Actualizados

### Frontend (React/TypeScript)
```
src/components/lpr/
├── lpr-advanced-settings.tsx     # Configuración principal (ACTUALIZADO)
├── lpr-panel.tsx                 # Panel principal 
├── lpr-auxiliar-components.tsx   # Componentes auxiliares
└── docker-service-manager.tsx    # Gestión de Docker
```

### Backend (API Routes)
```
src/app/api/docker/lpr/route.ts   # API para control Docker (MEJORADO)
```

### Docker
```
lpr_backend/
├── Dockerfile                    # Imagen optimizada (ACTUALIZADO)
├── docker-entrypoint.sh         # Script de inicialización (NUEVO)
└── docker-compose.yml           # Orquestación completa (ACTUALIZADO)
```

## 🔧 Configuración por Defecto

### Base de Datos
- **Tipo**: SQLite
- **Ubicación**: `./DB/matriculas.db`
- **Respaldo**: Automático cada 24h
- **Retención de respaldos**: 7 días

### Retención de Datos
- **Eventos**: 30 días
- **Clips de video**: 7 días
- **Snapshots**: 14 días
- **Límite de almacenamiento**: 50 GB
- **Limpieza automática**: Habilitada

### MQTT
- **Host**: localhost
- **Puerto**: 1883
- **Prefijo de tópicos**: frigate
- **SSL**: Deshabilitado
- **Keep-alive**: 60 segundos

### Frigate
- **Host**: localhost
- **Puerto**: 5000
- **Protocolo**: HTTP
- **Autenticación**: Opcional

## 📱 Nuevas Pestañas de Configuración

1. **MQTT**: Configuración completa del broker MQTT
2. **Frigate**: Selección y configuración del servidor Frigate
3. **Cámaras**: Configuración por cámara para LPR
4. **Base de Datos**: Configuración de almacenamiento y respaldos
5. **Retención**: Políticas de retención y limpieza
6. **Docker**: Control y gestión del contenedor

## 🐳 Mejoras en Docker

### Nuevas Variables de Entorno
```bash
# Base de datos
DATABASE_TYPE=sqlite
DATABASE_PATH=./DB/matriculas.db
DATABASE_AUTO_BACKUP=true
DATABASE_BACKUP_RETENTION_DAYS=7

# Retención
RETENTION_EVENTS_DAYS=30
RETENTION_CLIPS_DAYS=7
RETENTION_SNAPSHOTS_DAYS=14
RETENTION_AUTO_CLEANUP=true
RETENTION_MAX_STORAGE_GB=50
```

### Script de Inicialización
- Configura permisos automáticamente
- Crea directorios necesarios
- Verifica conectividad con servicios
- Configura base de datos inicial
- Genera archivo .env automático

## 🔒 Seguridad y Permisos

### Contenedor
- Usuario no-root (`lpr:lpr` - UID 1000)
- Permisos mínimos necesarios
- Health checks integrados
- Timeouts configurados

### Volúmenes
- Montaje de `./DB` para acceso directo a la base de datos
- Permisos de lectura/escritura apropiados
- Respaldos automáticos fuera del contenedor

## 🚀 Instrucciones de Despliegue

### 1. Verificar Prerequisitos
```powershell
docker --version
docker-compose --version
```

### 2. Crear Estructura de Directorios
```powershell
mkdir DB
# El directorio DB ya se creó automáticamente
```

### 3. Configurar Variables (Opcional)
```powershell
# Editar .env para personalizar configuración
```

### 4. Desplegar Sistema
```powershell
# Construir y levantar servicios
docker-compose up -d

# Verificar estado
docker-compose ps

# Ver logs
docker-compose logs -f lpr-backend
```

### 5. Acceder a la Interfaz
- **URL Principal**: http://localhost:9002/es/plates-lpr
- **API Backend**: http://localhost:2221
- **Documentación**: http://localhost:2221/docs

## 📊 Monitoreo y Mantenimiento

### Desde la Interfaz Web
1. Ir a `/es/plates-lpr`
2. Abrir "Configuración" → Pestaña "Docker"
3. Usar controles integrados para gestión

### Via Docker Compose
```powershell
# Ver estado
docker-compose ps

# Reiniciar servicios
docker-compose restart

# Actualizar imágenes
docker-compose pull && docker-compose up -d

# Ver logs
docker-compose logs -f
```

## 🔧 Solución de Problemas

### Base de Datos
- **Ubicación**: `./DB/matriculas.db`
- **Permisos**: Verificar que Docker puede escribir en `./DB/`
- **Respaldos**: Se crean automáticamente en `./DB/backups/`

### Conectividad
- **MQTT**: Verificar host y puerto en configuración
- **Frigate**: Verificar servidor seleccionado en configuración
- **API**: http://localhost:2221/health debe responder OK

### Docker
- **Logs**: `docker-compose logs lpr-backend`
- **Rebuild**: Usar botón "Rebuild" en interfaz o `docker-compose build --no-cache`
- **Permisos**: El script de inicialización los configura automáticamente

## 📝 Notas Importantes

1. **Migración**: La configuración existente se migra automáticamente
2. **Compatibilidad**: Mantiene compatibilidad con versiones anteriores
3. **Respaldos**: Se recomiendan respaldos regulares de la carpeta `./DB/`
4. **Actualizaciones**: Usar la interfaz Docker para gestión simplificada

---

**Sistema actualizado exitosamente** ✅  
**Fecha**: 06 de Octubre, 2025  
**Versión**: 1.0.0