### Endpoints CRUD para servidores Frigate

**Ruta base:** `/api/frigate/servers`

**GET**: Listar servidores
```http
GET /api/frigate/servers
```
Respuesta:
```json
{
	"servers": [
		{
			"id": 1,
			"name": "Servidor Principal",
			"url": "10.1.1.252",
			"port": 5000,
			"protocol": "http",
			"username": "admin",
			"password": "...",
			"auth_type": "basic",
			"enabled": true
		}
	]
}
```

**POST**: Agregar servidor
```http
POST /api/frigate/servers
Content-Type: application/json
{
	"name": "Servidor Nuevo",
	"url": "10.1.1.100",
	"port": 5000,
	"protocol": "http",
	"username": "user",
	"password": "pass",
	"auth_type": "basic",
	"enabled": true
}
```
Respuesta:
```json
{ "success": true, "id": 2 }
```

**PUT**: Editar servidor
```http
PUT /api/frigate/servers
Content-Type: application/json
{
	"id": 2,
	"name": "Servidor Editado",
	"url": "10.1.1.101",
	"port": 5001,
	"protocol": "https",
	"username": "user",
	"password": "newpass",
	"auth_type": "bearer",
	"enabled": false
}
```
Respuesta:
```json
{ "success": true }
```

**DELETE**: Eliminar servidor
```http
DELETE /api/frigate/servers
Content-Type: application/json
{
	"id": 2
}
```
Respuesta:
```json
{ "success": true }
```

**Notas:**
- Todos los endpoints usan snake_case y validan los datos obligatorios.
- La gestión es completamente dinámica y se refleja en la interfaz de ajustes general.
## Migración completa: Frigate y servicios backend gestionados solo por base de datos

**Estado actual:**
- Todos los endpoints y módulos que interactúan con Frigate (status, eventos, snapshots, clips) obtienen la configuración del servidor desde la base de datos usando las funciones snake_case de `frigate-servers.ts`.
- Se eliminó cualquier dependencia de variables de entorno (`.env`, `process.env`) para Frigate, MQTT, matrículas, conteo y notificaciones.
- Los endpoints `/api/frigate/events/[id]/snapshot.jpg` y `/api/frigate/events/[id]/clip.mp4` ahora usan el servidor principal configurado en la base de datos y aplican autenticación según los datos guardados (bearer/basic).
- La instancia hardcodeada de FrigateAPI fue eliminada; ahora se crea dinámicamente según el servidor activo.
- Toda la configuración de Frigate, MQTT y servicios backend es editable vía API y ajustes, y se persiste en la base de datos.

**Ventajas:**
- Permite modificar servidores, credenciales y parámetros sin reiniciar ni editar archivos de entorno.
- El frontend y backend trabajan siempre con la configuración real y actualizada.
- Facilita la administración multi-servidor y la integración dinámica.

**Referencia de implementación:**
- Ver funciones: `get_active_frigate_servers`, `get_frigate_server_by_id` en `src/lib/frigate-servers.ts`.
- Ver endpoints: `/api/frigate/status`, `/api/frigate/events/[id]/snapshot.jpg`, `/api/frigate/events/[id]/clip.mp4`.

**Notas:**
- Para agregar, editar o eliminar servidores Frigate, usar los endpoints y lógica de ajustes/configuración.
- Toda la lógica de autenticación y conexión se basa en los datos guardados en la base de datos.
### Actualización: Estado operacional y control de servicios

**Endpoints:**
- `/api/config/backend/status`: Devuelve el estado real y operacional de cada servicio (enabled, status, uptime, processed, etc.)
- `/api/config/backend/services/[service]/[action]`: Permite iniciar, detener y reiniciar servicios actualizando el campo enabled y simulando el status.

**Implementación:**
- El endpoint de estado ahora incluye los campos esperados por el frontend para cada servicio.
- El endpoint de control modifica el campo enabled en la base de datos y responde con el nuevo estado simulado.

**Ejemplo de respuesta de estado:**
```json
{
	"services": {
		"LPR (Matrículas)": {
			"enabled": true,
			"status": "running",
			"uptime": 3600,
			"processed": 0,
			"memory_mb": 0,
			"cpu_percent": 0,
			"config": "{...}"
		},
		"Conteo de Personas": {
			"enabled": false,
			"status": "stopped",
			"uptime": 0,
			"counted": 0,
			"memory_mb": 0,
			"cpu_percent": 0,
			"config": "{...}"
		},
		"Notificaciones": {
			"enabled": true,
			"status": "running",
			"uptime": 3600,
			"sent": 0,
			"memory_mb": 0,
			"cpu_percent": 0,
			"config": "{...}"
		}
	}
}
```

**Notas:**
- El frontend puede mostrar y controlar el estado de los servicios correctamente.
- Para control real, se debe implementar lógica adicional para manejar procesos y métricas reales.
## Implementación: Control real de servicios backend vía API

### Endpoint: `/api/config/backend/status`

**Descripción:**
Este endpoint consulta el estado real de los servicios del backend (LPR, counting, notifications) usando la base de datos SQLite. Devuelve si cada servicio está habilitado (`enabled`) y su configuración actual (`config`).

**Cómo se implementa:**
- Se importa la clase `ConfigDatabase` desde `src/lib/config-database.ts`.
- Se instancia la base de datos y se llama a `getAllBackendConfigs()` para obtener la lista de servicios y sus estados.
- El resultado se mapea y se retorna en formato JSON, mostrando el estado real y la configuración de cada servicio.

**Ejemplo de respuesta:**
```json
{
	"services": {
		"LPR (Matrículas)": {
			"enabled": true,
			"config": "{...}"
		},
		"Conteo de Personas": {
			"enabled": false,
			"config": "{...}"
		},
		"Notificaciones": {
			"enabled": true,
			"config": "{...}"
		}
	}
}
```

**Notas:**
- El endpoint ya no usa datos simulados, sino el estado real guardado en la base de datos.
- Para modificar el estado, actualizar el campo `enabled` en la tabla `backend_config`.

**Referencia de código:**
```typescript
const ConfigDatabase = (await import('@/lib/config-database')).default;
const db = new ConfigDatabase();
const configs = db.getAllBackendConfigs();
const services: Record<string, { enabled: boolean; config: string }> = {};
configs.forEach((cfg: any) => {
	services[cfg.service_name] = {
		enabled: !!cfg.enabled,
		config: cfg.config
	};
});
return NextResponse.json({ services });
```
Cada funcion nueva debe incluir un bloque de comentarios JSDoc encima.
Todas las variables y funciones deben escribirse en snake_case.
No uses camelCase.
en la carpeta context tenes documentacion de como trabajar con API de frigate y ejemplos.
quiero que cada implementacion nueva via API vayamos documentando como se hace.

## Implementación: Estado operacional real de servicios backend vía API

**Endpoint:** `/api/config/backend/connectivity`

**Descripción:**
Este endpoint consulta el estado real de los servicios del backend (LPR, counting, notifications) usando la base de datos SQLite para configuración y comandos Docker para métricas operacionales. Devuelve si cada servicio está habilitado (`enabled`) y su configuración actual (`config`), además de métricas reales de Docker.

**Cómo se implementa:**
- Se importa la clase `ConfigDatabase` desde `src/lib/config-database.ts`.
- Se instancia la base de datos y se llama a `getAllBackendConfigs()` para obtener la lista de servicios y sus estados.
- Para cada servicio, se obtienen métricas reales usando funciones específicas:
  - `get_counting_service_status()`: Para el contenedor `counting-backend`
  - `get_lpr_service_status()`: Para el contenedor `exalink-lpr-backend`
- Las funciones usan comandos Docker (`docker ps`, `docker stats`, `docker inspect`) para obtener métricas reales.
- Se integran estadísticas de base de datos usando `getLPRDatabase().getStats()` y `get_counting_database().get_stats()`.

**Problema resuelto:**
La página LPR se quedaba indefinidamente en estado "Conectando al sistema LPR..." porque el frontend intentaba hacer un fetch directo al backend LPR (`http://localhost:2221/health`) desde el navegador, lo cual estaba bloqueado por políticas de CORS/seguridad del navegador.

**Solución implementada:**
- Se eliminó el health check directo del backend LPR desde el navegador
- El frontend ahora confía únicamente en el endpoint `/api/config/backend/connectivity` que ya verifica toda la conectividad del sistema
- Si `system_ready` es `true`, el sistema se marca como disponible inmediatamente sin verificaciones adicionales

**Referencia de código:**
```typescript
// Verificación simplificada - solo usa el endpoint de conectividad
if (connectivity_data.data.system_ready) {
  console.log('System ready, marking as available');
  set_system_status('available');
  console.log('System status set to available');
} else {
  console.log('System not ready, status:', connectivity_data.data);
  set_system_status('unavailable');
}
```

## Implementación: Estado de servidores Frigate vía API

### Endpoint: `/api/frigate/status`

**Descripción:**
Este endpoint consulta el estado de todos los servidores Frigate activos, leyendo la configuración dinámica desde la base de datos/configuración y no desde el archivo `.env`. Devuelve el estado de conectividad y versión de cada servidor configurado.

**Cómo se implementa:**
- Se importa la función `getActiveFrigateServers()` desde `src/lib/frigate-servers.ts`.
- Para cada servidor activo, se prueba la conectividad y se consulta la versión de la API.
- El resultado es un array con el estado de cada servidor (id, nombre, url, conectividad, versión, error).

**Ejemplo de respuesta:**
```json
{
  "servers": [
    {
      "id": "srv1",
      "name": "Servidor Principal",
      "url": "http://10.1.1.252:5000",
      "connectivity": true,
      "version": "0.12.0",
      "error": null
    },
    {
      "id": "srv2",
      "name": "Servidor Secundario",
      "url": "http://10.22.26.3:5000",
      "connectivity": false,
      "version": null,
      "error": "Conectividad fallida: connect EHOSTUNREACH ..."
    }
  ]
}
```

**Notas:**
- El endpoint ya no depende de la IP/puerto definidos en `.env`.
- La lista de servidores Frigate es modificable desde la configuración y puede crecer dinámicamente.
- Próximos pasos: migrar toda la configuración Frigate a la base de datos y permitir edición vía ajustes en el frontend.

## Implementación: Sincronización automática de código fuente para Docker

**Problema identificado:**
El despliegue Docker utilizaba una versión desactualizada del sistema (0.0.16) porque el directorio `frontend-build/` no se sincronizaba automáticamente con los cambios del código fuente en `src/`.

**Solución implementada:**
- **Scripts de sincronización:** `sync-frontend.sh` (Linux/Mac) y `sync-frontend.bat` (Windows)
- **Integración automática:** Los scripts de despliegue (`deploy.sh`, `deploy.bat`, `docker-deploy.sh`) ahora ejecutan la sincronización antes del build Docker
- **Archivos sincronizados:** Todo el contenido de `src/`, archivos de configuración (`package.json`, `tsconfig.json`, etc.) y directorios adicionales (`messages/`, `public/`)

**Cómo funciona:**
```bash
# Sincronización manual
./sync-frontend.sh    # Linux/Mac
./sync-frontend.bat   # Windows

# Sincronización automática en despliegue
./deploy.sh           # Incluye sincronización automática
```

**Archivos modificados:**
- `deploy.sh`: Agregado paso de sincronización [1/5]
- `deploy.bat`: Agregado paso de sincronización [1/5]  
- `docker-deploy.sh`: Sincronización en función `build_images()`
- Nuevos scripts: `sync-frontend.sh` y `sync-frontend.bat`

**Resultado:**
El despliegue Docker ahora incluye automáticamente todos los últimos cambios del código fuente, asegurando que la versión desplegada (0.0.26) coincida con la versión de desarrollo.

## Sistema de Timezone para Frigate

**Implementación:** 13 de octubre de 2025

### Problema
Frigate siempre trabaja con timestamps en **UTC**, pero los usuarios trabajan en su timezone local (ej: UTC-3 en Argentina). Sin conversión, las fechas aparecen con 3 horas de diferencia, causando que:
- Las grabaciones se busquen en el horario incorrecto
- Las fechas aparezcan como "futuras" cuando no lo son
- Los exports fallen por timestamps incorrectos

### Solución Implementada

#### 1. **Configuración de Timezone en Base de Datos**

Se agregó el campo `timezone_offset` en la tabla `app_settings`:
- Almacena el offset en horas (ejemplo: -3 para UTC-3, +1 para UTC+1)
- Valor por defecto: `-3` (Argentina/Buenos Aires)
- Rango permitido: -12 a +14

**Métodos en `config-database.ts`:**
```typescript
get_timezone_offset(): number  // Obtiene el offset configurado
set_timezone_offset(offset: number): void  // Establece el offset
```

#### 2. **Conversión Automática en FrigateAPI**

La clase `FrigateAPI` ahora incluye métodos de conversión:

```typescript
private local_to_utc(local_timestamp: number): number {
  return local_timestamp - (this.timezone_offset * 3600);
}

private utc_to_local(utc_timestamp: number): number {
  return utc_timestamp + (this.timezone_offset * 3600);
}
```

**Flujo de conversión:**
1. El usuario selecciona una fecha/hora en su timezone local
2. El frontend envía el timestamp en timezone local
3. `check_recordings_available()` convierte a UTC antes de consultar Frigate
4. `startRecordingExport()` convierte a UTC antes de crear el export
5. Frigate procesa todo en UTC
6. Los resultados se pueden convertir de vuelta a local para mostrar al usuario

#### 3. **Endpoint de Configuración**

**GET** `/api/config/timezone`
```http
GET /api/config/timezone
```
Respuesta:
```json
{
  "success": true,
  "timezone_offset": -3,
  "timezone_string": "UTC-3"
}
```

**PUT** `/api/config/timezone`
```http
PUT /api/config/timezone
Content-Type: application/json
{
  "timezone_offset": -3
}
```
Respuesta:
```json
{
  "success": true,
  "message": "Timezone actualizado correctamente",
  "timezone_offset": -3,
  "timezone_string": "UTC-3"
}
```

#### 4. **Logs Mejorados**

Los logs ahora muestran ambos timestamps (local y UTC):

```
🔍 Verificando grabaciones: {
  camera: 'Portones',
  timezone_offset: 'UTC-3',
  local: {
    start_time: 1697209800,
    end_time: 1697211600,
    start_date: '2025-10-13T20:30:00.000Z',
    end_date: '2025-10-13T21:00:00.000Z'
  },
  utc: {
    start_time: 1697220600,  // +3 horas (10800 segundos)
    end_time: 1697222400,
    start_date: '2025-10-13T23:30:00.000Z',
    end_date: '2025-10-14T00:00:00.000Z'
  },
  current_date: '2025-10-13T23:45:00.000Z',
  is_future: false
}

📡 Consultando Frigate (UTC): http://10.1.1.252:5000/api/Portones/recordings/summary?after=1697220600&before=1697222400

🎬 Starting export: {
  camera: 'Portones',
  timezone_offset: 'UTC-3',
  local: {
    startTime: 1697209800,
    endTime: 1697211600,
    start_date: '2025-10-13T20:30:00.000Z',
    end_date: '2025-10-13T21:00:00.000Z'
  },
  utc: {
    startTime: 1697220600,
    endTime: 1697222400,
    start_date: '2025-10-13T23:30:00.000Z',
    end_date: '2025-10-14T00:00:00.000Z'
  },
  duration: 1800
}
```

### Uso en el Frontend

**Obtener timezone actual:**
```typescript
const response = await fetch('/api/config/timezone');
const data = await response.json();
console.log(`Timezone: ${data.timezone_string}`); // "UTC-3"
```

**Cambiar timezone:**
```typescript
const response = await fetch('/api/config/timezone', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ timezone_offset: -3 })
});
```

### Timezones Comunes

| Región | Offset | String |
|--------|--------|--------|
| Argentina (Buenos Aires) | -3 | UTC-3 |
| Brasil (São Paulo) | -3 | UTC-3 |
| Chile (Santiago) | -3/-4 | UTC-3/4 (varía) |
| México (Ciudad de México) | -6 | UTC-6 |
| España (Madrid) | +1/+2 | UTC+1/2 (varía) |
| UTC | 0 | UTC |

### Notas Importantes

1. **Todos los timestamps internos se manejan en segundos** (no milisegundos)
2. **El frontend debe enviar timestamps en timezone local**, tal como los necesita Frigate
3. **Frigate trabaja en la misma timezone del servidor** (ej: UTC-3), NO en UTC
4. **NO se hace conversión de timezone** - los timestamps se envían directamente a Frigate
5. **La configuración de timezone es solo informativa** para el usuario, no afecta las peticiones a Frigate
6. **Reiniciar el servidor** después de cambiar código relacionado con timezone

### Flujo de Conversión de Timestamps

**Desde el Frontend:**
```typescript
/**
 * Función helper para convertir Date a timestamp Unix LOCAL.
 * Esta función NO aplica conversión UTC, retorna el timestamp como si fuera local.
 * El backend se encargará de convertir a UTC según la configuración de timezone.
 */
function date_to_local_timestamp(date: Date): number {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  
  // Crear timestamp interpretando estos valores como si fueran UTC
  // Esto "cancela" la conversión automática que hace Date.UTC o getTime()
  const utc_date = new Date(Date.UTC(year, month, day, hours, minutes, seconds));
  return Math.floor(utc_date.getTime() / 1000);
}

// El usuario selecciona: 13/10/2025 20:30 (hora local UTC-3)
const date = new Date();
date.setHours(20, 30, 0, 0);

// ❌ INCORRECTO: getTime() convierte automáticamente a UTC
const wrong_timestamp = Math.floor(date.getTime() / 1000);
// Result: 1697220600 (23:30 UTC) - 3 horas adelante!

// ✅ CORRECTO: usar date_to_local_timestamp
const local_timestamp = date_to_local_timestamp(date);
// Result: 1697209800 (20:30 local) - timestamp correcto!

// Se envía al backend sin conversión
fetch('/api/frigate/exports', {
  body: JSON.stringify({
    start_time: local_timestamp,  // ← Timestamp LOCAL
    ...
  })
});
```

**En el Backend (SIN conversión):**
```typescript
// FrigateAPI envía timestamps directamente (Frigate trabaja en timezone local)
class FrigateAPI {
  startRecordingExport(camera, startTime, endTime) {
    // startTime = 1697209800 (20:30 local)
    // Se envía directamente sin conversión
    
    // Frigate recibe: ...start/1697209800/end/...  ✅
  }
}
```

**IMPORTANTE:** 
- Frigate trabaja en la **misma timezone del servidor** (ej: UTC-3), NO en UTC
- Los timestamps se envían **sin conversión** directamente a Frigate
- La configuración de timezone (`timezone_offset`) es **solo informativa** para el usuario
- **NUNCA usar `Date.getTime()` o `new Date().getTime()` directamente** para timestamps, ya que JavaScript automáticamente convierte a UTC.
- **SIEMPRE usar `date_to_local_timestamp(date)`** para obtener timestamps locales correctos.

### Problema Común: "Fecha futura" o "No recordings found"

**Síntoma:** El sistema reporta que las grabaciones están en el futuro o que no se encuentran grabaciones para un período que sí tiene datos.

**Causa raíz (SOLUCIONADO en v0.0.30):** 
Había **dos problemas** que causaban errores:

1. **Frontend (v0.0.29):** El frontend usaba `Date.getTime()` que convierte automáticamente a UTC. 
   - Usuario selecciona: 19:45 hora local (UTC-3)
   - JavaScript convierte: 22:45 UTC
   - Se enviaba: 22:45 al backend

2. **Backend (v0.0.30):** El backend asumía incorrectamente que Frigate trabaja en UTC y sumaba el offset.
   - Recibía: 22:45 (ya en UTC por el problema del frontend)
   - Sumaba offset: 22:45 + 3 horas = 01:45 UTC (día siguiente, futuro!)
   - Frigate: "No recordings found" (porque Frigate trabaja en UTC-3, no en UTC)

**Realidad descubierta:** Frigate **NO trabaja en UTC**, trabaja en la **misma timezone del servidor** (ej: UTC-3). La prueba fue que el HLS player funcionaba perfectamente sin hacer conversión de timezone.

**Solución implementada (v0.0.29 + v0.0.30):**
1. **Frontend (v0.0.29):** Función helper `date_to_local_timestamp()` para cancelar conversión automática de JavaScript
2. **Backend (v0.0.30):** Eliminada conversión local→UTC, los timestamps se envían directamente a Frigate
3. **Documentación:** Actualizada para reflejar que Frigate trabaja en timezone local, no UTC

**Validación:** Los logs deben mostrar timestamps coherentes:
```
🔍 Verificando grabaciones: {
  start_time: 1760374800,  // 14:00 local (UTC-3)
  start_date: '2025-10-13T14:00:00.000Z',
  current_date: '2025-10-13T19:15:42.134Z',
  is_future: false  ✅
}

📡 Consultando Frigate (local timezone): ...?after=1760374800&before=1760378400

🎬 Starting export: {
  startTime: 1760374800,  // 14:00 local - enviado directamente
  start_date: '2025-10-13T14:00:00.000Z'
}

Attempting export start -> .../start/1760374800/end/1760378400  ✅
```

### Archivos Modificados

- `src/lib/config-database.ts`: Métodos `get_timezone_offset()` y `set_timezone_offset()`
- `src/lib/frigate-api.ts`: Métodos `local_to_utc()` y `utc_to_local()`, conversión en `check_recordings_available()` y `startRecordingExport()`
- `src/app/api/config/timezone/route.ts`: Endpoint GET/PUT para gestión de timezone
- `src/app/[locale]/(app)/recordings/components/recording-browser.tsx`: Función `date_to_local_timestamp()` y conversiones corregidas
- `AGENTS.md`: Documentación completa del sistema

## Implementación: Sistema de gestión de exports de grabaciones Frigate

**Fecha de implementación:** 13 de octubre de 2025  
**Última actualización:** 13 de octubre de 2025  
**Versión asociada:** v0.0.31

### Descripción general
Sistema completo para crear, listar, descargar, compartir y eliminar exports de grabaciones almacenadas en servidores Frigate. **Todas las descargas ahora se guardan obligatoriamente en Frigate como exports**, eliminando las descargas directas temporales. El sistema verifica la disponibilidad de grabaciones antes de crear el export y hace polling del estado hasta que esté listo.

### Mejoras recientes (13 de octubre de 2025)

#### 1. Verificación de grabaciones disponibles antes de crear export

**Método agregado:** `check_recordings_available()` en `frigate-api.ts`

```typescript
async check_recordings_available(
  camera: string, 
  start_time: number, 
  end_time: number
): Promise<{ 
  available: boolean; 
  duration?: number; 
  message?: string 
}>
```

- Consulta el endpoint `/api/{camera}/recordings/summary` de Frigate
- Verifica que existan grabaciones en el rango de tiempo especificado
- Retorna la duración total de grabaciones disponibles
- Si falla la verificación, permite continuar para no bloquear el flujo

**Endpoint actualizado:** `POST /api/frigate/exports`

Ahora realiza validación previa antes de crear el export:
```http
POST /api/frigate/exports
Content-Type: application/json
{
  "server_id": "srv1",
  "camera": "Portones",
  "start_time": 1697209800,
  "end_time": 1697211600,
  "name": "Export_Importante",
  "wait_for_completion": false
}
```

Respuestas:
- **404**: No hay grabaciones disponibles
  ```json
  {
    "success": false,
    "message": "No se encontraron grabaciones para el rango de tiempo especificado",
    "details": {
      "camera": "Portones",
      "start_time": 1697209800,
      "end_time": 1697211600,
      "duration_requested": 1800
    }
  }
  ```

- **200**: Export creado exitosamente
  ```json
  {
    "success": true,
    "export_id": "abc123",
    "server_id": "srv1",
    "server_name": "Servidor Principal",
    "status": { "status": "processing", "progress": 0 },
    "download_url": "http://10.1.1.252:5000/api/export/abc123/download",
    "recordings_info": {
      "available": true,
      "duration": 1800
    }
  }
  ```

#### 2. Polling automático de estado de exports

**Método agregado:** `wait_for_export_ready()` en `frigate-api.ts`

```typescript
async wait_for_export_ready(
  export_id: string,
  options?: {
    max_wait_ms?: number;           // Default: 300000 (5 min)
    poll_interval_ms?: number;      // Default: 2000 (2 seg)
    on_progress?: (progress: number, status: string) => void;
  }
): Promise<{ 
  ready: boolean; 
  status: string; 
  download_path?: string; 
  error?: string 
}>
```

**Características:**
- Hace polling del endpoint `/api/export/{export_id}` cada 2 segundos
- Notifica progreso mediante callback opcional
- Detecta estados: `complete`, `processing`, `pending`, `running`, `failed`, `error`
- Timeout configurable (default 5 minutos)
- Retorna cuando el export está listo o falla

**Estados detectados:**
- `complete`/`completed`: Export listo para descargar
- `processing`/`pending`/`running`: Export en proceso
- `failed`/`error`: Export falló
- `timeout`: No se completó en el tiempo máximo

#### 3. Flujo de descarga unificado - Siempre guardar en Frigate

**Cambio importante:** Se eliminó la opción de descarga directa. Ahora **todas las descargas se guardan como exports en Frigate**.

**Componente modificado:** `recording-browser.tsx`

**Función `handleSaveAsExport()` mejorada:**
```typescript
const handleSaveAsExport = async (start: number, end: number) => {
  // 1. Validar duración máxima (30 minutos)
  // 2. Solicitar nombre al usuario
  // 3. Crear export en Frigate (wait_for_completion=false)
  // 4. Hacer polling del estado cada 2 segundos
  // 5. Mostrar progreso en tiempo real
  // 6. Notificar cuando esté listo
  // 7. Abrir automáticamente el sidebar de exports
}
```

**Función `handleDownloadRequest()` simplificada:**
```typescript
const handleDownloadRequest = async (start: number, end: number) => {
  // Siempre guardar en Frigate - ya no hay opción de descarga directa
  await handleSaveAsExport(start, end);
};
```

**Flujo de usuario actualizado:**
1. Usuario selecciona rango de tiempo en grabaciones
2. Click en "Descargar"
3. Sistema solicita nombre para el export
4. Se verifica que existan grabaciones
5. Se crea el export en Frigate
6. Barra de progreso muestra el estado en tiempo real:
   - "Verificando grabaciones disponibles..." (0%)
   - "Export creado, procesando video..." (10%)
   - "Procesando export (processing)..." (10-90%)
   - "Export completado" (100%)
7. Alert confirma que el export está listo
8. Se abre automáticamente el sidebar de "Exports Guardados"
9. Usuario puede descargar/compartir desde allí

**Ventajas del nuevo flujo:**
- ✅ Todos los clips quedan guardados en Frigate para acceso posterior
- ✅ No se pierde el trabajo si se cierra el navegador durante el proceso
- ✅ Verificación previa evita errores de "no hay grabaciones"
- ✅ Feedback visual del progreso en tiempo real
- ✅ Gestión centralizada de todos los exports guardados
- ✅ Posibilidad de compartir con links públicos temporales

#### 4. Manejo de errores mejorado

**Errores específicos detectados:**

1. **Fecha futura detectada:**
   ```
   ⚠️ La fecha seleccionada está en el futuro.
   
   Fecha seleccionada: 14/10/2025 4:29:00
   Fecha actual: 13/10/2025 23:45:00
   
   ❌ No se pueden exportar grabaciones que aún no existen.
   ```

2. **No hay grabaciones disponibles (404):**
   ```
   ⚠️ No hay grabaciones con contenido para el período seleccionado.
   
   Cámara: Portones
   Período: 13/10/2025 20:00:00 - 13/10/2025 20:30:00
   
   💡 Verifica que la cámara estaba grabando en ese momento.
   ```

3. **Duración excesiva (validación previa):**
   ```
   El período de exportación no puede ser mayor a 30 minutos.
   
   Período solicitado: 45 minutos.
   
   Frigate tiene limitaciones en la exportación de períodos largos. 
   Selecciona un período más corto.
   ```

4. **Timeout en procesamiento:**
   ```
   ❌ Error al guardar export:
   
   El export no se completó en el tiempo esperado. 
   Verifica la lista de Exports Guardados.
   ```

5. **Fallo durante procesamiento:**
   ```
   ❌ Error al guardar export:
   
   El export falló durante el procesamiento: failed
   ```

### Logs de debugging mejorados

El sistema ahora incluye logs detallados con emojis para facilitar el debugging:

```
🔍 Verificando grabaciones: {
  camera: 'Portones',
  start_time: 1697209800,
  end_time: 1697211600,
  start_date: '2025-10-13T20:30:00.000Z',
  end_date: '2025-10-13T21:00:00.000Z',
  current_date: '2025-10-13T23:45:00.000Z',
  is_future: false,
  duration_requested: 1800
}

📡 Consultando Frigate: http://10.1.1.252:5000/api/Portones/recordings/summary?after=1697209800&before=1697211600

📊 Datos de grabaciones recibidos: [...]

✅ Grabaciones encontradas. Duración total: 1800 segundos

🎬 Starting export: {
  camera: 'Portones',
  startTime: 1697209800,
  endTime: 1697211600,
  start_date: '2025-10-13T20:30:00.000Z',
  end_date: '2025-10-13T21:00:00.000Z',
  duration: 1800,
  name: 'Portones_2025-10-13_20-30'
}
```

### Componentes del sistema

#### 1. API de Frigate extendida (`src/lib/frigate-api.ts`)

**Método `list_exports()`:**
Lista todos los exports guardados en un servidor Frigate.

```typescript
async list_exports(): Promise<Array<{
  export_id: string;
  name?: string;
  status?: string;
  created_at?: string;
  download_path?: string;
  camera?: string;
  start_time?: number;
  end_time?: number;
}>>
```

- Intenta múltiples endpoints de Frigate (`/api/exports`, `/api/export/list`, `/api/export`)
- Normaliza la respuesta de diferentes versiones de Frigate
- Retorna array vacío si no encuentra exports

**Método `delete_export(export_id)`:**
Elimina un export del servidor Frigate.

```typescript
async delete_export(export_id: string): Promise<boolean>
```

- Llama al endpoint `DELETE /api/export/{export_id}` de Frigate
- Retorna `true` si se eliminó correctamente, `false` en caso contrario

#### 2. Endpoints backend para gestión de exports

**Endpoint: `/api/frigate/exports`**

**GET** - Listar todos los exports
```http
GET /api/frigate/exports
```
Respuesta:
```json
{
  "servers": [
    {
      "id": "srv1",
      "name": "Servidor Principal",
      "baseUrl": "http://10.1.1.252:5000",
      "exports": [
        {
          "export_id": "abc123",
          "name": "Portones_2025-10-13_14-30",
          "status": "complete",
          "created_at": "2025-10-13T14:30:00Z",
          "camera": "Portones",
          "start_time": 1697209800,
          "end_time": 1697211600
        }
      ]
    }
  ]
}
```

**POST** - Crear nuevo export
```http
POST /api/frigate/exports
Content-Type: application/json
{
  "server_id": "srv1",
  "camera": "Portones",
  "start_time": 1697209800,
  "end_time": 1697211600,
  "name": "Export_Importante"
}
```
Respuesta:
```json
{
  "success": true,
  "export_id": "abc123",
  "server_id": "srv1",
  "server_name": "Servidor Principal",
  "status": { "status": "processing", "progress": 0 },
  "download_url": "http://10.1.1.252:5000/api/export/abc123/download"
}
```

**DELETE** - Eliminar export
```http
DELETE /api/frigate/exports
Content-Type: application/json
{
  "server_id": "srv1",
  "export_id": "abc123"
}
```
Respuesta:
```json
{
  "success": true,
  "message": "Export eliminado correctamente",
  "export_id": "abc123",
  "revoked_tokens": 2
}
```

#### 3. Sistema de tokens para compartir exports (`src/lib/export-tokens.ts`)

**Funciones principales:**

- `create_share_token(server_id, export_id, duration_ms, max_downloads?)`: Genera un token temporal
- `validate_share_token(token)`: Valida y retorna datos del token
- `increment_token_download_count(token)`: Incrementa contador de descargas
- `revoke_share_token(token)`: Revoca un token específico
- `revoke_tokens_for_export(server_id, export_id)`: Revoca todos los tokens de un export
- `cleanup_expired_tokens()`: Limpia tokens expirados (se ejecuta automáticamente cada hora)

**Características:**
- Tokens almacenados en memoria (se pierden al reiniciar)
- Expiración configurable (por defecto 24 horas)
- Límite opcional de descargas por token
- Revocación automática al eliminar el export

**Endpoint: `/api/frigate/exports/share`**

**POST** - Generar token de compartir
```http
POST /api/frigate/exports/share
Content-Type: application/json
{
  "server_id": "srv1",
  "export_id": "abc123",
  "duration_hours": 48,
  "max_downloads": 5
}
```
Respuesta:
```json
{
  "success": true,
  "token": "3a4f2b8c...",
  "share_url": "http://localhost:9002/api/frigate/exports/download/3a4f2b8c...",
  "expires_in_hours": 48,
  "max_downloads": 5,
  "server_id": "srv1",
  "export_id": "abc123"
}
```

**Endpoint: `/api/frigate/exports/download/[token]`**

**GET** - Descargar export con token público
```http
GET /api/frigate/exports/download/3a4f2b8c...
```
- No requiere autenticación
- Incrementa contador de descargas
- Invalida token si alcanza límite de descargas o expira
- Retorna el archivo MP4 directamente

**DELETE** - Revocar token
```http
DELETE /api/frigate/exports/download/3a4f2b8c...
```

#### 4. Componente de interfaz: ExportsSidebar

**Ubicación:** `src/components/ui/exports-sidebar.tsx`

**Características:**
- Barra lateral deslizante desde la derecha
- Lista todos los exports de todos los servidores activos
- Agrupados por servidor
- Botón de refrescar lista
- Contador de exports totales

**Acciones por export:**
- **Descargar**: Descarga directa desde Frigate
- **Compartir**: Genera token temporal y link público
- **Eliminar**: Elimina export y revoca tokens asociados

**Props:**
```typescript
interface ExportsSidebarProps {
  is_open: boolean;
  on_close: () => void;
  on_export_created?: () => void;
}
```

**Diálogo de compartir:**
- Configurar duración del link (1-168 horas)
- Copiar link al portapapeles
- Abrir link en nueva pestaña

#### 5. Integración en página de grabaciones

**Archivo:** `src/app/[locale]/(app)/recordings/components/recording-browser.tsx`

**Botón de acceso:**
```tsx
<Button onClick={() => setShowExportsSidebar(true)}>
  <Archive className="h-4 w-4 mr-2" />
  Exports Guardados
</Button>
```

**Flujo de descarga mejorado:**

Cuando el usuario selecciona un rango para descargar, se le presenta un diálogo:
- **OK**: Descarga directa inmediata
- **Cancelar**: Guardar como export en Frigate

**Función `handleSaveAsExport(start, end)`:**
1. Solicita nombre para el export
2. Crea export mediante `POST /api/frigate/exports`
3. Muestra mensaje de éxito con ID del export
4. Abre automáticamente la barra lateral de exports

### Casos de uso

**Caso 1: Guardar clip importante**
1. Usuario navega por grabaciones y encuentra un evento
2. Selecciona rango de tiempo
3. Elige "Guardar en Frigate"
4. Asigna nombre descriptivo
5. Export se guarda y aparece en la lista

**Caso 2: Compartir evidencia**
1. Usuario abre "Exports Guardados"
2. Selecciona export relevante
3. Click en botón "Compartir"
4. Configura duración del link (ej. 48 horas)
5. Copia link y envía por email/chat
6. Destinatario descarga sin necesidad de login

**Caso 3: Gestión de espacio**
1. Usuario revisa exports antiguos
2. Identifica exports ya no necesarios
3. Elimina exports con un click
4. Libera espacio en servidor Frigate

### Ventajas del sistema

1. **Persistencia**: Los exports permanecen en Frigate hasta que se eliminan manualmente
2. **Compartir seguro**: Links temporales con expiración automática
3. **Multi-servidor**: Gestión unificada de exports de múltiples servidores Frigate
4. **Control de acceso**: Tokens con límite de descargas y tiempo de vida
5. **Revocación automática**: Tokens se invalidan al eliminar el export
6. **Interfaz intuitiva**: Barra lateral con vista clara de todos los exports

### Notas técnicas

- Los tokens se almacenan en memoria del servidor Next.js (se pierden al reiniciar)
- Para persistencia de tokens, considerar implementar almacenamiento en base de datos
- Los exports se almacenan físicamente en el servidor Frigate
- Cada servidor mantiene sus propios exports independientemente
- La limpieza automática de tokens expirados previene fugas de memoria

### Referencias de código

- API Frigate: `src/lib/frigate-api.ts` (líneas 540-650)
- Endpoints: `src/app/api/frigate/exports/route.ts`
- Tokens: `src/lib/export-tokens.ts`
- Sidebar: `src/components/ui/exports-sidebar.tsx`
- Integración: `src/app/[locale]/(app)/recordings/components/recording-browser.tsx` (líneas 273-315)

**Resultado:**
El despliegue Docker ahora incluye automáticamente todos los últimos cambios del código fuente, asegurando que la versión desplegada (0.0.26) coincida con la versión de desarrollo.