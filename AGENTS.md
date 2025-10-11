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