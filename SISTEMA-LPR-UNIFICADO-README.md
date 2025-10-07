# Sistema LPR Unificado - ExalinkHub

## Descripción

El sistema LPR (License Plate Recognition) de ExalinkHub ha sido completamente renovado para proporcionar una experiencia unificada de reconocimiento y gestión de matrículas. Ya no existe el sistema dual - solo el sistema avanzado con configuración completa.

## Modos de Funcionamiento

### 🟢 Modo Completo (Backend Disponible)
Cuando el backend LPR está ejecutándose:
- ✅ Procesamiento en tiempo real de eventos
- ✅ Almacenamiento en base de datos
- ✅ Exportación de datos
- ✅ Configuración completa de MQTT/Frigate
- ✅ Estadísticas y análisis

### 🟠 Modo Sin Conexión (Backend No Disponible)
Cuando el backend LPR no está disponible:
- ✅ Interfaz de configuración accesible
- ✅ Exploración de funcionalidades
- ✅ Configuración de parámetros
- ⚠️ Sin procesamiento de eventos reales
- ⚠️ Sin almacenamiento de datos

> **Nota:** El sistema detecta automáticamente el estado del backend y se adapta en consecuencia. Puedes trabajar en modo sin conexión para preparar la configuración antes de instalar el backend.

## Características Principales

### 🎯 **Sistema Unificado**
- **Una sola interfaz**: Sistema único sin alternativas clásicas
- **Detección automática**: Verifica automáticamente la disponibilidad del servicio
- **Estados claros**: Indicadores visuales de conectividad y salud del sistema
- **Configuración completa**: MQTT, Frigate, cámaras y parámetros avanzados

### 🔧 **Configuración Avanzada**
- **MQTT completo**: Servidor, credenciales, SSL, tópicos personalizados
- **Frigate integrado**: Conexión directa con autenticación y API keys
- **Selección de cámaras**: Habilitar/deshabilitar LPR por cámara individual
- **Parámetros por cámara**: Confianza mínima, FPS de procesamiento, zonas
- **Funcionalidades IA**: Detección de falsos positivos, cálculo de velocidad, semáforos

## Instalación y Configuración

### 🚀 **Opción 1: Despliegue con Docker (Recomendado)**

La forma más fácil de ejecutar el backend LPR es usando Docker:

```bash
# Configurar variables de entorno
cp .env.example .env
# Editar .env según tu configuración

# Despliegue automático
# Linux/macOS:
chmod +x docker-deploy.sh && ./docker-deploy.sh deploy

# Windows:
docker-deploy.bat deploy
```

**Ventajas del despliegue Docker:**
- ✅ **Setup en un comando**: Todo configurado automáticamente
- ✅ **Gestión via API**: Control desde ExalinkHub (tab Docker)
- ✅ **Aislamiento**: Sin conflictos con otras instalaciones
- ✅ **Escalabilidad**: Fácil escalamiento y monitoreo
- ✅ **Backup automático**: Scripts incluidos

Ver [**DOCKER-LPR-README.md**](./DOCKER-LPR-README.md) para documentación completa.

### 🔧 **Opción 2: Instalación Manual del Backend**

Para desarrollo o instalación personalizada:

#### Requisitos Previos
```bash
# Servicios requeridos
- Frigate (con MQTT habilitado)
- Broker MQTT (Mosquitto recomendado)  
- Python 3.11+
```

#### Instalación Automática (Manual)
```bash
cd lpr_backend
# Windows
install.bat

# Linux/macOS
chmod +x install.sh && ./install.sh
```

#### Instalación Manual Completa
```bash
cd lpr_backend
pip install -r requirements.txt
python start.py
```

El servicio se ejecutará en `http://localhost:2221`

### 📱 **Gestión de Servicios desde ExalinkHub**

En **ExalinkHub → Sistema LPR → Configuración → Tab "Docker"**:
- ✅ **Control en tiempo real**: Start/Stop/Restart servicios
- ✅ **Estado visual**: Indicadores de salud y conectividad  
- ✅ **Logs integrados**: Ver logs del backend en tiempo real
- ✅ **Información detallada**: Estado de contenedores y puertos

### 🎯 **Configuración Inicial**

1. **Acceder a la interfaz**: 
   - Ir a **ExalinkHub** → **Sistema LPR**
   - El sistema detectará automáticamente la disponibilidad del servicio

2. **Configurar por primera vez**:
   - Si el sistema no está disponible, seguir las instrucciones mostradas
   - Una vez disponible, usar el botón **"Configuración"** en la interfaz

## Configuración Detallada

### 🔌 **Configuración MQTT**

```yaml
Parámetros requeridos:
  - Servidor MQTT: localhost (o IP del broker)
  - Puerto: 1883 (estándar) o 8883 (SSL)
  - Usuario/Contraseña: Opcional
  - Prefijo de tópicos: "frigate" (por defecto)
  - SSL/TLS: Habilitar si es necesario
  - Keep Alive: 60 segundos (recomendado)
```

**Ejemplo de configuración MQTT:**
```json
{
  "host": "192.168.1.100",
  "port": 1883,
  "username": "frigate_user",
  "password": "frigate_pass",
  "topic_prefix": "frigate",
  "use_ssl": false,
  "keepalive": 60
}
```

### 📹 **Configuración Frigate**

```yaml
Parámetros requeridos:
  - Servidor Frigate: localhost (o IP del servidor)
  - Puerto: 5000 (estándar Frigate)
  - Usuario/Contraseña: Si Frigate tiene autenticación
  - API Key: Si está configurada en Frigate
  - HTTPS: Solo si Frigate usa SSL
```

**Ejemplo de configuración Frigate:**
```json
{
  "host": "192.168.1.101",
  "port": 5000,
  "use_ssl": false,
  "username": "admin",
  "password": "admin_pass",
  "api_key": "your-frigate-api-key"
}
```

### 📷 **Configuración de Cámaras LPR**

Para cada cámara disponible en Frigate:

```yaml
Parámetros por cámara:
  - Habilitar LPR: true/false
  - Confianza mínima: 0.7 (70% recomendado)
  - FPS de procesamiento: 2 (balance rendimiento/precisión)
  - Zonas: Zonas específicas de Frigate (opcional)
```

**Ejemplo de configuración de cámara:**
```json
{
  "entrada_principal": {
    "enabled_for_lpr": true,
    "confidence_threshold": 0.8,
    "processing_fps": 2,
    "zones": ["parking", "entrance"]
  },
  "salida_trasera": {
    "enabled_for_lpr": false,
    "confidence_threshold": 0.7,
    "processing_fps": 1
  }
}
```

### ⚙️ **Configuración del Sistema**

```yaml
Parámetros globales:
  - Días de retención: 30 (días que se mantienen los eventos)
  - Eventos máximos por cámara: 1000
  - Detección de falsos positivos: IA para mejorar precisión
  - Cálculo de velocidad: Estimación basada en movimiento
  - Detección de semáforos: Análisis del estado de semáforos
  - Modo debug: Logging detallado para troubleshooting
```

## Uso del Sistema

### 🎮 **Interfaz Principal**

1. **Panel de Estado**:
   - Indicadores de conexión MQTT, Frigate y base de datos
   - Tiempo del último evento procesado
   - Estado general del sistema

2. **Tarjetas de Estadísticas**:
   - Total de eventos registrados
   - Eventos del día actual
   - Cámaras activas con detecciones
   - Promedio de confianza de detecciones

3. **Sistema de Filtros**:
   - Por fechas (rangos o fechas específicas)
   - Por cámaras individuales
   - Por matrículas (búsqueda parcial o completa)
   - Por tipos de vehículo
   - Por estado de semáforo
   - Por nivel de confianza mínimo

4. **Tabla de Eventos**:
   - Información completa de cada detección
   - Acciones: Ver imagen, editar, marcar falso positivo
   - Paginación automática con carga bajo demanda

### 📊 **Gestión de Datos**

#### Exportación
- **Formatos**: Excel (.xlsx) y CSV
- **Filtros aplicados**: Solo exporta eventos filtrados
- **Incluir imágenes**: Opción para adjuntar snapshots
- **Descarga directa**: Archivo generado al instante

#### Edición de Eventos
- **Corrección de matrículas**: Editar lecturas incorrectas
- **Falsos positivos**: Marcar/desmarcar eventos incorrectos
- **Metadatos**: Actualizar información adicional
- **Validación**: Cambios registrados con timestamp

## Monitoreo y Mantenimiento

### 🔍 **Health Checks**

El sistema proporciona indicadores en tiempo real:

```yaml
Estados monitoreados:
  - Conexión MQTT: Verde/Rojo
  - Acceso a Frigate: Verde/Rojo
  - Base de datos: Verde/Rojo
  - Último evento: Timestamp del evento más reciente
```

### 🚨 **Alertas del Sistema**

Alertas automáticas mostradas en la interfaz:

1. **MQTT Desconectado**: No se pueden recibir eventos de Frigate
2. **Frigate No Accesible**: Servidor Frigate no responde
3. **Sin Actividad Reciente**: No hay eventos en la última hora
4. **Sistema No Disponible**: Backend LPR no está ejecutándose

### 🔧 **Troubleshooting**

#### Sistema LPR No Disponible
```bash
# Verificar si el servicio está ejecutándose
curl http://localhost:2221/health

# Si no responde, iniciar el servicio
cd lpr_backend/
python -m app.main
```

#### MQTT Desconectado
```bash
# Verificar broker MQTT
mosquitto_sub -h localhost -t "frigate/events"

# Verificar configuración en la interfaz
# Ir a Configuración → MQTT → Probar Conexión
```

#### Frigate No Accesible
```bash
# Verificar Frigate
curl http://localhost:5000/api/config

# Verificar configuración en la interfaz
# Ir a Configuración → Frigate → Probar Conexión
```

#### No Se Detectan Eventos
1. Verificar que las cámaras estén habilitadas para LPR
2. Revisar umbrales de confianza (probar con 0.5)
3. Comprobar que Frigate esté detectando vehículos
4. Verificar tópicos MQTT correctos

## API y Integración

### 🔗 **Endpoints Principales**

```yaml
Health Check:
  GET /health
  
Configuración:
  GET/POST /api/preferences
  
Eventos:
  GET /api/events?page=1&limit=25&camera=entrance
  PUT /api/events/{id}
  
Estadísticas:
  GET /api/stats
  
Exportación:
  POST /api/export
```

### 📝 **Documentación API**

Swagger UI disponible en: `http://localhost:2221/docs`

Ver documentación completa en: `/context/lpr-api-documentation.md`

## Configuración de Producción

### 🐳 **Docker Compose (Recomendado)**

```yaml
version: '3.8'
services:
  lpr-backend:
    build: ./lpr_backend
    ports:
      - "2221:2221"
    environment:
      - LPR_HOST=0.0.0.0
      - LPR_PORT=2221
    volumes:
      - ./lpr_backend/DB:/app/DB
    depends_on:
      - mosquitto
      - frigate
    restart: unless-stopped
```

### 🔒 **Nginx Proxy**

```nginx
server {
    listen 443 ssl;
    server_name lpr.exalinkhub.local;
    
    location /api/ {
        proxy_pass http://localhost:2221/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 🗂️ **Backup Automático**

```bash
#!/bin/bash
# Script de backup diario
backup_dir="/backup/lpr/$(date +%Y%m%d)"
mkdir -p "$backup_dir"

# Backup base de datos
cp lpr_backend/DB/matriculas.db "$backup_dir/"

# Backup configuración
curl -u admin:password http://localhost:2221/api/preferences > "$backup_dir/config.json"

# Limpiar backups antiguos (30 días)
find /backup/lpr/ -type d -mtime +30 -exec rm -rf {} \;
```

## Migración desde Sistema Clásico

Si tenías el sistema dual previamente instalado:

1. **Los datos del sistema clásico se mantienen** en su ubicación original
2. **La configuración se realiza desde cero** en el nuevo sistema
3. **No hay migración automática** - es un sistema independiente
4. **Ambos sistemas pueden coexistir** si es necesario temporalmente

Para exportar datos del sistema clásico:
```sql
-- Conectar a la base de datos antigua y exportar
.mode csv
.output eventos_clasicos.csv
SELECT * FROM plate_events;
```

## Soporte y Comunidad

### 📚 **Documentación Adicional**
- Guía de uso: `/context/lpr-module-usage.md`
- Guía de implementación: `/context/lpr-implementation-guide.md`
- Configuración de Frigate: `/context/configuracion-jwt-frigate.md`

### 🐛 **Reportar Issues**
1. Verificar logs del sistema: `tail -f lpr_backend/lpr.log`
2. Comprobar health status: `curl http://localhost:2221/health`
3. Documentar pasos para reproducir el problema
4. Incluir configuración actual (sin credenciales)

### 🚀 **Roadmap**
- [ ] Dashboard en tiempo real con WebSockets
- [ ] App móvil para gestión remota
- [ ] Integración con sistemas de facturación
- [ ] Machine Learning para mejora automática
- [ ] Clustering para alta disponibilidad

---

**Nota**: Este sistema reemplaza completamente el sistema LPR dual anterior. Para la documentación del sistema anterior, consultar las versiones previas del repositorio.