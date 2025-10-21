# 📚 API Documentation - Sistema de Conteo de Objetos

## 🌐 Información General

**Base URL:** `http://localhost:2222`  
**Formato:** JSON  
**Puerto:** 2222  

---

## 📋 Índice

1. [Información del Sistema](#información-del-sistema)
2. [Contadores](#contadores)
3. [Cámaras](#cámaras)
4. [Eventos](#eventos)
5. [Estadísticas](#estadísticas)
6. [MQTT Topics](#mqtt-topics)
7. [Modelos de Datos](#modelos-de-datos)

---

## 🔧 Información del Sistema

### GET /api/info
Obtiene información básica del sistema.

**Request:**
```bash
GET http://localhost:2222/api/info
```

**Response:**
```json
{
  "mode": "multi",
  "title": "Todas",
  "cameras": ["Escuela", "Cementerio"]
}
```

### GET /api/state
Obtiene el estado actual del sistema (objetos activos).

**Request:**
```bash
GET http://localhost:2222/api/state
```

**Response:**
```json
{
  "camera": "Todas",
  "activos": ["auto", "moto", "personas"],
  "objetos": ["auto", "bicicleta", "moto", "personas"]
}
```

---

## 🎯 Contadores

### GET /api/counters
Lista todos los contadores configurados con sus totales actuales.

**Request:**
```bash
GET http://localhost:2222/api/counters
```

**Response:**
```json
{
  "counters": [
    {
      "id": "escuela",
      "type": "zones",
      "source_camera": "Escuela",
      "objects": ["auto", "moto", "personas"],
      "totals": {
        "in": 45,
        "out": 43,
        "occupancy": 2
      },
      "config": {
        "zone_strategy": "entered",
        "initial_occupancy": 0,
        "reset_schedule": "00:00"
      }
    },
    {
      "id": "cementerio",
      "type": "zones",
      "source_camera": "Cementerio",
      "objects": ["auto", "moto", "personas"],
      "totals": {
        "in": 12,
        "out": 8,
        "occupancy": 4
      },
      "config": {
        "zone_strategy": "entered",
        "initial_occupancy": 0,
        "reset_schedule": "00:00"
      }
    }
  ],
  "count": 2
}
```

**Campos:**
- `id`: Identificador único del contador
- `type`: Tipo de contador (`zones` o `two_cameras`)
- `source_camera`: Cámara asociada (alias)
- `objects`: Lista de objetos que cuenta
- `totals.in`: Total de entradas
- `totals.out`: Total de salidas
- `totals.occupancy`: Ocupación actual (in - out)

---

### GET /api/counters/{counter_id}
Obtiene información detallada de un contador específico.

**Request:**
```bash
GET http://localhost:2222/api/counters/escuela
```

**Response:**
```json
{
  "id": "escuela",
  "type": "zones",
  "source_camera": "Escuela",
  "objects": ["auto", "moto", "personas"],
  "totals": {
    "in": 45,
    "out": 43,
    "occupancy": 2
  },
  "config": {
    "zone_strategy": "entered",
    "min_frames_in_zone": 1,
    "initial_occupancy": 0,
    "reset_schedule": "00:00",
    "publish_delta_only": true
  }
}
```

**Errores:**
- `404`: Contador no encontrado

---

### GET /api/counters/{counter_id}/history
Obtiene el histórico de un contador agrupado por hora o día.

**Request:**
```bash
GET http://localhost:2222/api/counters/escuela/history?start_date=2025-10-20&group_by=hour
```

**Query Parameters:**
- `start_date` (opcional): Fecha de inicio (formato: YYYY-MM-DD). Default: hace 24 horas
- `end_date` (opcional): Fecha de fin (formato: YYYY-MM-DD). Default: ahora
- `group_by` (opcional): Agrupación (`hour` o `day`). Default: `hour`

**Response:**
```json
{
  "counter_id": "escuela",
  "camera": "Escuela",
  "start_date": "2025-10-20T00:00:00",
  "end_date": "2025-10-21T00:00:00",
  "group_by": "hour",
  "history": [
    {
      "timestamp": "2025-10-20 08:00:00",
      "in": 12,
      "out": 8,
      "occupancy_change": 4
    },
    {
      "timestamp": "2025-10-20 09:00:00",
      "in": 15,
      "out": 10,
      "occupancy_change": 5
    },
    {
      "timestamp": "2025-10-20 10:00:00",
      "in": 18,
      "out": 15,
      "occupancy_change": 3
    }
  ]
}
```

**Uso típico:**
```javascript
// Gráfico de entradas/salidas por hora
fetch('http://localhost:2222/api/counters/escuela/history?start_date=2025-10-20&group_by=hour')
  .then(res => res.json())
  .then(data => {
    const labels = data.history.map(h => h.timestamp);
    const inData = data.history.map(h => h.in);
    const outData = data.history.map(h => h.out);
    // Usar con Chart.js, Recharts, etc.
  });
```

---

## 📹 Cámaras

### GET /api/cameras
Lista todas las cámaras configuradas con sus totales.

**Request:**
```bash
GET http://localhost:2222/api/cameras
```

**Response:**
```json
{
  "cameras": [
    {
      "alias": "Escuela",
      "frigate_camera": "Escuela",
      "server": "helvecia",
      "mode": "zones",
      "zone_in": "IN",
      "zone_out": "OUT",
      "totals": {
        "in": 45,
        "out": 43,
        "balance": 2
      }
    },
    {
      "alias": "Cementerio",
      "frigate_camera": "Cementerio",
      "server": "helvecia",
      "mode": "zones",
      "zone_in": "IN",
      "zone_out": "OUT",
      "totals": {
        "in": 12,
        "out": 8,
        "balance": 4
      }
    }
  ],
  "count": 2
}
```

**Campos:**
- `alias`: Nombre interno de la cámara
- `frigate_camera`: Nombre en Frigate (debe coincidir exactamente)
- `server`: Servidor MQTT al que está conectada
- `mode`: Modo de operación (`zones` o `role`)
- `zone_in`: Nombre de la zona de entrada
- `zone_out`: Nombre de la zona de salida
- `totals.balance`: Diferencia entre entradas y salidas

---

## 📊 Eventos

### GET /api/events
Consulta eventos con filtros opcionales.

**Request:**
```bash
GET http://localhost:2222/api/events?camera=Escuela&zone=IN&limit=50
```

**Query Parameters:**
- `camera` (opcional): Filtrar por cámara
- `zone` (opcional): Filtrar por zona (IN, OUT)
- `label` (opcional): Filtrar por tipo de objeto (auto, moto, personas)
- `start_date` (opcional): Fecha de inicio (YYYY-MM-DD)
- `end_date` (opcional): Fecha de fin (YYYY-MM-DD)
- `limit` (opcional): Número máximo de resultados (default: 100, max: 1000)

**Response:**
```json
{
  "events": [
    {
      "id": "abc123_Escuela_IN_1729467890000",
      "camera": "Escuela",
      "label": "auto",
      "start_time": "2025-10-20T22:30:00",
      "end_time": "2025-10-20T22:30:15",
      "zone": "IN"
    },
    {
      "id": "def456_Escuela_OUT_1729467920000",
      "camera": "Escuela",
      "label": "moto",
      "start_time": "2025-10-20T22:31:00",
      "end_time": "2025-10-20T22:31:12",
      "zone": "OUT"
    }
  ],
  "count": 2
}
```

**Ejemplos de uso:**

```bash
# Últimos 50 eventos de la cámara Escuela
GET /api/events?camera=Escuela&limit=50

# Todas las entradas (zona IN) de hoy
GET /api/events?zone=IN&start_date=2025-10-20

# Todos los autos detectados
GET /api/events?label=auto&limit=100

# Eventos de una cámara en un rango de fechas
GET /api/events?camera=Cementerio&start_date=2025-10-15&end_date=2025-10-20
```

---

## 📈 Estadísticas

### GET /api/summary
Obtiene resumen estadístico por día, semana o mes.

**Request:**
```bash
GET http://localhost:2222/api/summary?view=day&date=2025-10-20&camera=Escuela
```

**Query Parameters:**
- `view` (opcional): Vista temporal (`day`, `week`, `month`). Default: `day`
- `date` (opcional): Fecha de referencia (YYYY-MM-DD). Default: hoy
- `camera` (opcional): Filtrar por cámara. Default: todas

**Response:**
```json
{
  "totals": [
    {"label": "auto", "cnt": 45},
    {"label": "moto", "cnt": 23},
    {"label": "personas", "cnt": 12}
  ],
  "by_hour": {
    "labels": ["00", "01", "02", ..., "23"],
    "rows": [
      {"idx": 8, "label": "auto", "cnt": 5},
      {"idx": 8, "label": "moto", "cnt": 2},
      {"idx": 9, "label": "auto", "cnt": 8}
    ]
  },
  "by_bucket": {
    "labels": ["2025-10-20"],
    "rows": [
      {"idx": 0, "label": "auto", "cnt": 45},
      {"idx": 0, "label": "moto", "cnt": 23}
    ]
  }
}
```

---

## 📡 MQTT Topics

El sistema publica eventos de conteo en tiempo real vía MQTT.

### Configuración
- **Broker:** 10.147.18.148:1883
- **Prefix:** `exacount`

### Topics Publicados

#### 1. Totales del Contador
**Topic:** `exacount/{counter_id}/totals`

**Payload:**
```json
{
  "in": 45,
  "out": 43,
  "occupancy": 2,
  "ts": "2025-10-20T22:35:15Z"
}
```

**Frecuencia:** Cada vez que hay un evento de conteo

**Ejemplo de suscripción:**
```bash
mosquitto_sub -h 10.147.18.148 -t "exacount/+/totals" -v
```

#### 2. Delta del Contador (Opcional)
**Topic:** `exacount/{counter_id}/delta`

**Payload:**
```json
{"in": 1}
```
o
```json
{"out": 1}
```

**Frecuencia:** Solo si `publish_delta_only=true` en el contador

**Ejemplo de suscripción:**
```bash
mosquitto_sub -h 10.147.18.148 -t "exacount/+/delta" -v
```

### Integración con Home Assistant

```yaml
# configuration.yaml
mqtt:
  sensor:
    - name: "Escuela Entradas"
      state_topic: "exacount/escuela/totals"
      value_template: "{{ value_json.in }}"
      unit_of_measurement: "objetos"
      
    - name: "Escuela Salidas"
      state_topic: "exacount/escuela/totals"
      value_template: "{{ value_json.out }}"
      unit_of_measurement: "objetos"
      
    - name: "Escuela Ocupación"
      state_topic: "exacount/escuela/totals"
      value_template: "{{ value_json.occupancy }}"
      unit_of_measurement: "objetos"

automation:
  - alias: "Alerta Entrada Escuela"
    trigger:
      - platform: mqtt
        topic: "exacount/escuela/delta"
        payload: '{"in": 1}'
    action:
      - service: notify.mobile_app
        data:
          message: "Objeto ingresó a Escuela"
```

---

## 📦 Modelos de Datos

### Counter (Contador)
```typescript
interface Counter {
  id: string;                    // Identificador único
  type: "zones" | "two_cameras"; // Tipo de contador
  source_camera: string;         // Cámara asociada (alias)
  objects: string[];             // Objetos permitidos
  totals: {
    in: number;                  // Total de entradas
    out: number;                 // Total de salidas
    occupancy: number;           // Ocupación actual (in - out)
  };
  config: {
    zone_strategy: string;       // Estrategia de zona
    initial_occupancy: number;   // Ocupación inicial
    reset_schedule: string;      // Horario de reset (HH:MM)
  };
}
```

### Camera (Cámara)
```typescript
interface Camera {
  alias: string;                 // Nombre interno
  frigate_camera: string;        // Nombre en Frigate
  server: string;                // Servidor MQTT
  mode: "zones" | "role";        // Modo de operación
  zone_in: string;               // Nombre zona entrada
  zone_out: string;              // Nombre zona salida
  totals: {
    in: number;                  // Total entradas
    out: number;                 // Total salidas
    balance: number;             // Diferencia (in - out)
  };
}
```

### Event (Evento)
```typescript
interface Event {
  id: string;                    // ID único del evento
  camera: string;                // Nombre de la cámara
  label: string;                 // Tipo de objeto (auto, moto, personas)
  start_time: string;            // Timestamp inicio (ISO 8601)
  end_time: string;              // Timestamp fin (ISO 8601)
  zone: string;                  // Zona detectada (IN, OUT)
}
```

### HistoryEntry (Entrada de Histórico)
```typescript
interface HistoryEntry {
  timestamp: string;             // Timestamp del bucket
  in: number;                    // Entradas en ese período
  out: number;                   // Salidas en ese período
  occupancy_change: number;      // Cambio de ocupación (in - out)
}
```

---

## 🔄 Flujo de Datos

```
┌─────────────────┐
│  Frigate NVR    │
│  (Detección IA) │
└────────┬────────┘
         │ MQTT Events
         ▼
┌─────────────────┐
│  Conteo Backend │
│  (Este sistema) │
└────┬────────┬───┘
     │        │
     │        └─────► MQTT Publish
     │                (exacount/*)
     │
     ▼
┌─────────────────┐
│   SQLite DB     │
│   (Eventos)     │
└─────────────────┘
     │
     ▼
┌─────────────────┐
│   REST API      │
│   (Puerto 2222) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Frontend      │
│   (Dashboard)   │
└─────────────────┘
```

---

## 🎨 Ejemplos de Integración Frontend

### React + Fetch

```javascript
// Obtener contadores
const fetchCounters = async () => {
  const response = await fetch('http://localhost:2222/api/counters');
  const data = await response.json();
  return data.counters;
};

// Obtener histórico para gráfico
const fetchHistory = async (counterId, startDate) => {
  const url = `http://localhost:2222/api/counters/${counterId}/history?start_date=${startDate}&group_by=hour`;
  const response = await fetch(url);
  const data = await response.json();
  return data.history;
};

// Componente de ejemplo
function CounterCard({ counterId }) {
  const [counter, setCounter] = useState(null);

  useEffect(() => {
    fetch(`http://localhost:2222/api/counters/${counterId}`)
      .then(res => res.json())
      .then(data => setCounter(data));
  }, [counterId]);

  if (!counter) return <div>Loading...</div>;

  return (
    <div className="counter-card">
      <h3>{counter.id}</h3>
      <div className="stats">
        <div>⬇️ IN: {counter.totals.in}</div>
        <div>⬆️ OUT: {counter.totals.out}</div>
        <div>👤 Occupancy: {counter.totals.occupancy}</div>
      </div>
    </div>
  );
}
```

### Vue.js

```vue
<template>
  <div class="dashboard">
    <div v-for="counter in counters" :key="counter.id" class="counter-card">
      <h3>{{ counter.id }}</h3>
      <p>⬇️ IN: {{ counter.totals.in }}</p>
      <p>⬆️ OUT: {{ counter.totals.out }}</p>
      <p>👤 Occupancy: {{ counter.totals.occupancy }}</p>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      counters: []
    };
  },
  async mounted() {
    const response = await fetch('http://localhost:2222/api/counters');
    const data = await response.json();
    this.counters = data.counters;
  }
};
</script>
```

### Chart.js (Gráfico de Histórico)

```javascript
async function renderHistoryChart(counterId) {
  const response = await fetch(
    `http://localhost:2222/api/counters/${counterId}/history?start_date=2025-10-20&group_by=hour`
  );
  const data = await response.json();

  const ctx = document.getElementById('historyChart').getContext('2d');
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.history.map(h => h.timestamp),
      datasets: [
        {
          label: 'Entradas',
          data: data.history.map(h => h.in),
          borderColor: 'rgb(75, 192, 192)',
          tension: 0.1
        },
        {
          label: 'Salidas',
          data: data.history.map(h => h.out),
          borderColor: 'rgb(255, 99, 132)',
          tension: 0.1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `Histórico - ${counterId}`
        }
      }
    }
  });
}
```

---

## 🔒 Consideraciones de Seguridad

1. **CORS:** El backend NO tiene CORS habilitado por defecto. Si tu frontend está en otro dominio, necesitarás configurar CORS.

2. **Autenticación:** Actualmente NO hay autenticación. Para producción, considera agregar:
   - API Keys
   - JWT tokens
   - OAuth2

3. **Rate Limiting:** No hay límite de requests. Para producción, considera implementar rate limiting.

---

## 🐛 Debugging

### Ver logs en tiempo real
```bash
docker logs -f conteo_api
```

### Ver logs guardados
```bash
# Logs de aplicación
cat LOG/conteo.log

# Logs de estadísticas
cat LOG/stats.log
```

### Verificar estado del contenedor
```bash
docker ps
docker inspect conteo_api
```

### Probar conectividad MQTT
```bash
# Suscribirse a todos los eventos de conteo
mosquitto_sub -h 10.147.18.148 -t "exacount/#" -v

# Suscribirse a eventos de Frigate
mosquitto_sub -h 10.147.18.148 -t "frigate/events" -v
```

---

## 📞 Soporte

Para reportar problemas o solicitar nuevas funcionalidades, revisar:
- Logs del sistema: `LOG/conteo.log`
- Configuración: `conteo.conf`
- Base de datos: `DB/Conteo.db`

---

## 🎯 Roadmap Futuro

- [ ] Autenticación y autorización
- [ ] WebSocket para actualizaciones en tiempo real
- [ ] Exportación de reportes (PDF, Excel)
- [ ] Dashboard web integrado
- [ ] Soporte para múltiples idiomas
- [ ] Alertas configurables por email/SMS
- [ ] Integración con sistemas de BI (Grafana, PowerBI)

---

**Versión:** 1.0.0  
**Última actualización:** 2025-10-20
