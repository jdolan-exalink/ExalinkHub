## Actualización 19/10/2025: Corrección de extracción de datos desde payload_json

### 1. Extracción correcta de campos desde payload_json

**Archivo modificado:** `src/app/api/lpr/readings/route.ts`

- **Velocidad:** Ahora se extrae de `payload_json.current_estimated_speed` y se redondea (`Math.round()`)
- **Matrícula:** Se extrae de `payload_json.recognized_license_plate` y se normaliza:
  - Elimina todos los caracteres que no sean letras ni números
  - Elimina espacios intermedios
  - Convierte a mayúsculas
  - Ejemplo: "AB C-123" → "ABC123"

- **Imágenes:** Ahora usa los campos directos del evento:
  - **Crop:** `event.plate_crop_path` → `http://localhost:2221/media/{plate_crop_path}`
  - **Clip:** `event.clip_path` → `http://localhost:2221/media/{clip_path}`
  - **Snapshot:** `event.snapshot_path` → `http://localhost:2221/media/{snapshot_path}`

### 2. Función de normalización de matrículas

```typescript
/**
 * Normaliza una matrícula eliminando todo excepto letras y números.
 * Elimina espacios, guiones y caracteres especiales.
 */
const normalize_plate = (plate: string): string => {
  if (!plate) return '';
  return plate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
};
```

### 3. Búsqueda de matrículas mejorada

El filtro de búsqueda también normaliza las matrículas antes de comparar, permitiendo búsquedas flexibles:
- Buscar "ABC123" encontrará "ABC 123", "AB-C123", "A B C 1 2 3", etc.

### 4. Mapeo completo desde payload_json

```typescript
// Matrícula normalizada
plate: normalize_plate(payload.recognized_license_plate)

// Velocidad redondeada
speed: Math.round(payload.current_estimated_speed)

// Zona
zone: payload.current_zones[0]

// Tipo de vehículo
vehicle_type: payload.label

// Rutas de archivos multimedia
local_files: {
  snapshot_url: `http://localhost:2221/media/${event.snapshot_path}`,
  clip_url: `http://localhost:2221/media/${event.clip_path}`,
  crop_url: `http://localhost:2221/media/${event.plate_crop_path}`
}
```

### 5. Despliegue aplicado

```bash
# Compilación Next.js
npm run build  # ✅ Compiled in 6.2s

# Sincronización a Docker
.\sync-frontend.bat  # ✅ Completada

# Reconstrucción imagen
docker compose build frontend  # ✅ Built in 52.8s

# Levantamiento del servicio
docker compose up -d frontend  # ✅ Container started
```

### 6. Mejoras de interfaz - Modales y visualización de multimedia

**Archivo modificado:** `src/app/[locale]/(app)/lpr/page.tsx`

- **Modales mejorados:** Los snapshots y clips ahora se muestran en popups elegantes con overlay oscuro
  - Fondo semitransparente con efecto blur (`backdrop-blur-sm`)
  - Contenedor negro para mejor contraste de imágenes/videos
  - Botón de cerrar con efecto hover rojo
  - Emojis descriptivos (📷 para snapshots, 🎬 para clips)
  
- **Crop interactivo:** 
  - Borde destacado que cambia al hover
  - Efecto de sombra al pasar el mouse
  - Click abre el snapshot completo en modal

- **Botones de acción mejorados:**
  - Hover cambia a color primary
  - Mejor feedback visual
  - Emojis descriptivos para mejor UX

**Nuevo endpoint creado:** `src/app/api/lpr/files/media/[...path]/route.ts`

- Proxy transparente al backend LPR para archivos multimedia
- Maneja snapshots, clips y crops automáticamente
- Detecta content-type por extensión (jpg, png, mp4, webm)
- Soporte para videos con range requests
- Cache de 1 hora para optimizar rendimiento
- Timeout de 30 segundos
- Autenticación automática al backend

**Función de conversión de URLs:**
```typescript
/**
 * Convierte path interno del backend LPR a URL de API accesible.
 * http://localhost:2221/media/... → /api/lpr/files/media/...
 */
const to_internal_url = (url: string | null) => {
  if (!url) return null;
  if (url.includes('http://localhost:2221/media/')) {
    const path = url.replace('http://localhost:2221/media/', '');
    return `/api/lpr/files/media/${path}`;
  }
  return url;
};
```

**Estado:** ✅ Cambios aplicados - Extracción correcta de datos desde payload_json

---

## Actualización 18/10/2025: Refactorización completa de la interfaz LPR

### 1. Mejoras visuales y de UX

**Archivo modificado:** `src/app/[locale]/(app)/lpr/page.tsx`

- **Crop de matrícula redimensionado:** Tamaño fijo de `w-[160px] h-[62px]` para consistencia visual
- **Matrícula más visible:** 
  - Texto aumentado a `text-2xl font-black` (muy grande y en negrita)
  - Centrado con espaciado de letras (`tracking-wider`)
  - Formato uppercase automático
  - Borde con hover effect para mejor interacción visual
  - Destacado debajo del crop para ubicación intuitiva

- **Layout reorganizado con grid de 3 columnas:**
  ```
  [160px (Crop+Matrícula)] | [auto (Info en grid 2x4)] | [1fr (Acciones)]
  ```
  - Columna 1: Crop de 160x62px + Matrícula destacada
  - Columna 2: Información principal en grid compacto 2x4 (Cámara, Fecha, Confianza, Velocidad, Zona, Vehículo, Semáforo, Falso Positivo)
  - Columna 3: Botones de acciones alineados a la derecha

- **Información mejor organizada:**
  - Labels en uppercase con mejor contraste
  - Datos con formato semibold y monospace donde corresponde
  - Badges destacados para confianza y falsos positivos
  - Mayor espaciado entre cards (`space-y-3` → `space-y-3`)

### 2. Mejoras funcionales

- **Paginación inteligente mejorada:**
  - Lógica con ellipsis (`…`) para rangos grandes
  - Muestra páginas contextuales alrededor de la actual
  - Siempre muestra primera y última página
  - Mejor feedback: "Mostrando X a Y de Z eventos totales"
  - Botones con ancho mínimo (`min-w-[40px]`) para mejor UX

- **Carga inicial optimizada:**
  - Separados efectos `useEffect` (inicial vs búsqueda)
  - Filtro de búsqueda no dispara carga si está vacío
  - Mejor manejo de estados de carga y errores

### 3. Convenciones de código

- **Snake_case consistency:**
  - `loadEvents` → `load_events`
  - `applyFilters` → `apply_filters`
  - Variables internas también en snake_case

- **JSDoc agregado:**
  ```typescript
  /**
   * Carga eventos LPR desde el backend mediante el endpoint proxy.
   * Aplica filtros de matrícula, rango de fechas y paginación.
   * @param plate_filter - Filtro de matrícula parcial (opcional)
   * @param start_datetime - Fecha/hora inicio en formato ISO (opcional)
   * @param end_datetime - Fecha/hora fin en formato ISO (opcional)
   * @param page - Número de página (por defecto 1)
   */
  ```

### 4. Correcciones de errores

- ✅ Efecto de carga duplicado resuelto
- ✅ Referencias inconsistentes de funciones corregidas
- ✅ Paginación confusa mejorada con lógica de ellipsis
- ✅ Crop sin tamaño fijo ahora tiene dimensiones exactas
- ✅ Manejo de errores de carga de imágenes mejorado
- ✅ Descripción actualizada: "Sistema de detección y registro de matrículas vehiculares en tiempo real"
- ✅ **CRÍTICO:** useEffect unificado con todas las dependencias (searchTerm, startDate, endDate, startTime, endTime, currentPage) para que la paginación funcione correctamente
- ✅ **CRÍTICO:** Visualización de matrículas vacías corregida - ahora muestra "SIN MATRÍCULA" cuando el campo está vacío

### 5. Vista previa del nuevo layout

```
┌────────────────────────────────────────────────────────────────────┐
│ [Crop 160x62px]   │  CÁMARA: Portones        │  [📷 Ver Snapshot] │
│                   │  FECHA/HORA: 18/10/2025  │  [🎬 Ver Clip]     │
│     ABC123        │  CONFIANZA: 95.5% ✓      │                    │
│  (texto 2xl)      │  VELOCIDAD: 45 km/h      │                    │
│                   │  ZONA: Entrada           │                    │
│                   │  VEHÍCULO: 🚗 Auto       │                    │
└────────────────────────────────────────────────────────────────────┘
```

### 6. Despliegue aplicado

```bash
# Compilación Next.js
npm run build  # ✅ Compiled successfully

# Sincronización a Docker
.\sync-frontend.bat  # ✅ Sincronización completada

# Reconstrucción imagen
docker compose build frontend  # ✅ Built in 46.3s

# Levantamiento del servicio
docker compose up -d frontend  # ✅ Container running
```

### 8. Implementación: Configuración de logs del backend de matrículas

**Fecha de implementación:** 19 de octubre de 2025  
**Versión asociada:** v0.0.35

#### Problema identificado
Los logs del backend de matrículas se guardaban por defecto en `/app/LOG` (ruta del contenedor Docker), pero cuando se ejecutaba localmente en desarrollo, esta ruta no existía y los logs no se guardaban correctamente.

#### Solución implementada

**Archivo modificado:** `backend/Matriculas/listener/app.py`

**Cambio principal:** Modificación de la lógica de configuración de `LOG_DIR` para usar rutas relativas al proyecto.

**Código anterior:**
```python
LOG_DIR = os.path.abspath(os.getenv("LOG_DIR", "/app/LOG"))
```

**Código nuevo:**
```python
# Cambiar LOG_DIR para usar la carpeta LOG en backend/Matriculas/LOG
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)  # Subir un nivel desde listener/
LOG_DIR = os.path.abspath(os.getenv("LOG_DIR", os.path.join(PROJECT_ROOT, "LOG")))
```

**Resultado:**
- **Desarrollo local:** Logs se guardan en `backend/Matriculas/LOG/`
- **Docker:** Logs se guardan en `/app/LOG/` (mapeado a `backend/Matriculas/LOG/` localmente)
- **Consistencia:** La carpeta `LOG` siempre existe en la ubicación correcta

#### Archivos de log
- `backend/Matriculas/LOG/listener.log`: Log principal del servicio
- `backend/Matriculas/LOG/stats.log`: Estadísticas del sistema (JSON cada 2s)

#### Testing
Se creó y ejecutó un script de prueba que verificó que los logs se crean correctamente en `backend/Matriculas/LOG/`.

**Estado:** ✅ Implementación completada y probada

---

### 9. Implementación: Configuración del backend de matrículas

**Fecha de implementación:** 19 de octubre de 2025  
**Versión asociada:** v0.0.35

#### Problema identificado
El backend de matrículas no estaba cargando la configuración desde el archivo correcto. El código buscaba el archivo en `/app/matriculas.conf` (ruta del contenedor Docker), pero el archivo real estaba en `backend/Matriculas/matriculas.conf`.

#### Solución implementada

**Archivo modificado:** `backend/Matriculas/listener/app.py`

**Cambio principal:** Modificación de la lógica de configuración de `CONF_PATH` para usar rutas relativas al proyecto.

**Código anterior:**
```python
CONF_PATH = os.path.abspath(os.getenv("CONF_PATH", "/app/matriculas.conf"))
```

**Código nuevo:**
```python
# Cambiar CONF_PATH para usar el archivo en backend/Matriculas/matriculas.conf
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)  # Subir un nivel desde listener/
CONF_PATH = os.path.abspath(os.getenv("CONF_PATH", os.path.join(PROJECT_ROOT, "matriculas.conf")))
```

**Resultado:**
- **Desarrollo local:** Configuración cargada desde `backend/Matriculas/matriculas.conf`
- **Docker:** Configuración cargada desde `/app/matriculas.conf` (mapeado correctamente)
- **Consistencia:** El archivo de configuración se encuentra en la ubicación correcta

#### Configuración cargada correctamente
- **Sección [general]:** `http_port = 2221`, `retention_days = 30`
- **Sección [server:helvecia]:** Configuración completa de MQTT, Frigate y SFTP

#### Testing
Se creó y ejecutó un script de prueba que verificó que la configuración se carga correctamente desde `backend/Matriculas/matriculas.conf`.

**Estado:** ✅ Implementación completada y probada

---

## Actualización 14/10/2025: Refactor LPR y logs de backend

### 1. Matrículas (LPR) - Eliminación de datos demo

- El frontend de matrículas (`plates-lpr/page.tsx`) fue refactorizado para eliminar por completo el uso de datos de ejemplo (`sampleLPRReadings`, `shouldShowSampleData`).
- Ahora SIEMPRE se consulta la base de datos real del backend LPR usando el endpoint proxy `/api/lpr/readings`.
- Si no hay datos, se muestra la grilla vacía, nunca datos simulados.
- El sistema es consistente y solo muestra datos reales.

### 2. Endpoint de estado de backend - Logs Docker

- El endpoint `/api/config/backend/status` ahora incluye los últimos logs de cada servicio backend (LPR, Conteo, Notificaciones) en la respuesta JSON.
- Se agregó la función `get_docker_container_logs(service_name, lines)` en `src/lib/docker-utils.ts` para obtener los últimos logs (`docker logs --tail 50`).
- La respuesta incluye:
  - Estado y métricas Docker (`docker_status`)
  - Array de líneas de log recientes (`logs`)
  - Configuración y estado habilitado

Ejemplo de respuesta:
```json
{
  "services": {
    "LPR (Matrículas)": {
      "enabled": true,
      "config": "{...}",
      "docker_status": { ... },
      "logs": ["2025-10-14 10:00:01 Evento guardado...", "2025-10-14 10:00:02 ..."]
    },
    ...
  },
  "docker_available": true
}
```

### 3. Compilación y despliegue - Sin --no-cache

- Se verificó que ningún script de despliegue (`deploy.bat`, `deploy.sh`, `docker-deploy.sh`, `sync-frontend.*`) utiliza la opción `--no-cache`.
- Todas las compilaciones usan la cache de Docker por defecto, optimizando tiempos y recursos.

### Cómo probar los cambios

1. **Ver matrículas:**
   - Accede a la página de matrículas.
   - Verifica que nunca aparecen datos de demo, solo datos reales o la grilla vacía.
2. **Ver estado backend:**
   - Accede a `/api/config/backend/status` (puedes usar Postman, navegador o fetch).
   - Verifica que la respuesta incluye los logs recientes de cada servicio.
3. **Despliegue:**
   - Ejecuta cualquier script de despliegue y confirma que no se usa `--no-cache`.

---
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
// Result: 1697220600 (22:30 UTC) - 3 horas adelante!

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

## Implementación: Sistema de Acceso SSH para Clips Remotos LPR

**Fecha de implementación:** 14 de octubre de 2025  
**Versión asociada:** v0.0.32

### Descripción general

Sistema de configuración y validación de acceso SSH para obtener clips almacenados en servidores Frigate remotos. Incluye campos de configuración en el panel de ajustes LPR, endpoint de validación SSH y generación automática de comandos de configuración cuando falla la autenticación.

### Cambios implementados

#### 1. Campos SSH en configuración LPR Backend
#### 2. Endpoint de validación SSH - POST /api/lpr/test-ssh
#### 3. Mejoras en logs de Docker
#### 4. Mejora del mensaje de sistema LPR no disponible
#### 5. Botones Dashboard e Infracciones en barra principal
#### 6. Página de Dashboard Administrativo
#### 7. Página de Infracciones de Tránsito completa

Ver detalles completos en documentación de código.

## Implementación: Proxy de lecturas LPR - Conexión directa al backend

**Fecha de implementación:** 14 de octubre de 2025  
**Versión asociada:** v0.0.33

### Descripción general

Refactorización crítica del endpoint `/api/lpr/readings` para funcionar como proxy directo al backend LPR en lugar de usar una base de datos local separada. Esto resuelve el problema de datos duplicados y desincronización entre el backend y el frontend.

### Problema identificado

**Síntomas:**
- Frontend mostraba datos de ejemplo en lugar de detecciones reales
- Backend LPR detectaba matrículas correctamente (logs: "✅ Evento guardado exitosamente: ID=3, Matrícula=AYN619")
- Existían DOS bases de datos SQLite:
  - `DB/matriculas.db` (0 bytes, vacía) - Usada por el frontend
  - `backend/lpr/data/lpr-readings.db` (32KB con datos) - Usada por el backend

**Causa raíz:**
El frontend intentaba leer de su propia BD local (`matriculas.db`) que nunca recibía datos, mientras el backend guardaba correctamente en `lpr-readings.db`.

### Solución implementada

**Endpoint refactorizado:** `/api/lpr/readings` ahora funciona como proxy hacia el backend LPR.

**Flujo anterior (❌ INCORRECTO):**
```
Frontend → /api/lpr/readings → DB/matriculas.db (vacía)
Backend MQTT → lpr-readings.db (con datos) 
```

**Flujo nuevo (✅ CORRECTO):**
```
Frontend → /api/lpr/readings (proxy) → Backend LPR API → lpr-readings.db (única fuente)
```

### Cambios en el código

#### 1. Archivo: `src/app/api/lpr/readings/route.ts`

**Cambios principales:**
- Eliminada dependencia de `getLPRDatabase()` y `getLPRFileManager()`
- Ahora consulta `http://localhost:2221/api/events` del backend LPR
- Agrega autenticación Basic Auth usando credenciales de configuración
- Adapta el formato de respuesta del backend al formato esperado por el frontend

**Mapeo de parámetros:**
```typescript
// Frontend → Backend
plate → license_plate
camera → camera_name
confidence_min → min_confidence
after (timestamp) → start_date (ISO datetime)
before (timestamp) → end_date (ISO datetime)
offset/limit → page/limit
```

**Mapeo de respuesta:**
```typescript
// Backend → Frontend
event.license_plate → reading.plate
event.camera_name → reading.camera
event.timestamp (datetime) → reading.timestamp (unix timestamp)
event.snapshot_url → reading.local_files.snapshot_url (con URL completa)
```

**Autenticación:**
```typescript
const auth_user = config.api_user || 'admin';
const auth_pass = config.api_password || 'exalink2024';
const auth_header = 'Basic ' + Buffer.from(`${auth_user}:${auth_pass}`).toString('base64');
```

#### 2. Archivo: `src/app/[locale]/(app)/plates-lpr/page.tsx`

**Eliminada lógica de datos de ejemplo:**
```typescript
// ❌ ANTES: Mostraba datos de ejemplo si no había datos reales
if (!lpr_filters.plateSearch && shouldShowSampleData(realData) && !hasRealDataInDB) {
  set_lpr_readings(sampleLPRReadings);
  set_showing_sample_data(true);
}

// ✅ AHORA: Siempre usa datos del backend
set_lpr_readings(realData);
set_showing_sample_data(false);
if (realData.length === 0) {
  console.log('⚠️ No hay datos en la base de datos para los filtros aplicados');
}
```

**Logs mejorados:**
```typescript
console.log(`📊 Lecturas recibidas de la BD: ${realData.length}, Total en BD: ${data.total}`);
```

### Endpoint del backend LPR

**URL:** `GET http://localhost:2221/api/events`

**Parámetros:**
- `page` (int): Número de página (default: 1)
- `limit` (int): Eventos por página (default: 50, max: 200)
- `camera_name` (string): Filtrar por cámara
- `license_plate` (string): Filtrar por matrícula (búsqueda parcial)
- `start_date` (datetime ISO): Fecha de inicio
- `end_date` (datetime ISO): Fecha de fin
- `min_confidence` (float): Confianza mínima (0-1)
- `zone` (string): Filtrar por zona
- `traffic_light_status` (enum): Estado del semáforo
- `vehicle_type` (enum): Tipo de vehículo
- `false_positive` (bool): Filtrar falsos positivos

**Respuesta:**
```json
{
  "events": [
    {
      "id": 3,
      "license_plate": "AYN619",
      "camera_name": "Escuela",
      "confidence": 0.95,
      "timestamp": "2025-10-14T01:30:00Z",
      "zone": "Frente",
      "vehicle_type": "car",
      "traffic_light_status": "green",
      "false_positive": false,
      "snapshot_path": "/data/snapshots/...",
      "clip_path": "/data/clips/...",
      "crop_path": "/data/crops/..."
    }
  ],
  "total": 45,
  "page": 1,
  "limit": 50,
  "has_next": false
}
```

**Autenticación:**
- Tipo: Basic Auth
- Usuario: Configurable en `backend_config.api_user` (default: "admin")
- Contraseña: Configurable en `backend_config.api_password` (default: "exalink2024")

### Configuración requerida

**Campos en `backend_config` para servicio "LPR (Matrículas)":**
```json
{
  "api_port": 2221,
  "api_user": "admin",
  "api_password": "exalink2024",
  "enabled": true
}
```

### Ventajas de la solución

1. **Única fuente de verdad**: Una sola base de datos (`lpr-readings.db`) gestionada por el backend
2. **Sin duplicación**: No hay necesidad de sincronizar dos bases de datos
3. **Autenticación centralizada**: El backend maneja todos los aspectos de seguridad
4. **Escalabilidad**: Fácil migrar a backend remoto (solo cambiar URL)
5. **Consistencia**: Frontend siempre muestra datos actualizados del backend
6. **Mantenibilidad**: Lógica de BD centralizada en un solo lugar

### Logs de debugging

**Frontend (Next.js logs):**
```
📡 Consultando backend LPR: http://localhost:2221/api/events?page=1&limit=50
✅ Eventos recibidos del backend: 3, Total: 3
📊 Lecturas recibidas de la BD: 3, Total en BD: 3
```

**Backend LPR (Docker logs):**
```
✅ Evento guardado exitosamente: ID=3, Matrícula=AYN619 en Escuela
📊 GET /api/events → 200 OK (3 eventos retornados)
```

### Testing

**Verificar conexión:**
```powershell
# Test directo al backend (requiere auth)
$headers = @{
    "Authorization" = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("admin:exalink2024"))
}
Invoke-WebRequest -Uri "http://localhost:2221/api/events?limit=10" -Headers $headers

# Test via proxy (no requiere auth - el proxy la agrega)
Invoke-WebRequest -Uri "http://localhost:9002/api/lpr/readings?limit=10"
```

**Verificar datos en BD del backend:**
```powershell
docker exec exalink-lpr-backend python -c "
import sqlite3
conn = sqlite3.connect('/app/data/lpr-readings.db')
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM plate_events')
print(f'Total eventos: {cursor.fetchone()[0]}')
cursor.execute('SELECT id, license_plate, camera_name, timestamp FROM plate_events ORDER BY id DESC LIMIT 5')
for row in cursor.fetchall():
    print(row)
conn.close()
"
```

### Próximos pasos

1. **Eliminar BD local innecesaria:** Considerar eliminar `DB/matriculas.db` y todo el código de `lpr-database.ts`
2. **Caché opcional:** Implementar caché en el proxy para reducir latencia
3. **WebSockets:** Considerar notificaciones en tiempo real para nuevas detecciones
4. **Logs periódicos:** Agregar logging cada 1 minuto del estado del sistema (pendiente por solicitud del usuario)

### Notas técnicas

- El backend LPR usa SQLAlchemy ORM con SQLite
- Tabla principal: `plate_events` en `/app/data/lpr-readings.db`
- El proxy maneja conversión de timestamps (datetime ISO ↔ Unix timestamp)
- URLs de archivos multimedia se generan con la URL base del backend
- El timeout de peticiones es de 10 segundos

### Archivos modificados

- `src/app/api/lpr/readings/route.ts` - Refactorizado completamente como proxy
- `src/app/[locale]/(app)/plates-lpr/page.tsx` - Eliminada lógica de datos de ejemplo
- `AGENTS.md` - Documentación agregada

**Referencia de implementación:**
Ver código completo en `src/app/api/lpr/readings/route.ts` líneas 1-125.

---

### 7. Implementación: Lectura directa de DB/Matriculas.db para campos plate y speed

**Fecha de implementación:** 19 de octubre de 2025  
**Versión asociada:** v0.0.34

#### Problema identificado
El panel LPR no mostraba correctamente los campos `plate` (matrícula) y `speed` (velocidad) de la base de datos `DB/Matriculas.db`. Los campos aparecían vacíos en lugar de mostrar "N/A" cuando estaban vacíos o los valores reales cuando existían.

#### Solución implementada

**Endpoint modificado:** `/api/lpr/readings`

**Cambio principal:** Se cambió de proxy al backend LPR a lectura directa de la base de datos SQLite.

**Flujo anterior (❌ INCORRECTO):**
```
Frontend → /api/lpr/readings (proxy) → Backend LPR API → lpr-readings.db
```

**Flujo nuevo (✅ CORRECTO):**
```
Frontend → /api/lpr/readings (DB directa) → DB/Matriculas.db (events table)
```

#### Cambios en el código

**Archivo:** `src/app/api/lpr/readings/route.ts`

- **Librerías agregadas:** `sqlite3` y `sqlite` para acceso a base de datos
- **Query SQL directa:** Lectura de campos `plate`, `speed`, `camera`, `ts`, etc. desde tabla `events`
- **Lógica de campos:**
  ```typescript
  plate: (row.plate !== null && row.plate !== undefined && row.plate.trim() !== '') ? row.plate.trim() : 'N/A'
  speed: (row.speed !== null && row.speed !== undefined) ? row.speed : 'N/A'
  ```

#### Resultado

**Registros sin matrícula:**
```json
{
  "id": 394,
  "plate": "N/A",
  "speed": "0"
}
```

**Registros con matrícula:**
```json
{
  "id": 338,
  "plate": "XYZ789", 
  "speed": "62.5"
}
```

#### Funcionalidades mantenidas

- ✅ Filtros por matrícula (búsqueda parcial)
- ✅ Filtros por cámara
- ✅ Filtros por rango de fechas
- ✅ Paginación
- ✅ Información adicional (zona, tipo de vehículo, archivos multimedia)

#### Archivos modificados

- `src/app/api/lpr/readings/route.ts` - Refactorizado completamente
- `package.json` - Agregadas dependencias `sqlite3` y `@types/sqlite3`
- `frontend-build/` - Sincronizado con cambios

#### Testing

**Verificación de funcionamiento:**
```bash
# Registros sin matrícula
curl "http://localhost:9002/api/lpr/readings?limit=2"
# Result: plate: "N/A", speed: valores numéricos

# Registro con matrícula  
curl "http://localhost:9002/api/lpr/readings?plate=XYZ"
# Result: plate: "XYZ789", speed: "62.5"
```

**Estado:** ✅ Implementación completada y funcionando en producción

