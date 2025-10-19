# Módulo LPR (License Plate Recognition) - Guía de Uso

## Descripción General

El módulo LPR de ExalinkHub es un sistema completo de reconocimiento y gestión de matrículas que se integra con Frigate para el procesamiento de eventos en tiempo real. Proporciona una interfaz moderna con filtros avanzados, estadísticas detalladas y capacidades de exportación.

## Características Principales

### 🎯 Funcionalidades Core

- **Reconocimiento en tiempo real**: Procesamiento automático de eventos de Frigate
- **Gestión de eventos**: Visualización, filtrado y edición de detecciones
- **Estadísticas avanzadas**: Métricas por cámaras, períodos y tipos
- **Exportación de datos**: Formatos Excel y CSV con imágenes
- **Interfaz bilingüe**: Soporte para español, inglés y portugués
- **Sistema dual**: Coexistencia con el sistema LPR existente

### 🔧 Capacidades Técnicas

- **API REST completa**: Backend independiente con documentación Swagger
- **Base de datos optimizada**: SQLite con índices para consultas rápidas
- **Integración MQTT**: Suscripción automática a eventos de Frigate
- **Autenticación HTTP**: Protección con credenciales configurables
- **Enriquecimiento de datos**: Añade información de semáforos, velocidad y contexto
- **Gestión de medios**: URLs automáticas para snapshots y clips

## Instalación y Configuración

### Requisitos Previos

1. **ExalinkHub** v0.0.14 o superior
2. **Python** 3.11+ instalado
3. **Frigate** funcionando con MQTT habilitado
4. **Broker MQTT** accesible (Mosquitto recomendado)

### Instalación del Backend

```bash
# Navegar al directorio del backend
cd lpr_backend/

# Instalar dependencias
pip install -r requirements.txt

# Iniciar el servicio
python -m app.main
```

El servicio se ejecutará en `http://localhost:2221`

### Configuración Inicial

1. **Acceder a ExalinkHub** → **Navegación** → **Placas LPR**
2. **Seleccionar pestaña "Sistema Mejorado"**
3. **Configurar credenciales de autenticación** (primera vez)
4. **Configurar conexión MQTT y Frigate**

#### Configuración Típica

```json
{
  "mqtt": {
    "host": "192.168.1.100",
    "port": 1883,
    "username": "frigate",
    "password": "password",
    "topic_prefix": "frigate"
  },
  "frigate": {
    "host": "192.168.1.100",
    "port": 5000,
    "use_ssl": false
  },
  "retention_days": 30
}
```

## Uso del Sistema

### Panel Principal

El panel LPR se divide en varias secciones:

#### 1. **Filtros Avanzados**
- **Período**: Selección de fechas específicas o rangos predefinidos
- **Cámaras**: Filtrado por cámaras específicas
- **Matrículas**: Búsqueda por texto completo o parcial
- **Tipos de vehículo**: Car, truck, motorcycle, bus, bicycle
- **Estado semáforo**: Red, yellow, green, unknown
- **Confianza**: Nivel mínimo de confianza de detección

#### 2. **Tarjetas de Estadísticas**
- **Total de eventos**: Contador general con tendencia
- **Eventos hoy**: Actividad del día actual
- **Cámaras activas**: Número de cámaras con detecciones
- **Promedio de confianza**: Media de precisión de detecciones

#### 3. **Tabla de Eventos**
Muestra eventos paginados con:
- **Información básica**: Matrícula, cámara, timestamp
- **Detalles técnicos**: Confianza, tipo de vehículo, velocidad
- **Estado contextual**: Semáforo, zona, dirección
- **Medios**: Botones para ver snapshot y clip
- **Acciones**: Editar, marcar como falso positivo, eliminar

#### 4. **Controles de Acción**
- **Exportar**: Descarga filtrada en Excel/CSV
- **Actualizar**: Recargar datos manualmente
- **Configuración**: Acceso a preferencias del sistema

### Flujos de Trabajo Comunes

#### 🔍 **Buscar Eventos de una Matrícula**

1. Usar el filtro **"Buscar matrícula"**
2. Introducir la matrícula completa o parcial
3. Aplicar filtros adicionales si es necesario
4. Revisar resultados en la tabla

#### 📊 **Analizar Actividad por Cámara**

1. Seleccionar período en **"Filtros de fecha"**
2. Elegir cámara específica en **"Filtro por cámara"**
3. Revisar estadísticas en las tarjetas superiores
4. Exportar datos para análisis externo

#### ✏️ **Corregir Falsos Positivos**

1. Localizar el evento incorrecto
2. Hacer clic en **"Acciones"** → **"Editar"**
3. Marcar **"Falso positivo"** o corregir datos
4. Guardar cambios

#### 📈 **Exportar Reportes**

1. Configurar filtros deseados
2. Hacer clic en **"Exportar"**
3. Seleccionar formato (Excel/CSV)
4. Elegir si incluir imágenes
5. Descargar archivo generado

## Gestión de Datos

### Estructura de Eventos

Cada evento LPR contiene:

```typescript
interface plate_event {
  id: number;
  frigate_event_id: string;
  timestamp: string;
  camera_name: string;
  license_plate: string;
  plate_confidence: number;
  vehicle_type: 'car' | 'truck' | 'motorcycle' | 'bus' | 'bicycle';
  vehicle_color?: string;
  speed_kmh?: number;
  traffic_light_status: 'red' | 'yellow' | 'green' | 'unknown';
  zone?: string;
  direction?: string;
  false_positive: boolean;
  snapshot_url?: string;
  clip_url?: string;
}
```

### Políticas de Retención

- **Por defecto**: 30 días de retención
- **Configurable**: Mediante API o interfaz
- **Limpieza automática**: Proceso nocturno
- **Optimización**: Compactación automática de BD

### Backup y Restauración

```bash
# Backup manual
cp lpr_backend/DB/matriculas.db backup/matriculas_$(date +%Y%m%d).db

# Restauración
cp backup/matriculas_20250106.db lpr_backend/DB/matriculas.db
```

## Integración con ExalinkHub

### Navegación

El módulo se integra en la estructura de navegación principal:
- **Ruta**: `/[locale]/(app)/plates-lpr`
- **Menú**: **Navegación** → **Placas LPR**
- **Sistema dual**: Pestañas para sistema clásico y mejorado

### Autenticación

- **Reutiliza**: Sistema de autenticación de ExalinkHub
- **Independiente**: Autenticación propia para API backend
- **Configuración**: A través de interfaz integrada

### Temas e Idiomas

- **Soporte**: Español, inglés, portugués
- **Temas**: Dark/Light mode automático
- **Componentes**: Uso de sistema de componentes UI de ExalinkHub

## Monitoreo y Mantenimiento

### Health Check

Endpoint disponible en `http://localhost:2221/health`

```json
{
  "status": "healthy",
  "mqtt_connected": true,
  "database_connected": true,
  "frigate_accessible": true,
  "last_event_time": "2025-01-06T10:30:00Z"
}
```

### Logs y Debugging

#### Logs del Backend
```bash
# Ver logs en tiempo real
python -m app.main

# Logs de producción
python -m app.main > lpr.log 2>&1 &
```

#### Logs del Frontend
- **Console del navegador**: Errores de React/TypeScript
- **Network tab**: Calls API y respuestas
- **ExalinkHub logs**: Logs generales de la aplicación

### Troubleshooting Común

#### ❌ **No se muestran eventos**

**Causas posibles:**
1. Backend no está ejecutándose
2. Configuración MQTT incorrecta
3. Frigate no está enviando eventos

**Soluciones:**
```bash
# Verificar backend
curl http://localhost:2221/health

# Verificar MQTT
mosquitto_sub -h localhost -t "frigate/events"

# Verificar configuración
curl -u admin:password http://localhost:2221/api/preferences
```

#### ❌ **Error de autenticación**

**Causas posibles:**
1. Credenciales no configuradas
2. Backend reiniciado (credenciales en memoria)

**Soluciones:**
1. Reconfigurar credenciales en la interfaz
2. Verificar endpoint `/api/preferences`

#### ❌ **Rendimiento lento**

**Causas posibles:**
1. Base de datos grande sin optimizar
2. Filtros muy amplios
3. Muchas imágenes cargándose

**Soluciones:**
```bash
# Optimizar base de datos
curl -X POST -u admin:password http://localhost:2221/api/maintenance/optimize

# Limpiar eventos antiguos
curl -X POST -u admin:password http://localhost:2221/api/maintenance/cleanup
```

## API y Desarrollo

### Endpoints Principales

- **Eventos**: `GET /api/events` - Lista paginada con filtros
- **Estadísticas**: `GET /api/stats` - Métricas del sistema
- **Configuración**: `GET/POST /api/preferences` - Gestión de config
- **Exportación**: `POST /api/export` - Generación de reportes
- **Mantenimiento**: `/api/maintenance/*` - Operaciones de sistema

### Documentación Interactiva

Swagger UI disponible en: `http://localhost:2221/docs`

### Ejemplos de Integración

#### JavaScript/Fetch
```javascript
const response = await fetch('http://localhost:2221/api/events', {
  headers: {
    'Authorization': 'Basic ' + btoa('admin:password')
  }
});
const data = await response.json();
```

#### Python/Requests
```python
import requests
from requests.auth import HTTPBasicAuth

response = requests.get(
  'http://localhost:2221/api/events',
  auth=HTTPBasicAuth('admin', 'password')
)
events = response.json()
```

## Configuración Avanzada

### Variables de Entorno

```bash
# Backend
export LPR_HOST=0.0.0.0
export LPR_PORT=2221
export LPR_DB_PATH=/custom/path/matriculas.db

# Logging
export LPR_LOG_LEVEL=INFO
export LPR_LOG_FILE=/var/log/lpr.log
```

### Configuración de Producción

#### Nginx Proxy
```nginx
location /lpr/ {
    proxy_pass http://localhost:2221/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

#### Systemd Service
```ini
[Unit]
Description=LPR Backend Service
After=network.target mosquitto.service

[Service]
Type=simple
User=lpr
WorkingDirectory=/opt/exalinkhub/lpr_backend
ExecStart=/usr/bin/python -m app.main
Restart=always
RestartSec=5
Environment=LPR_HOST=127.0.0.1
Environment=LPR_PORT=2221

[Install]
WantedBy=multi-user.target
```

## Roadmap y Futuras Mejoras

### Próximas Funcionalidades

- **Alertas en tiempo real**: Notificaciones push para eventos específicos
- **Reconocimiento de personas**: Integración con detectores de personas
- **Machine Learning**: Mejora automática de precisión
- **Dashboard avanzado**: Gráficos temporales y mapas de calor
- **Integración móvil**: App móvil para gestión remota

### Optimizaciones Planificadas

- **Cache Redis**: Mejora de rendimiento para consultas frecuentes
- **Clustering**: Soporte para múltiples instancias
- **Almacenamiento en nube**: Backup automático a S3/MinIO
- **Streaming**: WebSocket para actualizaciones en tiempo real

## Soporte y Comunidad

### Documentación Adicional

- **API Reference**: `/context/lpr-api-documentation.md`
- **Architecture**: `/context/blueprint.md`
- **Authentication**: `/context/sistema-autenticacion.md`

### Reportar Issues

1. **GitHub Issues**: Proyecto ExalinkHub
2. **Información requerida**:
   - Logs del backend
   - Configuración actual
   - Pasos para reproducir
   - Entorno (OS, versiones)

### Contribuir

1. **Fork** del repositorio
2. **Branch** de feature: `git checkout -b feature/lpr-improvement`
3. **Commit** con convención: `feat(lpr): add new filter option`
4. **Pull Request** con descripción detallada

---

**Nota**: Este módulo está en desarrollo activo. Para la versión más actualizada de la documentación, consultar el repositorio oficial de ExalinkHub.