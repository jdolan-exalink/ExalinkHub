# 🔧 Guía Técnica del Sistema de Conteo

## 📋 Tabla de Contenidos

1. [Arquitectura del Sistema](#arquitectura-del-sistema)
2. [Configuración](#configuración)
3. [Lógica de Conteo](#lógica-de-conteo)
4. [Base de Datos](#base-de-datos)
5. [Deployment](#deployment)
6. [Troubleshooting](#troubleshooting)

---

## 🏗️ Arquitectura del Sistema

### Componentes Principales

```
┌─────────────────────────────────────────────────────────────┐
│                     SISTEMA DE CONTEO                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐         ┌──────────────┐                 │
│  │   Frigate    │ MQTT    │   Backend    │                 │
│  │   (NVR+IA)   │────────▶│   (Python)   │                 │
│  └──────────────┘         └───────┬──────┘                 │
│                                    │                         │
│                          ┌─────────┼─────────┐              │
│                          │         │         │              │
│                    ┌─────▼───┐ ┌──▼───┐ ┌──▼────┐          │
│                    │ SQLite  │ │ MQTT │ │  API  │          │
│                    │   DB    │ │ Pub  │ │ REST  │          │
│                    └─────────┘ └──────┘ └───┬───┘          │
│                                              │              │
│                                         ┌────▼────┐         │
│                                         │Frontend │         │
│                                         │Dashboard│         │
│                                         └─────────┘         │
└─────────────────────────────────────────────────────────────┘
```

### Stack Tecnológico

- **Backend:** Python 3.11 + FastAPI
- **Base de Datos:** SQLite
- **MQTT Client:** paho-mqtt
- **ORM:** SQLAlchemy
- **Container:** Docker + Docker Compose
- **IA/Detección:** Frigate NVR

---

## ⚙️ Configuración

### Archivo: `conteo.conf`

El sistema se configura mediante un archivo INI con las siguientes secciones:

#### 1. Configuración Global (`[app]`)

```ini
[app]
mode=multi                       # single | multi
timezone=America/Argentina/Cordoba
retention_days=30                # 0 = sin purga histórica
storage=sqlite:////app/DB/Conteo.db
log_level=INFO                   # DEBUG|INFO|WARNING|ERROR
publish_every_seconds=5          # frecuencia mínima para publicar totales
count_on=end                     # new|update|end
dedup_by=event_id                # event_id|track_id
min_event_duration_ms=400        # ignora eventos muy breves
cooldown_ms=800                  # evita doble conteo
```

#### 2. Objetos (`[objects]`)

```ini
[objects]
labels=car,motorcycle,bus,bicycle,person
min_confidence=0.55              # umbral global
min_area_px=3500                 # ignora detecciones chicas

# Mapeo de labels (inglés → español)
labels_map=person:personas,car:auto,bus:autobús,bicycle:bicicleta,motorcycle:moto
```

#### 3. Servidores MQTT (`[server:*]`)

```ini
[server:helvecia]
mqtt_broker=10.147.18.148
mqtt_port=1883
mqtt_user=
mqtt_pass=
mqtt_tls=false
mqtt_ca_file=
mqtt_client_id=contador-helvecia
mqtt_keepalive=30
mqtt_qos=0
topic_events=frigate/events
enabled=true
```

#### 4. Cámaras (`[camera:*]`)

```ini
[camera:Escuela]
server=helvecia
frigate_camera=Escuela           # nombre EXACTO en Frigate
mode=zones                       # zones | role
zone_in=IN                       # nombre EXACTO de zona en Frigate
zone_out=OUT
labels=car,motorcycle,bus,bicycle,person
```

#### 5. Contadores (`[counter:*]`)

```ini
[counter:escuela]
type=zones                       # zones | two_cameras
source_camera=Escuela            # referencia a [camera:<alias>]
objects=auto,moto,personas       # si se omite, usa los globales
zone_strategy=entered            # entered | present | both
min_frames_in_zone=1             # robustez
initial_occupancy=0
reset_schedule=00:00             # HH:MM (resetea diario)
publish_delta_only=true          # publica sólo cuando cambian
```

#### 6. Publicación MQTT (`[publish:mqtt]`)

```ini
[publish:mqtt]
enabled=true
server=helvecia                  # a qué broker publicar
topic_prefix=exacount            # exacount/<counter_id>/...
qos=0
retain=false
```

#### 7. Anti-ruido (`[anti_noise]`)

```ini
[anti_noise]
max_recount_ms=1500              # ventana anti-repetición
max_gap_ms_between_in_out=12000  # para type=two_cameras
count_only_if_label_in=          # filtro opcional
ignore_if_in_zones=              # zonas de descarte
```

---

## 🧮 Lógica de Conteo

### Algoritmo de Detección de Cruce

```python
# Pseudocódigo simplificado
def on_mqtt_event(event):
    # 1. Validar cámara configurada
    if event.camera not in CONFIGURED_CAMERAS:
        return
    
    # 2. Obtener object_id único de Frigate
    object_id = event.after.id
    
    # 3. Solo procesar eventos con zonas
    if not event.after.entered_zones:
        return
    
    # 4. Para cada zona cruzada
    for zone in event.after.entered_zones:
        direction = "IN" if "IN" in zone else "OUT"
        
        # 5. Crear clave única
        key = f"{object_id}_{camera}_{zone}_{direction}"
        
        # 6. Anti-repetición temporal
        if (now - last_crossing[key]) < ANTI_REPEAT_SECONDS:
            continue  # Duplicado, ignorar
        
        # 7. Registrar cruce
        last_crossing[key] = now
        
        # 8. Actualizar contadores
        if direction == "IN":
            counter.in += 1
            counter.occupancy += 1
        else:
            counter.out += 1
            counter.occupancy -= 1
        
        # 9. Publicar a MQTT
        publish_mqtt(counter_id, direction, totals)
        
        # 10. Guardar en DB
        save_event(event)
```

### Prevención de Duplicados

El sistema implementa **3 niveles** de deduplicación:

1. **Por Event ID:** Cada evento de Frigate tiene un ID único
2. **Por Object ID + Zona + Dirección:** Evita contar el mismo objeto múltiples veces en la misma zona
3. **Ventana Temporal:** No cuenta el mismo cruce si ocurre en menos de 1.5 segundos

### Cálculo de Occupancy

```
Occupancy = Total_IN - Total_OUT + Initial_Occupancy
```

Ejemplo:
- Initial: 0
- Entradas: 45
- Salidas: 43
- **Occupancy actual: 2**

---

## 🗄️ Base de Datos

### Schema SQLite

```sql
CREATE TABLE events (
    id TEXT PRIMARY KEY,           -- ID único del evento
    camera TEXT NOT NULL,          -- Nombre de la cámara
    label TEXT NOT NULL,           -- Tipo de objeto (auto, moto, etc)
    start_time TIMESTAMP,          -- Inicio del evento
    end_time TIMESTAMP NOT NULL,   -- Fin del evento
    zone TEXT                      -- Zona detectada (IN, OUT)
);

CREATE INDEX idx_events_camera ON events(camera);
CREATE INDEX idx_events_end_time ON events(end_time);
CREATE INDEX idx_events_zone ON events(zone);
```

### Ubicación

- **Host:** `./DB/Conteo.db`
- **Container:** `/app/DB/Conteo.db`

### Consultas Útiles

```sql
-- Total de eventos por cámara
SELECT camera, COUNT(*) as total
FROM events
GROUP BY camera;

-- Eventos de hoy
SELECT *
FROM events
WHERE DATE(end_time) = DATE('now');

-- Entradas vs Salidas por hora
SELECT 
    strftime('%H', end_time) as hour,
    zone,
    COUNT(*) as count
FROM events
WHERE DATE(end_time) = DATE('now')
GROUP BY hour, zone
ORDER BY hour;

-- Objetos más detectados
SELECT label, COUNT(*) as total
FROM events
GROUP BY label
ORDER BY total DESC;
```

---

## 🚀 Deployment

### Estructura de Archivos

```
Conteo/
├── docker-compose.yml          # Orquestación
├── conteo.conf                 # Configuración principal
├── .env                        # Variables de entorno
├── DB/                         # Base de datos
│   └── Conteo.db
├── LOG/                        # Logs del sistema
│   ├── conteo.log
│   └── stats.log
├── services/
│   └── api/
│       ├── Dockerfile
│       ├── requirements.txt
│       └── app/
│           └── app.py          # Aplicación principal
├── API_DOCUMENTATION.md        # Documentación API
└── TECHNICAL_GUIDE.md          # Esta guía
```

### Docker Compose

```yaml
services:
  api:
    build: { context: ./services/api }
    image: conteo-api
    container_name: conteo_api
    restart: unless-stopped
    ports: [ "2222:8000" ]
    volumes:
      - ./DB:/app/DB
      - ./conteo.conf:/app/conteo.conf:ro
      - ./LOG:/app/LOG
    networks: [ net ]

networks:
  net: { driver: bridge }
```

### Comandos de Deployment

```bash
# Iniciar el sistema
docker compose up -d --build

# Ver logs en tiempo real
docker logs -f conteo_api

# Detener el sistema
docker compose down

# Reiniciar sin rebuild
docker compose restart

# Ver estado
docker ps

# Acceder al contenedor
docker exec -it conteo_api bash
```

### Variables de Entorno

Crear archivo `.env`:

```bash
APP_VERSION=1.0.0
LOG_LEVEL=INFO
TZ=America/Argentina/Cordoba
```

---

## 🔍 Troubleshooting

### Problema: No se cuentan objetos

**Síntomas:**
- Logs muestran eventos de Frigate pero no hay conteos
- `CAMERA_ZONE_COUNTS` está vacío

**Diagnóstico:**
```bash
# Ver logs
docker logs conteo_api | grep "COUNT"

# Verificar configuración
docker exec conteo_api cat /app/conteo.conf
```

**Soluciones:**

1. **Verificar que la cámara está configurada:**
   ```ini
   [camera:Escuela]
   frigate_camera=Escuela  # Debe coincidir EXACTAMENTE con Frigate
   ```

2. **Verificar que hay un contador para esa cámara:**
   ```ini
   [counter:escuela]
   source_camera=Escuela   # Debe coincidir con el alias de [camera:*]
   ```

3. **Verificar zonas en Frigate:**
   - Las zonas deben llamarse `IN` y `OUT` (o lo configurado en `zone_in`/`zone_out`)
   - Frigate debe reportar `entered_zones` en los eventos

4. **Verificar objetos permitidos:**
   ```ini
   [counter:escuela]
   objects=auto,moto,personas  # Debe incluir el tipo de objeto
   ```

---

### Problema: Duplicados (cuenta 5 veces la misma moto)

**Síntomas:**
- El mismo objeto se cuenta múltiples veces
- `COUNTER_TOTALS` tiene valores muy altos

**Diagnóstico:**
```bash
# Ver eventos duplicados
docker exec conteo_api sqlite3 /app/DB/Conteo.db "
  SELECT camera, label, zone, COUNT(*) as cnt
  FROM events
  WHERE DATE(end_time) = DATE('now')
  GROUP BY camera, label, zone
  HAVING cnt > 10
"
```

**Soluciones:**

1. **Ajustar ventana anti-repetición:**
   ```ini
   [anti_noise]
   max_recount_ms=3000  # Aumentar a 3 segundos
   ```

2. **Verificar que Frigate asigna IDs únicos:**
   - Revisar eventos MQTT de Frigate
   - Debe tener campo `after.id` con un UUID

3. **Verificar configuración de tracking en Frigate:**
   ```yaml
   # frigate.yml
   detect:
     max_disappeared: 30  # Frames antes de perder tracking
   ```

---

### Problema: No se conecta a MQTT

**Síntomas:**
- Logs: `[helvecia] mqtt reconnect in 5s`
- `SERVERS_STATE` muestra `connected: false`

**Diagnóstico:**
```bash
# Verificar conectividad
docker exec conteo_api ping 10.147.18.148

# Probar MQTT manualmente
mosquitto_sub -h 10.147.18.148 -t "frigate/events" -v
```

**Soluciones:**

1. **Verificar configuración del broker:**
   ```ini
   [server:helvecia]
   mqtt_broker=10.147.18.148  # IP correcta
   mqtt_port=1883             # Puerto correcto
   ```

2. **Verificar firewall:**
   ```bash
   # Permitir puerto 1883
   sudo ufw allow 1883/tcp
   ```

3. **Verificar credenciales:**
   ```ini
   mqtt_user=tu_usuario
   mqtt_pass=tu_password
   ```

---

### Problema: Base de datos no se crea

**Síntomas:**
- Error: `unable to open database file`
- Contenedor se reinicia constantemente

**Diagnóstico:**
```bash
# Verificar permisos
ls -la DB/

# Verificar mount
docker inspect conteo_api | grep -A 10 Mounts
```

**Soluciones:**

1. **Crear carpeta DB manualmente:**
   ```bash
   mkdir -p DB
   touch DB/Conteo.db
   chmod 777 DB/Conteo.db
   ```

2. **Verificar docker-compose.yml:**
   ```yaml
   volumes:
     - ./DB:/app/DB  # Path correcto
   ```

3. **En Windows, usar path absoluto:**
   ```yaml
   volumes:
     - C:/Users/juan/Documents/DEVs/backends/Conteo/DB:/app/DB
   ```

---

### Problema: API no responde

**Síntomas:**
- `curl http://localhost:2222/api/info` timeout
- No hay logs de requests

**Diagnóstico:**
```bash
# Verificar que el contenedor está corriendo
docker ps | grep conteo_api

# Verificar puerto
netstat -an | grep 2222

# Ver logs de uvicorn
docker logs conteo_api | grep "Uvicorn running"
```

**Soluciones:**

1. **Verificar puerto en docker-compose.yml:**
   ```yaml
   ports: [ "2222:8000" ]  # Host:Container
   ```

2. **Reiniciar contenedor:**
   ```bash
   docker compose restart
   ```

3. **Verificar que uvicorn arrancó:**
   ```bash
   docker logs conteo_api | tail -20
   # Debe mostrar: "Uvicorn running on http://0.0.0.0:8000"
   ```

---

### Problema: Occupancy negativo

**Síntomas:**
- `occupancy: -5` en los contadores
- Más salidas que entradas

**Causas:**
- Objetos que estaban dentro antes de iniciar el sistema
- Falsos positivos en zona OUT
- Sistema reiniciado con objetos dentro

**Soluciones:**

1. **Configurar occupancy inicial:**
   ```ini
   [counter:escuela]
   initial_occupancy=10  # Si sabés que hay 10 objetos dentro
   ```

2. **Reset manual vía API:**
   ```python
   # Agregar endpoint de reset (futuro)
   @app.post("/api/counters/{counter_id}/reset")
   def reset_counter(counter_id: str, occupancy: int = 0):
       COUNTER_TOTALS[counter_id] = {"in": 0, "out": 0, "occupancy": occupancy}
   ```

3. **Reset automático diario:**
   ```ini
   [counter:escuela]
   reset_schedule=00:00  # Reset a medianoche
   ```

---

## 📊 Monitoreo y Métricas

### Logs del Sistema

**Ubicación:** `LOG/conteo.log`

**Formato:**
```
2025-10-20 22:35:15 INFO ✅ COUNT [Escuela] auto (car) IN zone=IN counters=[escuela] id=abc12345...
2025-10-20 22:35:20 INFO 📤 Published totals to exacount/escuela/totals: {"in":1,"out":0,...}
```

### Logs de Estadísticas

**Ubicación:** `LOG/stats.log`

**Formato:** JSON lines
```json
{"ts":"2025-10-20T22:35:00Z","camera":"Escuela","label":"auto","count":45}
{"ts":"2025-10-20T22:35:00Z","camera":"Cementerio","label":"moto","count":12}
```

### Reporte de Estado (cada minuto)

```
==================================================
📊 APP STATUS
==================================================
🔧 Mode: multi    💾 DB: Conteo.db

🌐 SERVERS
--------------------------------------------------
✅ [helvecia] 10.147.18.148:1883

📹 CAMERAS (IN/OUT)
--------------------------------------------------
  🎥 Escuela
     ⬇️  IN:   45   ⬆️  OUT:  43   (balance: +2)

🎯 COUNTERS
--------------------------------------------------
  📍 escuela
     ⬇️  IN:  45   ⬆️  OUT:  43   👤 Occupancy:   2

📈 OBJECTS DETECTED
--------------------------------------------------
  🚗 auto: 38
  🏍️ moto: 15
  👥 personas: 9

📊 Total events: 62   🕐 Last: 2025-10-20T22:35:15Z
==================================================
```

---

## 🔐 Seguridad

### Recomendaciones para Producción

1. **Agregar autenticación:**
   ```python
   from fastapi.security import HTTPBearer
   
   security = HTTPBearer()
   
   @app.get("/api/counters")
   def api_counters(credentials: HTTPAuthorizationCredentials = Depends(security)):
       # Validar token
       pass
   ```

2. **Habilitar HTTPS:**
   ```yaml
   # docker-compose.yml
   services:
     nginx:
       image: nginx
       ports: ["443:443"]
       volumes:
         - ./ssl:/etc/nginx/ssl
   ```

3. **Rate limiting:**
   ```python
   from slowapi import Limiter
   
   limiter = Limiter(key_func=get_remote_address)
   
   @app.get("/api/events")
   @limiter.limit("100/minute")
   def api_events():
       pass
   ```

4. **CORS configurado:**
   ```python
   from fastapi.middleware.cors import CORSMiddleware
   
   app.add_middleware(
       CORSMiddleware,
       allow_origins=["https://tu-frontend.com"],
       allow_methods=["GET", "POST"],
       allow_headers=["*"],
   )
   ```

---

## 🧪 Testing

### Test Manual de Endpoints

```bash
# Health check
curl http://localhost:2222/api/info

# Contadores
curl http://localhost:2222/api/counters

# Eventos recientes
curl "http://localhost:2222/api/events?limit=10"

# Histórico
curl "http://localhost:2222/api/counters/escuela/history?start_date=2025-10-20"
```

### Test de MQTT

```bash
# Suscribirse a eventos de conteo
mosquitto_sub -h 10.147.18.148 -t "exacount/#" -v

# Simular evento de Frigate (para testing)
mosquitto_pub -h 10.147.18.148 -t "frigate/events" -m '{
  "type": "end",
  "after": {
    "id": "test-123",
    "camera": "Escuela",
    "label": "person",
    "entered_zones": ["IN"]
  }
}'
```

---

## 📚 Referencias

- **FastAPI:** https://fastapi.tiangolo.com/
- **Frigate:** https://docs.frigate.video/
- **paho-mqtt:** https://www.eclipse.org/paho/index.php?page=clients/python/index.php
- **SQLAlchemy:** https://www.sqlalchemy.org/

---

**Versión:** 1.0.0  
**Última actualización:** 2025-10-20
