# API del Módulo LPR - ExalinkHub

## Resumen

Este documento describe la API REST del módulo de reconocimiento de matrículas (LPR) integrado en ExalinkHub. El sistema funciona como un servicio independiente que se ejecuta en paralelo a la aplicación principal y se comunica a través de una API REST completa.

## Arquitectura del Sistema

### Componentes Principales

1. **Backend Python/FastAPI** (`lpr_backend/`)
   - Servidor API REST en puerto 2221
   - Suscripción MQTT para eventos de Frigate
   - Base de datos SQLite independiente
   - Procesamiento y enriquecimiento de eventos

2. **Frontend React** (`src/components/lpr/`)
   - Panel integrado en ExalinkHub
   - Comunicación vía API REST
   - Interfaz moderna con filtros avanzados

3. **Base de Datos**
   - `lpr_backend/DB/matriculas.db`
   - Esquema optimizado para eventos LPR
   - Índices para consultas rápidas

## Configuración e Instalación

### Instalación del Backend

```bash
cd lpr_backend/
pip install -r requirements.txt
python -m app.main
```

### Variables de Entorno

El sistema se configura principalmente a través de la API, pero acepta estas variables:

- `LPR_HOST`: Host del servidor (default: 0.0.0.0)
- `LPR_PORT`: Puerto del servidor (default: 2221)
- `LPR_DB_PATH`: Ruta de la base de datos (default: DB/matriculas.db)

## Endpoints de la API

### Base URL: `http://localhost:2221/api`

### Autenticación

El sistema usa **HTTP Basic Authentication**. Las credenciales se configuran a través del endpoint `/api/preferences`.

```bash
# Ejemplo de autenticación
curl -u admin:password http://localhost:2221/api/events
```

### 1. Endpoints de Configuración

#### GET /api/preferences
Obtiene la configuración actual del sistema.

**Respuesta:**
```json
{
  "mqtt": {
    "host": "localhost",
    "port": 1883,
    "username": null,
    "password": null,
    "topic_prefix": "frigate"
  },
  "frigate": {
    "host": "localhost",
    "port": 5000,
    "use_ssl": false,
    "username": null,
    "password": null
  },
  "auth": {
    "enabled": true,
    "username": "admin",
    "password": "hashed_password"
  },
  "cameras": {},
  "retention_days": 30,
  "max_events_per_camera": 1000
}
```

#### POST /api/preferences
Actualiza la configuración del sistema.

**Cuerpo de la petición:**
```json
{
  "mqtt": {
    "host": "192.168.1.100",
    "port": 1883,
    "username": "mqtt_user",
    "password": "mqtt_pass"
  },
  "frigate": {
    "host": "192.168.1.101",
    "port": 5000
  },
  "retention_days": 60
}
```

### 2. Endpoints de Eventos

#### GET /api/events
Obtiene eventos paginados con filtros opcionales.

**Parámetros de consulta:**
- `page`: Número de página (default: 1)
- `limit`: Eventos por página (default: 50, max: 200)
- `camera_name`: Filtrar por nombre de cámara
- `license_plate`: Filtrar por matrícula
- `start_date`: Fecha inicio (ISO 8601)
- `end_date`: Fecha fin (ISO 8601)
- `traffic_light_status`: Estado semáforo (red, yellow, green, unknown)
- `vehicle_type`: Tipo vehículo (car, truck, motorcycle, bus, bicycle)
- `false_positive`: Filtrar falsos positivos (true/false)
- `zone`: Filtrar por zona
- `min_confidence`: Confianza mínima (0.0-1.0)

**Ejemplo:**
```bash
curl -u admin:password "http://localhost:2221/api/events?page=1&limit=25&camera_name=entrada&start_date=2025-01-01T00:00:00"
```

**Respuesta:**
```json
{
  "events": [
    {
      "id": 1,
      "frigate_event_id": "1732567890.123456-abcdef",
      "camera_name": "entrada_principal",
      "license_plate": "ABC123",
      "timestamp": "2025-01-06T10:30:00Z",
      "start_time": "2025-01-06T10:29:58Z",
      "end_time": "2025-01-06T10:30:05Z",
      "zone": "parking_lot",
      "plate_confidence": 0.95,
      "plate_region": "ES",
      "vehicle_type": "car",
      "vehicle_color": "blue",
      "speed_kmh": 25.5,
      "direction": "north",
      "traffic_light_status": "green",
      "snapshot_url": "http://frigate:5000/api/events/abc123/snapshot.jpg",
      "clip_url": "http://frigate:5000/api/events/abc123/clip.mp4",
      "false_positive": false,
      "has_clip": true,
      "has_snapshot": true,
      "created_at": "2025-01-06T10:30:00Z",
      "updated_at": "2025-01-06T10:30:00Z",
      "processed": true
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 25,
  "has_next": true
}
```

#### GET /api/events/{event_id}
Obtiene un evento específico por ID.

#### PUT /api/events/{event_id}
Actualiza un evento existente.

**Cuerpo de la petición:**
```json
{
  "license_plate": "NEW123",
  "false_positive": true,
  "traffic_light_status": "red",
  "vehicle_type": "truck"
}
```

#### DELETE /api/events/{event_id}
Elimina un evento.

#### GET /api/events/search/{search_term}
Busca eventos por término general (matrícula, cámara, etc.).

### 3. Endpoints de Estadísticas

#### GET /api/stats
Obtiene estadísticas generales del sistema.

**Respuesta:**
```json
{
  "total_events": 1250,
  "events_today": 45,
  "events_this_week": 312,
  "events_this_month": 1100,
  "cameras_active": 8,
  "top_cameras": [
    {"name": "entrada_principal", "count": 150},
    {"name": "salida_trasera", "count": 120}
  ],
  "top_plates": [
    {"plate": "ABC123", "count": 5},
    {"plate": "XYZ789", "count": 3}
  ],
  "traffic_light_stats": {
    "red": 45,
    "yellow": 12,
    "green": 890,
    "unknown": 303
  }
}
```

#### GET /api/stats/camera/{camera_name}
Obtiene estadísticas específicas de una cámara.

**Parámetros:**
- `days`: Días hacia atrás (default: 7)

### 4. Endpoints de Exportación

#### POST /api/export
Exporta eventos filtrados a Excel o CSV.

**Cuerpo de la petición:**
```json
{
  "format": "xlsx",
  "filters": {
    "start_date": "2025-01-01T00:00:00",
    "end_date": "2025-01-06T23:59:59",
    "camera_name": "entrada"
  },
  "include_images": true
}
```

**Respuesta:** Archivo binario para descarga.

### 5. Endpoints de Mantenimiento

#### POST /api/maintenance/cleanup
Elimina eventos antiguos según política de retención.

**Parámetros:**
- `retention_days`: Días de retención (default: 30)

#### POST /api/maintenance/optimize
Optimiza la base de datos (se ejecuta en segundo plano).

#### GET /api/maintenance/database-info
Obtiene información sobre la base de datos.

**Respuesta:**
```json
{
  "database_path": "/path/to/matriculas.db",
  "database_size_mb": 45.6,
  "plate_events_count": 1250,
  "accessible": true
}
```

### 6. Endpoint de Salud

#### GET /health
Verifica el estado de salud del sistema.

**Respuesta:**
```json
{
  "status": "healthy",
  "mqtt_connected": true,
  "database_connected": true,
  "frigate_accessible": true,
  "last_event_time": "2025-01-06T10:30:00Z",
  "version": "1.0.0"
}
```

## Integración MQTT

### Topics Suscritos

- `frigate/events`: Eventos de Frigate en tiempo real
- Formato esperado: Mensajes JSON con tipos `new`, `update`, `end`

### Flujo de Procesamiento

1. **Evento `new`/`update`**: Se almacena en cache en memoria
2. **Evento `end`**: Se procesa el evento completo y se guarda en BD
3. **Enriquecimiento**: Se añade información de semáforos, velocidad, etc.
4. **URLs de medios**: Se construyen URLs para snapshots y clips

## Esquema de Base de Datos

### Tabla: plate_events

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | INTEGER PRIMARY KEY | ID único del evento |
| frigate_event_id | STRING UNIQUE | ID del evento en Frigate |
| timestamp | DATETIME | Fecha/hora de creación |
| start_time | DATETIME | Inicio del evento |
| end_time | DATETIME | Fin del evento |
| camera_name | STRING | Nombre de la cámara |
| license_plate | STRING | Matrícula detectada |
| plate_confidence | FLOAT | Confianza de la detección (0-1) |
| vehicle_type | STRING | Tipo de vehículo |
| traffic_light_status | STRING | Estado del semáforo |
| speed_kmh | FLOAT | Velocidad en km/h |
| false_positive | BOOLEAN | Marcado como falso positivo |
| has_snapshot | BOOLEAN | Tiene imagen snapshot |
| has_clip | BOOLEAN | Tiene video clip |
| metadata | TEXT | Metadatos adicionales (JSON) |

### Índices Optimizados

- `idx_camera_timestamp`: Para búsquedas por cámara y fecha
- `idx_plate_timestamp`: Para búsquedas por matrícula
- `idx_traffic_light`: Para estadísticas de semáforos
- `idx_processed`: Para eventos procesados

## Códigos de Error

### Códigos HTTP

- `200`: Éxito
- `400`: Petición inválida
- `401`: No autorizado
- `404`: Recurso no encontrado
- `422`: Error de validación
- `500`: Error interno del servidor

### Errores Comunes

```json
{
  "detail": "Credenciales inválidas"
}
```

```json
{
  "detail": "Evento no encontrado"
}
```

## Configuración de Producción

### Recomendaciones

1. **Autenticación**: Cambiar credenciales por defecto
2. **HTTPS**: Usar proxy reverso (nginx) para SSL
3. **Base de datos**: Configurar backups regulares
4. **Logs**: Configurar logging apropiado
5. **Firewall**: Restringir acceso al puerto 2221

### Ejemplo de Configuración Nginx

```nginx
server {
    listen 443 ssl;
    server_name lpr.example.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location /api/ {
        proxy_pass http://localhost:2221/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Ejemplo de Servicio Systemd

```ini
[Unit]
Description=LPR API Service
After=network.target

[Service]
Type=simple
User=lpr
WorkingDirectory=/path/to/lpr_backend
ExecStart=/usr/bin/python -m app.main
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

## Troubleshooting

### Problemas Comunes

1. **Error de conexión MQTT**
   - Verificar configuración MQTT en `/api/preferences`
   - Comprobar que el broker esté accesible

2. **No se reciben eventos**
   - Verificar suscripción a topics MQTT
   - Comprobar formato de mensajes de Frigate

3. **Error de base de datos**
   - Verificar permisos de escritura en carpeta `DB/`
   - Comprobar espacio en disco

4. **API no responde**
   - Verificar que el servicio esté ejecutándose en puerto 2221
   - Comprobar logs del servidor

### Logs

El sistema registra actividad en la consola. Para producción, redirigir a archivos:

```bash
python -m app.main > lpr.log 2>&1
```

## Ejemplo de Uso

### Script Python de Ejemplo

```python
import requests
from requests.auth import HTTPBasicAuth

# Configuración
API_BASE = "http://localhost:2221/api"
auth = HTTPBasicAuth('admin', 'password')

# Obtener eventos de hoy
response = requests.get(
    f"{API_BASE}/events",
    auth=auth,
    params={
        'start_date': '2025-01-06T00:00:00',
        'end_date': '2025-01-06T23:59:59',
        'limit': 100
    }
)

events = response.json()
print(f"Eventos encontrados: {events['total']}")

# Marcar evento como falso positivo
if events['events']:
    event_id = events['events'][0]['id']
    requests.put(
        f"{API_BASE}/events/{event_id}",
        auth=auth,
        json={'false_positive': True}
    )
    print(f"Evento {event_id} marcado como falso positivo")
```

## Versionado y Compatibilidad

- **Versión actual**: 1.0.0
- **Compatibilidad**: ExalinkHub v0.0.14+
- **API estable**: Los endpoints principales son estables
- **Cambios**: Se documentarán breaking changes

## Soporte

Para reportar issues o solicitar nuevas funcionalidades, usar el sistema de issues del proyecto ExalinkHub.