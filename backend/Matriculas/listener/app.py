import os
import json
import sqlite3
import threading
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, Any

import requests
import paramiko
import paho.mqtt.client as mqtt
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from dateutil import parser as dtparser
import configparser
from fastapi.staticfiles import StaticFiles

DB_DIR = os.path.abspath(os.getenv("DB_DIR", "/app/DB"))
MEDIA_DIR = os.path.abspath(os.getenv("MEDIA_DIR", "/app/MEDIA"))
# Cambiar LOG_DIR para usar la carpeta LOG en backend/Matriculas/LOG
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)  # Subir un nivel desde listener/
LOG_DIR = os.path.abspath(os.getenv("LOG_DIR", os.path.join(PROJECT_ROOT, "LOG")))
CONF_PATH = os.path.abspath(os.getenv("CONF_PATH", os.path.join(PROJECT_ROOT, "matriculas.conf")))

os.makedirs(DB_DIR, exist_ok=True)
os.makedirs(MEDIA_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)
DB_PATH = os.path.join(DB_DIR, "Matriculas.db")
LOG_PATH = os.path.join(LOG_DIR, "listener.log")
STATS_PATH = os.path.join(LOG_DIR, "stats.log")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(), logging.FileHandler(LOG_PATH, encoding="utf-8")],
)
log = logging.getLogger("listener")

app = FastAPI(title="Matriculas Listener")

_cfg = configparser.ConfigParser()
_servers: Dict[str, Dict[str, Any]] = {}
_clients: Dict[str, mqtt.Client] = {}
_cache: Dict[str, Dict[str, Any]] = {}  # key: server|event_id
_http_port = 2221
_retention_days = 30
_server_labels: Dict[str, str] = {}


def load_config() -> None:
    global _servers, _http_port, _retention_days
    if not os.path.exists(CONF_PATH):
        log.warning("Config file not found: %s", CONF_PATH)
        _servers = {}
        return
    _cfg.read(CONF_PATH, encoding="utf-8")
    _http_port = int(_cfg.get("general", "http_port", fallback="2221"))
    _retention_days = int(_cfg.get("general", "retention_days", fallback="30"))
    servers: Dict[str, Dict[str, Any]] = {}
    for section in _cfg.sections():
        if section.startswith("server:"):
            name = section.split(":", 1)[1]
            servers[name] = {
                "name": name,
                "mqtt_broker": _cfg.get(section, "mqtt_broker", fallback="127.0.0.1"),
                "mqtt_port": _cfg.getint(section, "mqtt_port", fallback=1883),
                "mqtt_user": _cfg.get(section, "mqtt_user", fallback=""),
                "mqtt_pass": _cfg.get(section, "mqtt_pass", fallback=""),
                "frigate_url": _cfg.get(section, "frigate_url", fallback=""),
                "frigate_token": _cfg.get(section, "frigate_token", fallback=""),
                "frigate_auth": _cfg.get(section, "frigate_auth", fallback="bearer"),  # bearer|basic|header
                "frigate_user": _cfg.get(section, "frigate_user", fallback=""),
                "frigate_pass": _cfg.get(section, "frigate_pass", fallback=""),
                "frigate_header_name": _cfg.get(section, "frigate_header_name", fallback=""),
                "frigate_header_value": _cfg.get(section, "frigate_header_value", fallback=""),
                "mqtt_topic": _cfg.get(section, "mqtt_topic", fallback="frigate/events"),
                "sftp_host": _cfg.get(section, "sftp_host", fallback=""),
                "sftp_port": _cfg.getint(section, "sftp_port", fallback=22),
                "sftp_user": _cfg.get(section, "sftp_user", fallback="frigate"),
                "sftp_pass": _cfg.get(section, "sftp_pass", fallback="frigate123"),
                # Root base where SFTP crops are stored on the server
                "sftp_plate_root": _cfg.get(section, "sftp_plate_root", fallback="/mnt/cctv/clips/lpr"),
                # Template can use {event_id}, {camera} and {root}. It may point to a DIRECTORY containing OCR crops.
                # Default assumes a folder per event_id with multiple crops inside.
                "sftp_plate_path_template": _cfg.get(section, "sftp_plate_path_template", fallback="{root}/{camera}/{event_id}/"),
                # Clip retrieval mode and templates (api or sftp)
                "sftp_clip_mode": _cfg.get(section, "sftp_clip_mode", fallback="api"),  # api|sftp
                "sftp_clip_root": _cfg.get(section, "sftp_clip_root", fallback="/mnt/cctv/clips/lpr"),
                # If template resolves to a directory (e.g., {root}/{camera}/), we will pick the most recent .mp4
                "sftp_clip_path_template": _cfg.get(section, "sftp_clip_path_template", fallback="{root}/{camera}/"),
            }
    _servers = servers
    log.info("Loaded %d server(s) from config", len(_servers))


def init_db() -> None:
    log.info("🔧 BACKEND LPR: Inicializando base de datos para escritura en %s", DB_PATH)
    
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            server TEXT NOT NULL,
            frigate_event_id TEXT NOT NULL,
            topic TEXT,
            event_type TEXT,
            camera TEXT,
            ts DATETIME,
            payload_json TEXT NOT NULL,
            snapshot_path TEXT,
            clip_path TEXT,
            plate_crop_path TEXT,
            plate TEXT,
            speed REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(server, frigate_event_id)
        );
        """
    )
    # Migración defensiva: agregar columna speed si no existe en instalaciones previas
    try:
        cur.execute("ALTER TABLE events ADD COLUMN speed REAL")
        con.commit()
    except Exception:
        # ya existe o no se puede alterar, continuar
        pass
    # Migración defensiva: agregar columna plate si no existe en instalaciones previas
    try:
        cur.execute("ALTER TABLE events ADD COLUMN plate TEXT")
        con.commit()
    except Exception:
        # ya existe o no se puede alterar, continuar
        pass
    # Migración defensiva: agregar columna score si no existe en instalaciones previas
    try:
        cur.execute("ALTER TABLE events ADD COLUMN score REAL")
        con.commit()
    except Exception:
        # ya existe o no se puede alterar, continuar
        pass
    con.commit()
    con.close()
    
    log.info("✅ BACKEND LPR: Base de datos inicializada correctamente - %s", DB_PATH)
    log.info("✅ BACKEND LPR: Conexión a la base de datos verificada - Listo para escritura")


def _db_execute(query: str, params: tuple = ()) -> None:
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute(query, params)
    con.commit()
    con.close()


def _db_query(query: str, params: tuple = ()) -> list[dict]:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    cur.execute(query, params)
    rows = [dict(r) for r in cur.fetchall()]
    con.close()
    return rows


def _media_paths(server_label: str, camera: str, event_id: str, ts: datetime | None) -> dict:
    date_str = (ts or datetime.now()).strftime("%Y-%m-%d")
    base = os.path.join(MEDIA_DIR, server_label, date_str, camera or "unknown")
    os.makedirs(base, exist_ok=True)
    return {
        "snapshot": os.path.join(base, f"{event_id}_snapshot.jpg"),
        "clip": os.path.join(base, f"{event_id}.mp4"),
        "plate": os.path.join(base, f"{event_id}_plate.jpg"),
    }

def _extract_plate(payload: dict) -> tuple[str | None, float]:
    """Intenta extraer una matrícula del payload de Frigate y su confianza.
    Busca en múltiples ubicaciones comunes para integraciones LPR.
    """
    after = payload.get("after") or {}
    best_plate, best_score = None, -1.0

    def consider(plate_val, score_val=0.5):
        nonlocal best_plate, best_score
        if not plate_val:
            return
        # Caso especial: recognized_license_plate es array [matricula, score]
        if isinstance(plate_val, list) and len(plate_val) == 2 and isinstance(plate_val[0], str) and isinstance(plate_val[1], (float, int)):
            p = plate_val[0].strip()
            score = float(plate_val[1]) * 100  # convertir a porcentaje
            if p and score > best_score:
                best_plate, best_score = p.replace(" ", "").replace("-", "").upper(), round(score, 2)
            return
        if isinstance(plate_val, str):
            p = plate_val.strip()
            if not p:
                return
            try:
                score = float(score_val) if score_val is not None else 0.5
            except Exception:
                score = 0.5
            if score > best_score:
                best_plate, best_score = p.replace(" ", "").replace("-", "").upper(), score
        elif isinstance(plate_val, dict):
            consider(plate_val.get("plate") or plate_val.get("text"), plate_val.get("score") or plate_val.get("confidence"))

    # Fuentes posibles
    sources = [
        after.get("recognized_license_plate"),
        after.get("plate"),
        after.get("text"),
        (after.get("snapshot") or {}).get("plate"),
        (after.get("snapshot") or {}).get("text"),
        after.get("regions"),
        after.get("box"),
    ]
    for src in sources:
        consider(src)
    return best_plate, best_score


def _http_get(url: str, server: dict, timeout: int = 10) -> requests.Response:
    """HTTP GET to Frigate honoring configured authentication per server."""
    headers = {}
    auth = None
    mode = (server.get("frigate_auth") or "bearer").lower()
    if mode == "bearer":
        token = server.get("frigate_token")
        if token:
            headers["Authorization"] = f"Bearer {token}"
    elif mode == "basic":
        user = server.get("frigate_user")
        pwd = server.get("frigate_pass")
        if user:
            auth = (user, pwd or "")
    elif mode == "header":
        hn = server.get("frigate_header_name")
        hv = server.get("frigate_header_value")
        if hn and hv:
            headers[hn] = hv
    r = requests.get(url, headers=headers, auth=auth, timeout=timeout)
    r.raise_for_status()
    return r

def _resolve_server_label(server: dict) -> str:
    """Best-effort resolution of a human-friendly server label via API; fallback to hostname.
    Cached per server name.
    """
    name_key = server.get("name") or server.get("frigate_url")
    if name_key in _server_labels:
        return _server_labels[name_key]
    label = None
    base = (server.get("frigate_url") or "").rstrip("/")
    if base:
        # Try /api/config for a server/display name if any vendors expose it
        try:
            resp = _http_get(f"{base}/api/config", server)
            data = resp.json()
            # Heuristics: check common fields
            for k in ("server_name", "instance_name", "name", "hostname"):
                v = data.get(k)
                if isinstance(v, str) and v.strip():
                    label = v.strip()
                    break
        except Exception:
            pass
        # Fallback to URL hostname
        if not label:
            try:
                from urllib.parse import urlparse
                host = urlparse(base).hostname
                if host:
                    label = host
            except Exception:
                pass
    if not label:
        label = server.get("name") or "server"
    _server_labels[name_key] = label
    return label


def _save_bytes(path: str, data: bytes) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


def _download_artifacts(server: dict, camera: str, event_id: str, ts: datetime | None) -> dict:
    saved = {"snapshot": None, "clip": None, "plate": None}
    server_label = server.get("name") or "server"
    paths = _media_paths(server_label, camera, event_id, ts)

    base = server.get("frigate_url", "").rstrip("/")
    if base:
        try:
            resp = _http_get(f"{base}/api/events/{event_id}/snapshot.jpg", server)
            _save_bytes(paths["snapshot"], resp.content)
            saved["snapshot"] = os.path.relpath(paths["snapshot"], MEDIA_DIR)
            log.info("[%s] Snapshot saved: %s", server_label, paths["snapshot"])
        except Exception as e:
            log.warning("[%s] Snapshot download failed: %s", server["name"], e)

    # Clip: prefer SFTP if configured
    clip_mode = (server.get("sftp_clip_mode") or "api").lower()
    if clip_mode == "sftp" and server.get("sftp_host"):
        try:
            clip_root = (server.get("sftp_clip_root") or "/mnt/cctv/clips/lpr").rstrip("/")
            clip_tpl = (server.get("sftp_clip_path_template") or "{root}/{camera}/")
            remote_resolved = clip_tpl.format(root=clip_root, camera=camera, event_id=event_id)
            transport = paramiko.Transport((server["sftp_host"], int(server.get("sftp_port", 22))))
            transport.connect(username=server.get("sftp_user"), password=server.get("sftp_pass"))
            sftp = paramiko.SFTPClient.from_transport(transport)
            remote_path = remote_resolved
            try:
                # If remote_path is a directory, choose a file
                from stat import S_ISDIR
                st = sftp.stat(remote_resolved)
                if S_ISDIR(st.st_mode):
                    # list .mp4 and prefer name containing event_id else newest by mtime
                    candidates = [f for f in sftp.listdir_attr(remote_resolved) if f.filename.lower().endswith('.mp4')]
                    if not candidates:
                        raise FileNotFoundError(f"No mp4 files in {remote_resolved}")
                    selected = None
                    for f in candidates:
                        if event_id and event_id in f.filename:
                            selected = f
                            break
                    if selected is None:
                        selected = sorted(candidates, key=lambda x: x.st_mtime)[-1]
                    remote_path = remote_resolved.rstrip('/') + '/' + selected.filename
            except FileNotFoundError:
                # treat as file path, will raise on get if not exists
                pass
            sftp.get(remote_path, paths["clip"])
            sftp.close(); transport.close()
            saved["clip"] = os.path.relpath(paths["clip"], MEDIA_DIR)
            log.info("[%s] Clip copied via SFTP: %s <- %s", server_label, paths["clip"], remote_path)
        except Exception as e:
            log.warning("[%s] SFTP clip copy failed: %s", server["name"], e)
    else:
        if base:
            try:
                resp = _http_get(f"{base}/api/events/{event_id}/clip.mp4", server)
                _save_bytes(paths["clip"], resp.content)
                saved["clip"] = os.path.relpath(paths["clip"], MEDIA_DIR)
                log.info("[%s] Clip saved: %s", server_label, paths["clip"])
            except Exception as e:
                log.warning("[%s] Clip download failed: %s", server["name"], e)

    # SFTP plate crops (directory with multiple crops). Pick the middle image by time.
    remote_tpl = server.get("sftp_plate_path_template") or ""
    sftp_root = (server.get("sftp_plate_root") or "/mnt/cctv/clips/lpr").rstrip("/")
    if server.get("sftp_host") and remote_tpl:
        # Fill placeholders; provide {root} default
        remote_resolved = remote_tpl.format(event_id=event_id, camera=camera, root=sftp_root)
        try:
            transport = paramiko.Transport((server["sftp_host"], int(server.get("sftp_port", 22))))
            transport.connect(username=server.get("sftp_user"), password=server.get("sftp_pass"))
            sftp = paramiko.SFTPClient.from_transport(transport)
            from stat import S_ISDIR
            dir_path = None
            try:
                st = sftp.stat(remote_resolved)
                if S_ISDIR(st.st_mode):
                    dir_path = remote_resolved
            except FileNotFoundError:
                pass
            # Fallbacks: try path with trailing slash, and path without extension + '/'
            if dir_path is None:
                for alt in (
                    remote_resolved.rstrip("/") + "/",
                    (remote_resolved.rsplit(".", 1)[0] + "/") if "." in remote_resolved.rsplit("/", 1)[-1] else None,
                ):
                    if not alt:
                        continue
                    try:
                        st = sftp.stat(alt)
                        if S_ISDIR(st.st_mode):
                            dir_path = alt
                            break
                    except FileNotFoundError:
                        continue

            chosen_remote = None
            if dir_path is not None:
                # Choose the middle image by modification time
                entries = [e for e in sftp.listdir_attr(dir_path) if e.filename.lower().endswith((".jpg", ".jpeg", ".png"))]
                if entries:
                    entries.sort(key=lambda x: x.st_mtime)
                    chosen = entries[len(entries)//2]
                    chosen_remote = dir_path.rstrip("/") + "/" + chosen.filename
            else:
                chosen_remote = remote_resolved

            if chosen_remote:
                try:
                    sftp.get(chosen_remote, paths["plate"])
                except Exception as ie:
                    log.warning("[%s] Plate crop fetch failed (%s): %s", server_label, chosen_remote, ie)

            sftp.close(); transport.close()

            if os.path.exists(paths["plate"]):
                saved["plate"] = os.path.relpath(paths["plate"], MEDIA_DIR)
                log.info("[%s] Plate crop saved (middle): %s <- %s", server_label, paths["plate"], chosen_remote or "-")
            else:
                log.warning("[%s] No plate crop saved for event %s", server_label, event_id)
        except Exception as e:
            log.warning("[%s] Plate crop SFTP error: %s", server_label, e)

    return saved


def _persist_event(server_name: str, event_id: str, topic: str, payload: dict):
    camera = (payload.get("after", {}) or {}).get("camera") or payload.get("camera") or ""
    plate, score = _extract_plate(payload)
    if not plate:
        log.info("⏭️  Evento ignorado (sin matrícula detectada) | id=%s | cam=%s", event_id, camera)
        return
    ts_raw = (payload.get("after", {}) or {}).get("frame_time") or payload.get("time") or payload.get("timestamp")
    ts: datetime | None = None
    try:
        if isinstance(ts_raw, (int, float)):
            ts = datetime.fromtimestamp(float(ts_raw))
        elif isinstance(ts_raw, str):
            ts = dtparser.parse(ts_raw)
    except Exception:
        ts = None

    art = _download_artifacts(_servers[server_name], camera or "", event_id, ts)

    def _extract_speed(p: dict) -> float | None:
        try:
            after = p.get("after") or {}
            val = after.get("current_estimated_speed")
            if isinstance(val, (int, float)):
                return float(val)
            if isinstance(val, str):
                try:
                    return float(val)
                except Exception:
                    pass
            for key_path in (
                ("speed",),
                ("current_estimated_speed",),
                ("vehicle", "speed"),
                ("attributes", "speed"),
            ):
                obj = after
                for k in key_path:
                    if isinstance(obj, dict) and k in obj:
                        obj = obj.get(k)
                    else:
                        obj = None
                        break
                if isinstance(obj, (int, float)):
                    return float(obj)
                if isinstance(obj, str):
                    try:
                        return float(obj)
                    except Exception:
                        pass
            val = p.get("speed") or p.get("current_estimated_speed")
            if isinstance(val, (int, float)):
                return float(val)
            if isinstance(val, str):
                try:
                    return float(val)
                except Exception:
                    pass
        except Exception:
            return None
        return None

    spd = _extract_speed(payload)

    try:
        _db_execute(
            """
            INSERT OR IGNORE INTO events(server, frigate_event_id, topic, event_type, camera, ts, payload_json, snapshot_path, clip_path, plate_crop_path, plate, speed, score)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                server_name,
                event_id,
                topic,
                payload.get("type"),
                camera,
                ts.isoformat() if ts else None,
                json.dumps(payload, ensure_ascii=False),
                art["snapshot"],
                art["clip"],
                art["plate"],
                plate,
                spd,
                score,
            ),
        )
        log.info(
            "✅ [LPR] DB OK | 🆔 %s | 📷 %s | 🚗 %s | 🏁 %.2f | 💯 %.2f | 🖼️ %s | 🎬 %s | # %s",
            event_id,
            camera,
            plate,
            spd if spd is not None else -1,
            score if score is not None else -1,
            art["snapshot"],
            art["clip"],
            art["plate"],
        )
    except Exception as e:
        log.error("❌ [LPR] Error al escribir en DB | id=%s | cam=%s | plate=%s | error=%s", event_id, camera, plate, e)


def _on_message(server_name: str):
    def handler(client, userdata, msg):
        try:
            payload = json.loads(msg.payload.decode("utf-8", errors="replace"))
        except Exception as e:
            log.warning("[%s] Bad JSON on topic %s: %s", server_name, msg.topic, e)
            return
        ev_id = (payload.get("after", {}) or {}).get("id") or payload.get("id")
        if not ev_id:
            return
        key = f"{server_name}|{ev_id}"
        _cache.setdefault(key, {"topic": msg.topic, "payload": payload})
        _cache[key].update({"topic": msg.topic, "payload": payload})

        if payload.get("type") == "end":
            try:
                _persist_event(server_name, ev_id, msg.topic, payload)
            finally:
                _cache.pop(key, None)
    return handler


def _connect_server(server: Dict[str, Any]) -> None:
    name = server["name"]
    if name in _clients:
        try:
            _clients[name].disconnect()
        except Exception:
            pass
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=f"matriculas-{name}-{int(time.time())}")
    if server.get("mqtt_user"):
        client.username_pw_set(server.get("mqtt_user"), server.get("mqtt_pass"))
    client.on_connect = lambda c, u, f, rc, p: (log.info("[%s] MQTT connected to %s:%s", name, server.get("mqtt_broker"), server.get("mqtt_port")), c.subscribe(server.get("mqtt_topic", "frigate/events")))
    client.on_message = _on_message(name)
    try:
        client.connect(server.get("mqtt_broker"), int(server.get("mqtt_port", 1883)), 60)
        threading.Thread(target=client.loop_forever, daemon=True).start()
        _clients[name] = client
    except Exception as e:
        log.error("[%s] MQTT connect failed: %s", name, e)


@app.on_event("startup")
def startup():
    load_config()
    init_db()
    for s in _servers.values():
        _connect_server(s)
    log.info("Service started. HTTP port configured: %s", _http_port)
    # Run initial cleanup and schedule daily at midnight
    threading.Thread(target=_cleanup_loop, daemon=True).start()
    # Start stats writer
    threading.Thread(target=_stats_loop, daemon=True).start()
    # Start connectivity health check
    threading.Thread(target=_check_connectivity_loop, daemon=True).start()

def _check_connectivity_loop():
    while True:
        try:
            # MQTT: verificar que cada cliente esté conectado
            for name, client in _clients.items():
                try:
                    if client.is_connected():
                        log.info(f"[HEALTH] MQTT OK | server={name}")
                    else:
                        log.warning(f"[HEALTH] MQTT NOT CONNECTED | server={name}")
                except Exception as e:
                    log.error(f"[HEALTH] MQTT ERROR | server={name} | {e}")
            # Frigate: probar HTTP /health de cada server
            for name, server in _servers.items():
                url = server.get("frigate_url")
                if url:
                    try:
                        resp = requests.get(url.rstrip("/") + "/api/health", timeout=5)
                        if resp.status_code == 200:
                            log.info(f"[HEALTH] FRIGATE OK | server={name} | url={url}")
                        else:
                            log.warning(f"[HEALTH] FRIGATE FAIL | server={name} | url={url} | status={resp.status_code}")
                    except Exception as e:
                        log.error(f"[HEALTH] FRIGATE ERROR | server={name} | url={url} | {e}")
        except Exception as e:
            log.error(f"[HEALTH] CHECK LOOP ERROR: {e}")
        time.sleep(60)


@app.get("/health")
def health():
    return {"status": "ok", "servers": list(_servers.keys())}


@app.get("/events")
def list_events(limit: int = 50):
    rows = _db_query(
        "SELECT id, server, frigate_event_id, camera, event_type, ts, snapshot_path, clip_path, plate_crop_path, plate, speed, score, created_at FROM events ORDER BY id DESC LIMIT ?",
        (limit,),
    )
    # Convert media relative paths to URLs under /media
    for r in rows:
        for k in ("snapshot_path", "clip_path", "plate_crop_path"):
            if r.get(k):
                r[k] = f"/media/{r[k]}"
    return rows


@app.get("/logs")
def get_logs(limit: int = 1000):
    try:
        with open(LOG_PATH, "r", encoding="utf-8") as f:
            lines = f.readlines()[-limit:]
        return JSONResponse(content={"lines": lines})
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# Serve saved media files
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")

if __name__ == "__main__":
    import uvicorn
    # Load config to get default port, allow override via env PORT
    try:
        load_config()
    except Exception:
        pass
    port = int(os.getenv("PORT", str(_http_port or 2221)))
    uvicorn.run("app:app", host="0.0.0.0", port=port, log_level="info")

# ---------------- Retention and Cleanup ----------------
def _cleanup_media(retention_days: int) -> None:
    try:
        if retention_days is None or retention_days <= 0:
            log.info("Retention disabled or invalid: %s", retention_days)
            return
        today = datetime.now().date()
        cutoff = today - timedelta(days=retention_days)
        # MEDIA/<server>/<YYYY-MM-DD>/<camera>/...
        if not os.path.isdir(MEDIA_DIR):
            return
        for server_name in os.listdir(MEDIA_DIR):
            server_path = os.path.join(MEDIA_DIR, server_name)
            if not os.path.isdir(server_path):
                continue
            for date_dir in os.listdir(server_path):
                date_path = os.path.join(server_path, date_dir)
                if not os.path.isdir(date_path):
                    continue
                try:
                    dir_date = datetime.strptime(date_dir, "%Y-%m-%d").date()
                except ValueError:
                    continue
                if dir_date < cutoff:
                    # Delete entire date directory for this server
                    try:
                        # Use shutil.rmtree for recursive delete
                        import shutil
                        shutil.rmtree(date_path)
                        log.info("🧹 Deleted media older than retention: %s", date_path)
                    except Exception as e:
                        log.warning("Failed to delete %s: %s", date_path, e)
    except Exception as e:
        log.error("Cleanup error: %s", e)

def _seconds_until_midnight() -> float:
    now = datetime.now()
    tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return (tomorrow - now).total_seconds()

def _cleanup_loop():
    # Initial cleanup on start
    _cleanup_media(_retention_days)
    while True:
        try:
            sleep_secs = max(1, int(_seconds_until_midnight()))
            time.sleep(sleep_secs)
            # Reload config in case retention_days changed
            try:
                load_config()
            except Exception:
                pass
            _cleanup_media(_retention_days)
        except Exception as e:
            log.error("Cleanup loop error: %s", e)

# ---------------- Stats Writer ----------------
def _stats_loop():
    try:
        import psutil
    except Exception as e:
        log.warning("psutil not available for stats: %s", e)
        return
    # Prime cpu_percent
    try:
        psutil.cpu_percent(interval=None)
    except Exception:
        pass
    while True:
        try:
            data = {
                "ts": datetime.now().isoformat(),
                "cpu_percent": psutil.cpu_percent(interval=None),
                "memory": psutil.virtual_memory()._asdict(),
                "swap": psutil.swap_memory()._asdict(),
                "disk_usage": psutil.disk_usage("/")._asdict() if os.name != "nt" else psutil.disk_usage("C:/")._asdict(),
                "process_count": len(psutil.pids()),
            }
            # overwrite file with latest snapshot
            with open(STATS_PATH, "w", encoding="utf-8") as f:
                f.write(json.dumps(data, ensure_ascii=False))
        except Exception as e:
            # Do not crash; log and continue
            try:
                log.warning("Stats write error: %s", e)
            except Exception:
                pass
        time.sleep(2)

