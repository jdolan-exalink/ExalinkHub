## Revisión de despliegue Docker (multi-servidor)

### Hallazgos principales
- El `docker-compose.yml` y los scripts `deploy.sh` / `docker-deploy.sh` no dependen de una IP específica del host. El stack puede levantarse en cualquier servidor Linux/Windows siempre que el repositorio esté clonado en `/opt/exalink` o ruta equivalente.
- Los volúmenes montados son relativos al repositorio (`./backend/...`, `./DB`, `./data`), por lo que basta con clonar/copiar el proyecto en el servidor destino antes de ejecutar `docker compose up`.
- Las comprobaciones de salud en los scripts usan `http://localhost:2221`, `2223`, `2224`, lo cual funciona siempre que los tests se ejecuten desde la misma máquina que corre los contenedores.

### Bloqueadores detectados para IPs diferentes
- El frontend y varias APIs de Next.js siguen apuntando de forma rígida a `http://10.1.1.252:5000`. Ejemplos:
  - `src/app/api/frigate/events/route.ts:2,22`
  - `src/app/api/frigate/cameras/route.ts:135-159`
  - `src/components/ui/hls-player.tsx:56-67`
  - `src/lib/frigate-api.ts:614-626`
  - `src/lib/data.ts:11-55`
- Mientras esas rutas utilicen URLs fijas, el despliegue solo funcionará si el servidor Frigate mantiene exactamente la IP original.
- También existen semillas en `frontend-build/` que crean un servidor por defecto con IP `10.1.1.252`. Si se reutiliza la build tal cual, aparecerá de nuevo ese valor.

### Próximos pasos recomendados
1. Centralizar la obtención del servidor activo:
   - Crear un helper (`get_main_frigate_server` y/o `get_main_frigate_api`) en `src/lib/frigate-servers.ts`.
   - Reemplazar todas las llamadas directas a `frigateAPI` por instancias construidas a partir del servidor activo almacenado en SQLite.
2. Actualizar los componentes cliente para que utilicen rutas proxy (`/api/frigate/...`) o consuman la URL del servidor desde la base de datos / ajustes, en lugar de concatenar `10.1.1.252`.
3. Regenerar el build del frontend (`frontend-build/`) una vez removidas las IPs fijas, asegurándose de que la configuración inicial venga vacía o con valores neutrales (ej. `http://localhost:5000`).
4. Documentar en `DEPLOYMENT-README.md` el flujo esperado tras el despliegue:
   - Acceder al panel de ajustes → Servidores Frigate.
   - Crear/editar el servidor con la IP/hostname real.
   - Marcar como habilitado para que las APIs lo utilicen.
5. (Opcional) Permitir seleccionar un servidor “principal” y ordenar las consultas cuando haya múltiples servidores habilitados.

### Resultado
Hasta que no se eliminen las referencias directas a `10.1.1.252`, el stack Docker solo funcionará en entornos que respeten esa IP. Con la refactorización descrita, el mismo despliegue podrá apuntar dinámicamente a cualquier servidor Frigate configurado vía base de datos.
