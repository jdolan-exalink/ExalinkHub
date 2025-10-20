# Matriculas Listener

## Resumen
Servicio Python (FastAPI) que escucha eventos de Frigate vía MQTT, descarga artefactos (snapshot, clip y crops de matrícula), filtra solo LPR, y persiste metadatos en SQLite.

- Guarda medios en `MEDIA/<SERVER>/<YYYY-MM-DD>/<CAMARA>/`.
- Solo persiste eventos con matrícula detectada (LPR).
- Descarga crops desde SFTP: selecciona la imagen "del medio" por timestamp desde la carpeta del evento en el servidor.
- Retención configurable por días con limpieza diaria a las 00:00.
- Logs en `LOG/`: `listener.log` (rotación externa) y `stats.log` (snapshot cada 2s, sin histórico).
- Autenticación hacia Frigate: bearer, basic o header.

## Arquitectura
- `listener/app.py`: servicio FastAPI + MQTT client + SFTP + persistencia SQLite.
- `matriculas.conf`: configuración por servidor y parámetros generales.
- Directorios:
  - `DB/`: base SQLite `Matriculas.db`.
  - `MEDIA/`: artefactos descargados.
  - `LOG/`: logs.

## Estructura de medios
Ruta base para cada evento persistido:
```
MEDIA/<SERVER>/<YYYY-MM-DD>/<CAMARA>/
  ├─ <event_id>_snapshot.jpg
  ├─ <event_id>.mp4
  └─ <event_id>_plate.jpg   (crop elegido)
```
- `<SERVER>`: nombre de la sección en `matriculas.conf` (p.ej. `principal`, `helvecia`).
- `<YYYY-MM-DD>`: fecha del evento (o del sistema si no se pudo parsear).

## Retención de medios
- Parámetro `retention_days` en `[general]` (default 30).
- Limpieza automática diaria a las 00:00 (hora local del contenedor):
  - Elimina directorios de fecha anteriores al cutoff (mantiene los últimos N días).
- La limpieza también corre una vez al iniciar el servicio.

## Logging
- **Local (desarrollo)**: `backend/Matriculas/LOG/`
- **Docker**: `/app/LOG/` (mapeado a `backend/Matriculas/LOG/` localmente)
- `LOG/listener.log`: log principal del servicio.
- `LOG/stats.log`: JSON sobrescrito cada 2s con:
  - `ts`, `cpu_percent`, `memory`, `swap`, `disk_usage`, `process_count`.
- Expuesto por HTTP (FastAPI) para inspección rápida.

## Configuración (`matriculas.conf`)
**Ubicación:** `backend/Matriculas/matriculas.conf`

Secciones:
- `[general]`
  - `http_port`: puerto HTTP (default 2221).
  - `retention_days`: días de retención de `MEDIA/` (default 30).
- `[server:<nombre>]`
  - MQTT:
    - `mqtt_broker`, `mqtt_port`, `mqtt_user`, `mqtt_pass`, `mqtt_topic` (default `frigate/events`).
  - Frigate HTTP:
    - `frigate_url`: base URL, p.ej. `http://10.1.1.1:5000`.
    - `frigate_auth`: `bearer` | `basic` | `header` (default `bearer`).
      - `bearer`: `frigate_token`
      - `basic`: `frigate_user`, `frigate_pass`
      - `header`: `frigate_header_name`, `frigate_header_value`
  - SFTP (crops y opcionalmente clip):
    - `sftp_host`, `sftp_port`, `sftp_user`, `sftp_pass`
    - `sftp_plate_root`: raíz de crops en el servidor, default `/mnt/cctv/clips/lpr`
    - `sftp_plate_path_template`: template para carpeta/archivo de crops.
      - Placeholders: `{root}`, `{camera}`, `{event_id}`
      - Recomendado (carpeta por evento): `{root}/{camera}/{event_id}/`
    - Descarga de clip:
      - `sftp_clip_mode`: `api` (default) o `sftp`
      - `sftp_clip_root`: raíz de clips por cámara, default `/mnt/cctv/clips/lpr`
      - `sftp_clip_path_template`: `{root}/{camera}/` (si es carpeta, se busca `.mp4` del evento o el más reciente)

## Lógica LPR (filtro y crops)
- Filtrado LPR: se persisten solo eventos con matrícula detectada. La extracción intenta en varias claves del payload:
  - `after.recognized_license_plate`, `after.plate`, `after.text`, `after.snapshot.plate/text`, `after.regions`, `after.box`.
- Crops por SFTP:
  - Si `sftp_plate_path_template` resuelve a carpeta del evento (p.ej. `/mnt/cctv/clips/lpr/<CAMARA>/<EVENT_ID>/`):
    - Se listan imágenes (`.jpg/.jpeg/.png`), se ordenan por fecha (`st_mtime`) y se elige la del medio.
    - Solo se descarga esa imagen y se guarda como `<event_id>_plate.jpg`.
  - Si resuelve a archivo, se intenta descargar directamente.
  - Robustez: si el template apunta accidentalmente a `.jpg` y no existe, se prueban variantes con `/` y sin extensión como carpeta.

## Endpoints HTTP (FastAPI)
- `GET /health` → `{ status, servers }`.
- `GET /events?limit=N` → últimos eventos en DB (id, server, camera, timestamps, paths). 
- `GET /logs` → tail del log (si implementado). 
- `GET /media/...` → estáticos: publica el contenido de `MEDIA/`.

## Ejecución
- Docker Compose:
  - Volúmenes locales: `./DB:/app/DB`, `./MEDIA:/app/MEDIA`, `./LOG:/app/LOG`, `./matriculas.conf:/app/matriculas.conf:ro`
  - Variables: `DB_DIR`, `MEDIA_DIR`, `LOG_DIR`, `CONF_PATH`
- Iniciar:
```bash
docker compose up -d --build
```

## Panel con `stats.log`
- `LOG/stats.log` se sobrescribe cada 2s con el estado del sistema.
- Consumilo como un archivo JSON de snapshot (no histórico).

## Troubleshooting
- **Crops no se descargan**:
  - Verificar `sftp_plate_path_template` termina en `/`.
  - Revisar permisos SFTP y existencia de la carpeta del evento.
  - Ver logs: `Plate crop saved (middle): ... <- <ruta_remota>`.
- **Clip por SFTP**:
  - Confirmar `sftp_clip_mode = sftp` y plantilla correcta.
  - Si es carpeta, que existan `.mp4`. El sistema elige el que contenga `event_id` o el más reciente.
- **Auth Frigate**:
  - Ver `frigate_auth` y credenciales/cabeceras correspondientes.
  - Probar `GET <frigate_url>/api/events/<id>/snapshot.jpg` manualmente con las mismas credenciales.

## Seguridad
- No se almacenan secretos en código. Se usan `matriculas.conf`/variables de entorno.
- No se expone la DB fuera del contenedor.
- Logs no incluyen datos sensibles (tokens/cabeceras).

## Notas
- El nombre de `<SERVER>` en `MEDIA/` usa el nombre de la sección (`server:<nombre>`) del `matriculas.conf`.
- Si la marca temporal del evento no está presente o no es parseable, se usa la fecha/hora actual para ubicarlo.
- Las rutas relativas guardadas en DB están basadas en `MEDIA/` y se exponen vía `/media`.
