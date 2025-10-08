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