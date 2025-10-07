# Sistema LPR Backend

Backend del sistema de reconocimiento de matrículas (LPR) integrado con Frigate NVR.

## Características

- 🚗 Reconocimiento automático de matrículas
- 📡 Integración MQTT con Frigate NVR  
- 🗄️ Base de datos SQLite para almacenamiento
- 🌐 API REST con FastAPI
- 📊 Exportación a Excel de eventos
- 🔄 Procesamiento en tiempo real
- 🎯 Filtrado de falsos positivos
- 📷 Gestión de snapshots y clips
- ⚙️ Configuración avanzada por API

## Requisitos

### Software
- Python 3.8+
- pip (gestor de paquetes Python)

### Hardware
- 1GB RAM mínimo
- 10GB espacio en disco (para almacenar eventos y medios)
- Conexión de red estable

### Servicios Externos
- Frigate NVR configurado y funcionando
- Broker MQTT (generalmente integrado con Frigate)

## Instalación

### Opción 1: Script Automático (Recomendado)

**Windows:**
```cmd
install.bat
```

**Linux/macOS:**
```bash
chmod +x install.sh
./install.sh
```

### Opción 2: Instalación Manual

1. **Instalar dependencias:**
```bash
pip install -r requirements.txt
```

2. **Crear directorios:**
```bash
mkdir -p data logs
```

3. **Configurar base de datos:**
```bash
python -c "from app.database import engine, Base; from app.models import *; Base.metadata.create_all(bind=engine)"
```

## Configuración

### Variables de Entorno (Opcional)

Crear archivo `.env` en la raíz del proyecto:

```env
# Configuración del servidor
LPR_HOST=localhost
LPR_PORT=2221
LPR_DEBUG=false

# Base de datos
DATABASE_URL=sqlite:///./data/lpr.db

# MQTT
MQTT_HOST=localhost
MQTT_PORT=1883
MQTT_USERNAME=
MQTT_PASSWORD=
MQTT_TOPIC_PREFIX=frigate

# Frigate
FRIGATE_HOST=localhost
FRIGATE_PORT=5000
FRIGATE_PROTOCOL=http

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/lpr.log
```

### Configuración Inicial

La configuración se realiza a través de la interfaz web o mediante API:

1. **Conectar con MQTT/Frigate**
2. **Seleccionar cámaras LPR**
3. **Configurar zonas de detección**
4. **Ajustar parámetros de confianza**

## Ejecución

### Desarrollo
```bash
python app/main.py
```

### Producción con Uvicorn
```bash
uvicorn app.main:app --host 0.0.0.0 --port 2221
```

### Producción con Gunicorn (Linux)
```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:2221
```

## API Endpoints

### Health Check
- `GET /health` - Estado del sistema

### Eventos LPR
- `GET /api/events` - Listar eventos
- `GET /api/events/{id}` - Obtener evento específico
- `PUT /api/events/{id}` - Actualizar evento
- `DELETE /api/events/{id}` - Eliminar evento
- `GET /api/events/export` - Exportar a Excel

### Configuración
- `GET /api/settings` - Obtener configuración
- `PUT /api/settings` - Actualizar configuración

### Cámaras
- `GET /api/cameras` - Listar cámaras disponibles
- `GET /api/cameras/{name}/events` - Eventos por cámara

### Estadísticas
- `GET /api/stats` - Estadísticas generales
- `GET /api/stats/cameras` - Estadísticas por cámara

## Documentación API

Una vez iniciado el servidor, la documentación interactiva está disponible en:
- **Swagger UI**: http://localhost:2221/docs
- **ReDoc**: http://localhost:2221/redoc

## Estructura del Proyecto

```
lpr_backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # Punto de entrada de la aplicación
│   ├── models.py            # Modelos de base de datos
│   ├── schemas.py           # Esquemas Pydantic
│   ├── database.py          # Configuración de base de datos
│   ├── crud.py              # Operaciones CRUD
│   └── api/
│       ├── __init__.py
│       ├── events.py        # Endpoints de eventos
│       ├── settings.py      # Endpoints de configuración
│       └── cameras.py       # Endpoints de cámaras
├── data/                    # Base de datos y archivos de datos
├── logs/                    # Archivos de log
├── requirements.txt         # Dependencias Python
├── install.bat             # Script de instalación Windows
├── install.sh              # Script de instalación Linux/macOS
└── README.md               # Este archivo
```

## Troubleshooting

### Error: "No se puede conectar al broker MQTT"
1. Verificar que Frigate esté ejecutándose
2. Verificar configuración MQTT en Frigate
3. Comprobar firewall y conectividad de red

### Error: "Frigate no accesible"
1. Verificar que Frigate esté ejecutándose en el puerto correcto
2. Verificar la URL de Frigate en la configuración
3. Comprobar que no hay problemas de CORS

### Error: "Base de datos bloqueada"
1. Verificar que no hay otra instancia ejecutándose
2. Comprobar permisos de escritura en el directorio `data/`
3. Reiniciar el servicio

### Sin eventos LPR
1. Verificar que las cámaras estén configuradas en Frigate
2. Comprobar que los objetos 'license_plate' estén habilitados
3. Verificar las zonas de detección
4. Revisar los logs del sistema

### Rendimiento lento
1. Verificar recursos del sistema (RAM, CPU)
2. Optimizar la base de datos: `VACUUM` y `ANALYZE`
3. Ajustar los parámetros de retención de datos
4. Considerar usar una base de datos más robusta (PostgreSQL)

## Desarrollo

### Estructura del Código
- **Modelos**: Definidos en `models.py` usando SQLAlchemy
- **Esquemas**: Validación con Pydantic en `schemas.py`
- **API**: Endpoints organizados por funcionalidad
- **Base de datos**: Operaciones CRUD centralizadas

### Testing
```bash
pytest
```

### Linting y Formateo
```bash
black app/
isort app/
mypy app/
```

## Contribución

1. Fork del repositorio
2. Crear rama de feature (`git checkout -b feature/nueva-funcionalidad`)
3. Commit cambios (`git commit -am 'Agregar nueva funcionalidad'`)
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Crear Pull Request

## Licencia

[Especificar licencia del proyecto]

## Soporte

Para reportar bugs o solicitar features, crear un issue en el repositorio del proyecto.