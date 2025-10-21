from fastapi import FastAPI, Body, Query
from fastapi.responses import JSONResponse
import os, json, threading, time, configparser, psutil, logging
import paho.mqtt.client as mqtt
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from datetime import datetime, timedelta, date

# --- Config ---
# Resolve configuration path with the following precedence:
# 1) ENV CONF_PATH
# 2) ./conteo.conf (current working directory)
# 3) repo_root/conteo.conf (three levels up from this file)
# 4) /app/conteo.conf (container default)
CONF_PATH = os.getenv("CONF_PATH")
if not CONF_PATH:
    candidates = [
        os.path.abspath(os.path.join(os.getcwd(), "conteo.conf")),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "conteo.conf")),
        "/app/conteo.conf",
    ]
    for p in candidates:
        if os.path.isfile(p):
            CONF_PATH = p
            break
    if not CONF_PATH:
        CONF_PATH = "/app/conteo.conf"
cfg = configparser.ConfigParser()
cfg.read(CONF_PATH)

def cfg_get(section, key, default=""):
    try:
        return cfg.get(section, key, fallback=default)
    except Exception:
        return default

def cfg_getint(section, key, default=0):
    try:
        return cfg.getint(section, key, fallback=default)
    except Exception:
        return default

MODE=os.getenv("CAMERA_MODE", cfg_get("app","mode","multi"))
CAMERA=os.getenv("CAMERA_NAME", "cam")
CAMERA_LIST=[c.strip() for c in os.getenv("CAMERA_LIST", cfg_get("cameras","selected","")).split(",") if c.strip()]
TITLE=os.getenv("UI_TITLE", "Todas" if MODE=="multi" else CAMERA)

OBJECTS=[o.strip() for o in os.getenv("OBJECTS", cfg_get("objects","labels","auto,moto,bicicleta,autobús,personas")).split(",") if o.strip()]
DB_URL=os.getenv("DB_URL", cfg_get("app","storage","sqlite:////data/Conteo.db"))
RETENTION_DAYS=int(os.getenv("RETENTION_DAYS", str(cfg_getint("app","retention_days",0))))

# Ensure sqlite target directory exists if using absolute sqlite path and touch file
try:
    if DB_URL.startswith("sqlite:////"):
        _db_path = DB_URL[len("sqlite:////"):]
        _db_dir = os.path.dirname(_db_path)
        os.makedirs(_db_dir, exist_ok=True)
        # touch file to ensure it can be created
        with open(_db_path, "a", encoding="utf-8"):
            pass
except Exception as _e:
    try:
        # Defer errors to SQLAlchemy but log intent
        print(f"WARN: could not prepare sqlite path: {DB_URL} err={_e}")
    except Exception:
        pass

def _parse_cameras():
    """Parse camera definitions from config to get list of valid frigate_camera names"""
    cameras = set()
    camera_map = {}  # alias -> frigate_camera mapping
    for sec in cfg.sections():
        if sec.startswith("camera:"):
            alias = sec.split(":", 1)[1]
            frigate_cam = cfg_get(sec, "frigate_camera", "")
            if frigate_cam:
                cameras.add(frigate_cam)
                camera_map[alias] = {
                    "frigate_camera": frigate_cam,
                    "server": cfg_get(sec, "server", ""),
                    "mode": cfg_get(sec, "mode", "zones"),
                    "zone_in": cfg_get(sec, "zone_in", "IN"),
                    "zone_out": cfg_get(sec, "zone_out", "OUT"),
                    "role": cfg_get(sec, "role", ""),
                    "labels": [l.strip() for l in cfg_get(sec, "labels", "").split(",") if l.strip()],
                }
    return cameras, camera_map

def _parse_counters():
    """Parse counter definitions from config"""
    counters = {}
    for sec in cfg.sections():
        if sec.startswith("counter:"):
            counter_id = sec.split(":", 1)[1]
            counter_type = cfg_get(sec, "type", "zones")
            counters[counter_id] = {
                "id": counter_id,
                "type": counter_type,
                "source_camera": cfg_get(sec, "source_camera", ""),
                "in_camera": cfg_get(sec, "in_camera", ""),
                "out_camera": cfg_get(sec, "out_camera", ""),
                "objects": [o.strip() for o in cfg_get(sec, "objects", "").split(",") if o.strip()],
                "zone_strategy": cfg_get(sec, "zone_strategy", "entered"),
                "min_frames_in_zone": cfg_getint(sec, "min_frames_in_zone", 1),
                "initial_occupancy": cfg_getint(sec, "initial_occupancy", 0),
                "reset_schedule": cfg_get(sec, "reset_schedule", ""),
                "publish_delta_only": cfg_get(sec, "publish_delta_only", "false").lower() == "true",
                "sync_window_ms": cfg_getint(sec, "sync_window_ms", 6000),
                "pairing": cfg_get(sec, "pairing", "loose"),
                "in_count": 0,
                "out_count": 0,
                "occupancy": cfg_getint(sec, "initial_occupancy", 0),
            }
    return counters

def _parse_publish_config():
    """Parse publish:mqtt configuration"""
    publish_cfg = {
        "mqtt": {
            "enabled": cfg_get("publish:mqtt", "enabled", "false").lower() == "true",
            "server": cfg_get("publish:mqtt", "server", ""),
            "topic_prefix": cfg_get("publish:mqtt", "topic_prefix", "exacount"),
            "qos": cfg_getint("publish:mqtt", "qos", 0),
            "retain": cfg_get("publish:mqtt", "retain", "false").lower() == "true",
        }
    }
    return publish_cfg

def _parse_servers():
    servers=[]
    for sec in cfg.sections():
        if sec.startswith("server:"):
            sid = sec.split(":",1)[1]
            servers.append({
                "id": sid,
                "enabled": str(cfg_get(sec, "enabled", "true")).lower()=="true",
                "host": cfg_get(sec, "mqtt_broker", "localhost"),
                "port": cfg_getint(sec, "mqtt_port", 1883),
                "user": cfg_get(sec, "mqtt_user", ""),
                "pass": cfg_get(sec, "mqtt_pass", ""),
                "tls": str(cfg_get(sec, "mqtt_tls", "false")).lower()=="true",
                "ca_file": cfg_get(sec, "mqtt_ca_file", ""),
                "client_id": cfg_get(sec, "mqtt_client_id", ""),
                "keepalive": cfg_getint(sec, "mqtt_keepalive", 60),
                "qos": cfg_getint(sec, "mqtt_qos", 0),
                "topic": cfg_get(sec, "topic_events", "frigate/events"),
            })
    if not servers:
        # Fallback to legacy single-broker config
        servers=[{
            "id": "default",
            "enabled": True,
            "host": cfg_get("mqtt","host","localhost"),
            "port": cfg_getint("mqtt","port",1883),
            "user": cfg_get("mqtt","user",""),
            "pass": cfg_get("mqtt","pass",""),
            "tls": False,
            "ca_file": "",
            "client_id": "",
            "keepalive": 60,
            "qos": cfg_getint("mqtt","qos",0),
            "topic": cfg_get("mqtt","topic","frigate/events"),
        }]
    return servers
CONFIGURED_CAMERAS, CAMERA_MAP = _parse_cameras()
COUNTERS = _parse_counters()
PUBLISH_CONFIG = _parse_publish_config()
SERVERS=_parse_servers()

LOG_DIR=os.getenv("LOG_DIR","/app/LOG")
os.makedirs(LOG_DIR, exist_ok=True)

# Logging
logging.basicConfig(level=logging.INFO)
app_log = logging.getLogger("conteo")
fh = logging.FileHandler(os.path.join(LOG_DIR,"conteo.log"))
fh.setFormatter(logging.Formatter(fmt='%(asctime)s %(levelname)s %(message)s'))
app_log.addHandler(fh)

stats_logger = logging.getLogger("stats")
sfh = logging.FileHandler(os.path.join(LOG_DIR,"stats.log"), mode='w')  # Write mode to overwrite file
# Write pure JSON lines with no prefix
sfh.setFormatter(logging.Formatter(fmt='%(message)s'))
stats_logger.addHandler(sfh)
stats_logger.propagate = False

START_TIME = time.time()
EVENTS_PROCESSED = 0
LAST_EVENT_TS: float | None = None
SERVERS_STATE: dict[str, dict] = {}
PROCESSED_EVENT_IDS: set = set()  # Dedup: track processed event IDs
LABEL_COUNTS: dict[str, int] = {}  # Track count per label (auto, moto, personas, etc.)
CAMERA_ZONE_COUNTS: dict[str, dict[str, int]] = {}  # Track IN/OUT per camera

# Zone crossing tracking: prevents counting same object in same zone within time window
ZONE_CROSSINGS: dict[str, float] = {}  # key: "object_id_camera_zone_direction", value: timestamp
ANTI_REPEAT_SECONDS = cfg_getint("anti_noise", "max_recount_ms", 1500) / 1000.0  # Convert ms to seconds

# Counter state tracking
COUNTER_TOTALS: dict[str, dict] = {}  # counter_id -> {in, out, occupancy}
for cid in COUNTERS:
    COUNTER_TOTALS[cid] = {"in": 0, "out": 0, "occupancy": COUNTERS[cid]["initial_occupancy"]}

# MQTT publishing clients (for outgoing count events)
PUBLISH_CLIENTS: dict[str, mqtt.Client] = {}  # server_id -> mqtt.Client

_labels_map_str = cfg_get("objects","labels_map","")
EN_TO_ES={}
if _labels_map_str:
    for pair in _labels_map_str.split(","):
        pair=pair.strip()
        if not pair or ":" not in pair: continue
        src,dst = pair.split(":",1)
        src=src.strip(); dst=dst.strip()
        if src and dst:
            EN_TO_ES[src]=dst
if not EN_TO_ES:
    EN_TO_ES={"car":"auto","motorcycle":"moto","bicycle":"bicicleta","bus":"autobús","person":"personas"}
ES_VALID=set(EN_TO_ES.get(x, x) for x in OBJECTS)

engine: Engine = create_engine(DB_URL, pool_pre_ping=True, future=True)

def db_init():
    with engine.begin() as conn:
        conn.exec_driver_sql(
            """
        CREATE TABLE IF NOT EXISTS events(
          id TEXT PRIMARY KEY,
          camera TEXT,
          label TEXT,
          start_time TIMESTAMP,
          end_time TIMESTAMP,
          zone TEXT
        );
        """
        )
        conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS idx_events_cam_time ON events(camera, end_time);")
        conn.exec_driver_sql(
            """
        CREATE TABLE IF NOT EXISTS settings(
          camera TEXT PRIMARY KEY,
          active_labels TEXT NOT NULL
        );
        """
        )
        key = "ALL" if MODE=="multi" else CAMERA
        cur = conn.execute(text("SELECT 1 FROM settings WHERE camera=:c"), {"c": key}).first()
        if not cur:
            conn.execute(text("INSERT INTO settings(camera, active_labels) VALUES (:c, :a)"),
                         {"c": key, "a": json.dumps(list(ES_VALID))})
db_init()

def get_key(): return "ALL" if MODE=="multi" else CAMERA

def get_active_labels():
    with engine.begin() as conn:
        row = conn.execute(text("SELECT active_labels FROM settings WHERE camera=:c"), {"c": get_key()}).first()
        return set(json.loads(row[0])) if row and row[0] else set(ES_VALID)

def set_active_labels(labels):
    with engine.begin() as conn:
        conn.execute(text("UPDATE settings SET active_labels=:a WHERE camera=:c"),
                     {"a": json.dumps(sorted(set(labels))), "c": get_key()})

def keep_retention():
    if RETENTION_DAYS<=0: return
    while True:
        limit = datetime.utcnow() - timedelta(days=RETENTION_DAYS)
        with engine.begin() as conn:
            conn.execute(text("DELETE FROM events WHERE end_time < :limit"), {"limit": limit})
        time.sleep(3600)

def stats_loop():
    proc = psutil.Process(os.getpid())
    stats_file = os.path.join(LOG_DIR, "stats.log")
    while True:
        try:
            cpu = psutil.cpu_percent(interval=1)
            mem_mb = proc.memory_info().rss / (1024*1024)
            ts_iso = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
            uptime = int(time.time() - START_TIME)
            payload = {
                "timestamp": ts_iso,
                "uptime_seconds": uptime,
                "cpu_percent": cpu,
                "memory": round(mem_mb, 1),
                "memory_mb": round(mem_mb, 1),
                "running": True,
                "status": "running",
                "events_processed": int(EVENTS_PROCESSED),
                "last_event": datetime.utcfromtimestamp(LAST_EVENT_TS).strftime('%Y-%m-%dT%H:%M:%SZ') if LAST_EVENT_TS else None,
            }
            # Write only the latest stats (overwrite file)
            with open(stats_file, 'w', encoding='utf-8') as f:
                f.write(json.dumps(payload) + '\n')
        except Exception as e:
            app_log.error(f"stats error: {e}")
        time.sleep(9)

def _parse_topic_list(raw:str|None):
    if not raw:
        return []
    parts = [p.strip().strip('"').strip("'") for p in raw.split(",")]
    return [p for p in parts if p]

def _make_client(srv:dict):
    client=mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=(srv.get("client_id") or None))
    if srv.get("user"):
        client.username_pw_set(srv.get("user"), srv.get("pass"))
    if srv.get("tls"):
        try:
            client.tls_set(ca_certs=(srv.get("ca_file") or None))
        except Exception as e:
            app_log.error(f"[{srv.get('id')}] TLS config error: {e}")
    def _on_connect(client, userdata, flags, reason_code, properties=None):
        topics = _parse_topic_list(srv.get("topic","frigate/events")) or ["frigate/events"]
        ok_any = False
        for t in topics:
            try:
                client.subscribe(t, qos=int(srv.get("qos",0)))
                app_log.info(f"[{srv.get('id')}] connected {srv.get('host')}:{srv.get('port')} topic={t} OK")
                ok_any = True
            except Exception as e:
                app_log.error(f"[{srv.get('id')}] subscribe error for topic='{t}': {e}")
        try:
            sid=srv.get('id');
            st=SERVERS_STATE.setdefault(sid,{})
            st.update({"enabled": srv.get("enabled",True), "connected": True, "host": srv.get("host"), "port": srv.get("port"), "topic": ",".join(topics)})
        except Exception:
            pass
    client.on_connect=_on_connect
    def _on_disconnect(client, userdata, rc, properties=None):
        try:
            sid=srv.get('id'); st=SERVERS_STATE.setdefault(sid,{})
            st.update({"connected": False, "last_error": f"disconnect rc={rc}"})
            app_log.warning(f"[{sid}] disconnected rc={rc}")
        except Exception:
            pass
    client.on_disconnect=_on_disconnect
    client.on_message=on_message
    return client

def on_message(client, userdata, msg):
    try:
        payload=json.loads(msg.payload.decode("utf-8","ignore"))
        ev_type=payload.get("type")
        after=payload.get("after") or {}
        cam=after.get("camera") or payload.get("camera")
        label_en=after.get("label") or payload.get("label")
        
        # Filter 1: Only process cameras defined in config
        if cam not in CONFIGURED_CAMERAS:
            return
        
        if not cam or not label_en: return
        if MODE=="single" and cam!=CAMERA: return
        if MODE=="multi" and CAMERA_LIST and cam not in CAMERA_LIST: return
        label=EN_TO_ES.get(label_en)
        if not label: return
        if label not in get_active_labels(): return
        
        # Get object tracking ID (Frigate assigns unique IDs to tracked objects)
        object_id = after.get("id") or payload.get("id")
        if not object_id:
            return  # Can't track without ID
        
        # Only process 'update' and 'end' events for zone crossing detection
        # 'new' events don't have zone info yet
        if ev_type not in ("update", "end"):
            return
        
        end_ts = after.get("end_time") or payload.get("end_time") or time.time()
        start_ts = after.get("start_time") or payload.get("start_time") or end_ts
        
        # Get entered_zones from Frigate (zones the object has entered)
        entered_zones = after.get("entered_zones")
        if not entered_zones or not isinstance(entered_zones, list):
            return  # No zone crossing, skip
        
        # Find applicable counters for this camera
        applicable_counters = []
        for counter_id, counter_cfg in COUNTERS.items():
            if counter_cfg["type"] == "zones":
                # Check if this camera matches the counter's source_camera
                source_alias = counter_cfg["source_camera"]
                if source_alias in CAMERA_MAP:
                    if CAMERA_MAP[source_alias]["frigate_camera"] == cam:
                        # Check if object type is allowed
                        if not counter_cfg["objects"] or label in counter_cfg["objects"]:
                            applicable_counters.append(counter_id)
        
        if not applicable_counters:
            return  # No counters configured for this camera/object, skip
        
        # Process each zone crossing
        global ZONE_CROSSINGS, EVENTS_PROCESSED, LAST_EVENT_TS, LABEL_COUNTS, CAMERA_ZONE_COUNTS, COUNTER_TOTALS
        
        for zone in entered_zones:
            zone_upper = zone.upper()
            
            # Determine direction based on zone name
            if "IN" in zone_upper:
                direction = "IN"
            elif "OUT" in zone_upper:
                direction = "OUT"
            else:
                continue  # Skip zones that aren't IN or OUT
            
            # Create unique key for this crossing
            crossing_key = f"{object_id}_{cam}_{zone}_{direction}"
            
            # Check if we already counted this crossing recently (anti-repeat)
            last_crossing_ts = ZONE_CROSSINGS.get(crossing_key, 0)
            if end_ts - last_crossing_ts < ANTI_REPEAT_SECONDS:
                continue  # Too soon, skip (duplicate)
            
            # Record this crossing
            ZONE_CROSSINGS[crossing_key] = end_ts
            
            # Clean up old crossings (keep only last 1 hour)
            if len(ZONE_CROSSINGS) > 10000:
                cutoff = end_ts - 3600
                ZONE_CROSSINGS = {k: v for k, v in ZONE_CROSSINGS.items() if v > cutoff}
            
            # Generate event ID for database
            eid = f"{object_id}_{cam}_{zone}_{int(end_ts*1000)}"
            
            # Log the crossing with counter info
            counter_names = ",".join(applicable_counters)
            app_log.info(f"✅ COUNT [{cam}] {label} ({label_en}) {direction} zone={zone} counters=[{counter_names}] id={object_id[:8]}...")
            
            # Store in database
            with engine.begin() as conn:
                conn.execute(
                    text("""
                        INSERT OR IGNORE INTO events(id,camera,label,start_time,end_time,zone)
                        VALUES (:id,:cam,:label,:start,:end,:zone)
                    """),
                    {"id": eid, "cam": cam, "label": label,
                     "start": datetime.utcfromtimestamp(start_ts),
                     "end": datetime.utcfromtimestamp(end_ts),
                     "zone": zone}
                )
            
            # Update stats counters
            try:
                EVENTS_PROCESSED += 1
                LAST_EVENT_TS = float(end_ts)
                
                # Increment label counter
                LABEL_COUNTS[label] = LABEL_COUNTS.get(label, 0) + 1
                
                # Track IN/OUT per camera
                if cam not in CAMERA_ZONE_COUNTS:
                    CAMERA_ZONE_COUNTS[cam] = {"IN": 0, "OUT": 0}
                CAMERA_ZONE_COUNTS[cam][direction] = CAMERA_ZONE_COUNTS[cam].get(direction, 0) + 1
                
                # Update counter totals and publish to MQTT
                for counter_id in applicable_counters:
                    if direction == "IN":
                        COUNTER_TOTALS[counter_id]["in"] += 1
                        COUNTER_TOTALS[counter_id]["occupancy"] += 1
                    elif direction == "OUT":
                        COUNTER_TOTALS[counter_id]["out"] += 1
                        COUNTER_TOTALS[counter_id]["occupancy"] -= 1
                    
                    # Publish count event to MQTT
                    publish_count_event(counter_id, direction, COUNTER_TOTALS[counter_id])
            except Exception as e:
                app_log.error(f"Error updating counters: {e}")
                
    except Exception as e:
        app_log.error(f"mqtt parse error: {e}")

def _setup_publish_client(srv: dict) -> mqtt.Client:
    """Setup MQTT client for publishing count events"""
    client_id = f"conteo-publish-{srv.get('id', 'default')}"
    client = mqtt.Client(client_id=client_id, protocol=mqtt.MQTTv311)
    
    if srv.get("user"):
        client.username_pw_set(srv.get("user"), srv.get("pass", ""))
    
    if srv.get("tls"):
        ca_file = srv.get("ca_file")
        if ca_file and os.path.isfile(ca_file):
            client.tls_set(ca_certs=ca_file)
    
    try:
        client.connect(srv.get("host", "localhost"), int(srv.get("port", 1883)), int(srv.get("keepalive", 60)))
        client.loop_start()
        app_log.info(f"📤 Publish client connected to [{srv.get('id')}] {srv.get('host')}:{srv.get('port')}")
    except Exception as e:
        app_log.error(f"📤 Failed to connect publish client to [{srv.get('id')}]: {e}")
    
    return client

def publish_count_event(counter_id: str, direction: str, totals: dict):
    """Publish count event to MQTT"""
    if not PUBLISH_CONFIG["mqtt"]["enabled"]:
        return
    
    # Validate counter_id
    if not counter_id or not isinstance(counter_id, str) or counter_id.strip() == "":
        app_log.error(f"📤 Invalid counter_id for publishing: {counter_id}")
        return
    
    # Find the server to publish to
    target_server = PUBLISH_CONFIG["mqtt"]["server"]
    if not target_server:
        # If no server specified, use first available
        if SERVERS:
            target_server = SERVERS[0]["id"]
        else:
            return
    
    # Get or create publish client
    if target_server not in PUBLISH_CLIENTS:
        # Find server config
        srv_cfg = None
        for srv in SERVERS:
            if srv["id"] == target_server:
                srv_cfg = srv
                break
        if not srv_cfg:
            return
        PUBLISH_CLIENTS[target_server] = _setup_publish_client(srv_cfg)
    
    client = PUBLISH_CLIENTS[target_server]
    topic_prefix = PUBLISH_CONFIG["mqtt"]["topic_prefix"]
    qos = PUBLISH_CONFIG["mqtt"]["qos"]
    retain = PUBLISH_CONFIG["mqtt"]["retain"]
    
    # Get counter config to check publish_delta_only
    counter_cfg = COUNTERS.get(counter_id, {})
    publish_delta_only = counter_cfg.get("publish_delta_only", False)
    
    try:
        # Publish delta event
        if publish_delta_only:
            delta_topic = f"{topic_prefix}/{counter_id}/delta"
            # Validate topic doesn't contain wildcards
            if '+' in delta_topic or '#' in delta_topic:
                app_log.error(f"📤 Invalid topic (contains wildcards): {delta_topic}")
                return
            delta_payload = {direction.lower(): 1}
            client.publish(delta_topic, json.dumps(delta_payload), qos=qos, retain=retain)
            app_log.debug(f"📤 Published delta to {delta_topic}: {delta_payload}")
        
        # Always publish totals
        totals_topic = f"{topic_prefix}/{counter_id}/totals"
        # Validate topic doesn't contain wildcards
        if '+' in totals_topic or '#' in totals_topic:
            app_log.error(f"📤 Invalid topic (contains wildcards): {totals_topic}")
            return
        totals_payload = {
            "in": totals["in"],
            "out": totals["out"],
            "occupancy": totals["occupancy"],
            "ts": datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
        }
        client.publish(totals_topic, json.dumps(totals_payload), qos=qos, retain=retain)
        app_log.debug(f"📤 Published totals to {totals_topic}: {totals_payload}")
        
    except Exception as e:
        app_log.error(f"📤 Error publishing to MQTT: {e}. Topic_prefix={topic_prefix}, counter_id={counter_id}")

def mqtt_loop(srv:dict):
    client=_make_client(srv)
    while True:
        try:
            client.connect(srv.get("host","localhost"), int(srv.get("port",1883)), int(srv.get("keepalive",60)))
            client.loop_forever()
        except Exception as e:
            try:
                sid=srv.get('id'); st=SERVERS_STATE.setdefault(sid,{})
                st.update({"connected": False, "last_error": str(e)})
            except Exception:
                pass
            app_log.error(f"[{srv.get('id')}] mqtt reconnect in 5s: {e}"); time.sleep(5)

def status_loop():
    while True:
        try:
            lines=[
                "\n" + "="*50,
                "📊 APP STATUS",
                "="*50,
                f"🔧 Mode: {MODE}    💾 DB: {DB_URL.split('/')[-1]}",
                "",
                "🌐 SERVERS",
                "-"*50,
            ]
            for sid,st in sorted(SERVERS_STATE.items()):
                enabled = st.get("enabled", True)
                connected = st.get("connected", False)
                host = st.get("host")
                port = st.get("port")
                topic = st.get("topic")
                last_err = st.get("last_error")
                status_icon = "✅" if connected else "❌"
                lines.append(f"{status_icon} [{sid}] {host}:{port}")
                if not connected and last_err:
                    lines.append(f"   ⚠️  {last_err}")
            
            lines.append("")
            lines.append("📹 CAMERAS (IN/OUT)")
            lines.append("-"*50)
            if CAMERA_ZONE_COUNTS:
                for cam in sorted(CAMERA_ZONE_COUNTS.keys()):
                    counts = CAMERA_ZONE_COUNTS[cam]
                    in_count = counts.get("IN", 0)
                    out_count = counts.get("OUT", 0)
                    balance = in_count - out_count
                    balance_str = f"(balance: {balance:+d})" if balance != 0 else "(balanced)"
                    lines.append(f"  🎥 {cam}")
                    lines.append(f"     ⬇️  IN:  {in_count:3d}   ⬆️  OUT: {out_count:3d}   {balance_str}")
            else:
                lines.append("  (no data yet)")
            
            total = int(EVENTS_PROCESSED)
            last_ev = datetime.utcfromtimestamp(LAST_EVENT_TS).strftime('%Y-%m-%dT%H:%M:%SZ') if LAST_EVENT_TS else "-"
            # Add counters section
            lines.append("")
            lines.append("🎯 COUNTERS")
            lines.append("-"*50)
            if COUNTER_TOTALS:
                for counter_id in sorted(COUNTER_TOTALS.keys()):
                    totals = COUNTER_TOTALS[counter_id]
                    in_count = totals.get("in", 0)
                    out_count = totals.get("out", 0)
                    occupancy = totals.get("occupancy", 0)
                    lines.append(f"  📍 {counter_id}")
                    lines.append(f"     ⬇️  IN: {in_count:3d}   ⬆️  OUT: {out_count:3d}   👤 Occupancy: {occupancy:3d}")
            else:
                lines.append("  (no counters configured)")
            
            lines.append("")
            lines.append("📈 OBJECTS DETECTED")
            lines.append("-"*50)
            if LABEL_COUNTS:
                # Map labels to emojis
                emoji_map = {
                    "auto": "🚗",
                    "moto": "🏍️",
                    "personas": "👥",
                    "bicicleta": "🚴",
                    "autobús": "🚌",
                    "bus": "🚌",
                }
                for lbl in sorted(LABEL_COUNTS.keys()):
                    emoji = emoji_map.get(lbl, "📦")
                    lines.append(f"  {emoji} {lbl}: {LABEL_COUNTS[lbl]}")
            else:
                lines.append("  (no objects detected yet)")
            
            lines.append("")
            lines.append(f"📊 Total events: {total}   🕐 Last: {last_ev}")
            lines.append("="*50)
            app_log.info("\n".join(lines))
        except Exception as e:
            app_log.error(f"status_loop error: {e}")
        time.sleep(60)

for _srv in SERVERS:
    if _srv.get("enabled", True):
        threading.Thread(target=mqtt_loop, args=(_srv,), daemon=True).start()
threading.Thread(target=keep_retention, daemon=True).start()
threading.Thread(target=stats_loop, daemon=True).start()
threading.Thread(target=status_loop, daemon=True).start()

app=FastAPI(title=f"Contador - {TITLE}")

@app.get("/api/info")
def api_info():
    return {"mode": ("multi" if MODE=="multi" else "single"), "title": TITLE, "cameras": CAMERA_LIST}

@app.get("/api/state")
def api_state():
    return {"camera": TITLE, "activos": sorted(get_active_labels()), "objetos": sorted(ES_VALID)}

@app.post("/api/toggle")
def api_toggle(payload=Body(...)):
    label=(payload or {}).get("label")
    if not label: return JSONResponse({"error":"label requerido"},status_code=400)
    act=get_active_labels()
    if label in act: act.remove(label)
    else: act.add(label)
    set_active_labels(act)
    return {"activos": sorted(act)}

def _range(view:str, day:date):
    if view=="day":
        start=datetime.combine(day, datetime.min.time()); end=start+timedelta(days=1)
        labels=[f"{h:02d}" for h in range(24)]
        return start,end,labels
    if view=="week":
        monday=day-timedelta(days=day.weekday()); start=datetime.combine(monday, datetime.min.time()); end=start+timedelta(days=7)
        labels=[(monday+timedelta(days=i)).strftime("%Y-%m-%d") for i in range(7)]
        return start,end,labels
    if view=="month":
        first=day.replace(day=1); nextm=(first.replace(day=28)+timedelta(days=4)).replace(day=1)
        start=datetime.combine(first, datetime.min.time()); end=datetime.combine(nextm, datetime.min.time())
        labels=[(first+timedelta(days=i)).strftime("%Y-%m-%d") for i in range((nextm-first).days)]
        return start,end,labels
    return _range("day",day)

def _camera_clause(camera_param:str|None):
    if MODE=="single":
        return "camera=:cam", {"cam": CAMERA}
    if camera_param and camera_param!="ALL":
        return "camera=:cam", {"cam": camera_param}
    else:
        if not CAMERA_LIST:
            return "1=1", {}
        placeholders = ",".join([f":cam{i}" for i,_ in enumerate(CAMERA_LIST)])
        params = {f"cam{i}": c for i,c in enumerate(CAMERA_LIST)}
        return f"camera IN ({placeholders})", params

@app.get("/api/summary")
def api_summary(view:str="day", date:str=datetime.utcnow().date().isoformat(), camera: str|None = Query(default=None)):
    try: day=datetime.strptime(date,"%Y-%m-%d").date()
    except Exception: day=datetime.utcnow().date()
    start,end,labels=_range(view, day)
    act=set(get_active_labels())
    cam_sql, cam_params = _camera_clause(camera)

    with engine.begin() as conn:
        rows = conn.execute(text(f"""
            SELECT label, COUNT(*) cnt
            FROM events
            WHERE {cam_sql} AND end_time>=:start AND end_time<:end
            GROUP BY label ORDER BY label;
        """), {**cam_params, "start": start, "end": end}).mappings().all()
        totals=[r for r in rows if r["label"] in act]

        rows_h = conn.execute(text(f"""
            SELECT CAST(strftime('%H', end_time) AS INTEGER) AS h, label, COUNT(*) cnt
            FROM events
            WHERE {cam_sql} AND end_time>=:start AND end_time<:end
            GROUP BY h,label ORDER BY h,label;
        """), {**cam_params, "start": start, "end": end}).mappings().all()
        rows_h=[{"h":int(r["h"]), "label":r["label"], "cnt":int(r["cnt"])} for r in rows_h if r["label"] in act]
        by_hour={"labels":[f"{h:02d}" for h in range(24)],
                 "rows":[{"idx":r["h"], "label":r["label"], "cnt":r["cnt"]} for r in rows_h]}

        rows_b = conn.execute(text(f"""
            SELECT DATE(end_time) AS d, label, COUNT(*) cnt
            FROM events
            WHERE {cam_sql} AND end_time>=:start AND end_time<:end
            GROUP BY d,label ORDER BY d,label;
        """), {**cam_params, "start": start, "end": end}).mappings().all()
        lbls = [start.date().isoformat()] if view=="day" else labels
        map_idx = {v:i for i,v in enumerate(lbls)}
        rows_bucket=[{"idx":map_idx.get(r["d"],0),"label":r["label"],"cnt":int(r["cnt"])}
                     for r in rows_b if r["label"] in act and r["d"] in map_idx]

    return {"totals": totals, "by_hour": by_hour, "by_bucket": {"labels": lbls, "rows": rows_bucket}}

# ============================
#  NEW API ENDPOINTS (Technical Document)
# ============================

@app.get("/api/events")
def api_events(
    camera: str | None = Query(default=None),
    zone: str | None = Query(default=None),
    label: str | None = Query(default=None),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    limit: int = Query(default=100, le=1000)
):
    """
    Query events with filters
    Example: /api/events?camera=Escuela&zone=IN&label=auto&limit=50
    """
    try:
        # Build WHERE clause
        conditions = []
        params = {}
        
        if camera:
            conditions.append("camera = :camera")
            params["camera"] = camera
        
        if zone:
            conditions.append("zone LIKE :zone")
            params["zone"] = f"%{zone}%"
        
        if label:
            conditions.append("label = :label")
            params["label"] = label
        
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
                conditions.append("end_time >= :start")
                params["start"] = start_dt
            except Exception:
                pass
        
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
                conditions.append("end_time < :end")
                params["end"] = end_dt
            except Exception:
                pass
        
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        
        with engine.begin() as conn:
            rows = conn.execute(text(f"""
                SELECT id, camera, label, start_time, end_time, zone
                FROM events
                WHERE {where_clause}
                ORDER BY end_time DESC
                LIMIT :limit
            """), {**params, "limit": limit}).mappings().all()
            
            events = [{
                "id": r["id"],
                "camera": r["camera"],
                "label": r["label"],
                "start_time": r["start_time"].isoformat() if r["start_time"] and isinstance(r["start_time"], datetime) else (r["start_time"] if isinstance(r["start_time"], str) else None),
                "end_time": r["end_time"].isoformat() if r["end_time"] and isinstance(r["end_time"], datetime) else (r["end_time"] if isinstance(r["end_time"], str) else None),
                "zone": r["zone"]
            } for r in rows]
        
        return {"events": events, "count": len(events)}
    
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/counters")
def api_counters():
    """
    Get all configured counters with their current totals
    Example: /api/counters
    """
    try:
        counters_data = []
        for counter_id, totals in COUNTER_TOTALS.items():
            counter_cfg = COUNTERS.get(counter_id, {})
            counters_data.append({
                "id": counter_id,
                "type": counter_cfg.get("type", "zones"),
                "source_camera": counter_cfg.get("source_camera", ""),
                "objects": counter_cfg.get("objects", []),
                "totals": {
                    "in": totals["in"],
                    "out": totals["out"],
                    "occupancy": totals["occupancy"]
                },
                "config": {
                    "zone_strategy": counter_cfg.get("zone_strategy", "entered"),
                    "initial_occupancy": counter_cfg.get("initial_occupancy", 0),
                    "reset_schedule": counter_cfg.get("reset_schedule", "")
                }
            })
        
        return {"counters": counters_data, "count": len(counters_data)}
    
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/counters/{counter_id}")
def api_counter_detail(counter_id: str):
    """
    Get detailed information for a specific counter
    Example: /api/counters/escuela
    """
    try:
        if counter_id not in COUNTER_TOTALS:
            return JSONResponse({"error": "Counter not found"}, status_code=404)
        
        totals = COUNTER_TOTALS[counter_id]
        counter_cfg = COUNTERS.get(counter_id, {})
        
        return {
            "id": counter_id,
            "type": counter_cfg.get("type", "zones"),
            "source_camera": counter_cfg.get("source_camera", ""),
            "objects": counter_cfg.get("objects", []),
            "totals": {
                "in": totals["in"],
                "out": totals["out"],
                "occupancy": totals["occupancy"]
            },
            "config": {
                "zone_strategy": counter_cfg.get("zone_strategy", "entered"),
                "min_frames_in_zone": counter_cfg.get("min_frames_in_zone", 1),
                "initial_occupancy": counter_cfg.get("initial_occupancy", 0),
                "reset_schedule": counter_cfg.get("reset_schedule", ""),
                "publish_delta_only": counter_cfg.get("publish_delta_only", False)
            }
        }
    
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/counters/{counter_id}/history")
def api_counter_history(
    counter_id: str,
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    group_by: str = Query(default="hour")  # hour, day
):
    """
    Get historical count data for a counter
    Example: /api/counters/escuela/history?start_date=2025-10-20&group_by=hour
    """
    try:
        if counter_id not in COUNTERS:
            return JSONResponse({"error": "Counter not found"}, status_code=404)
        
        counter_cfg = COUNTERS[counter_id]
        source_camera_alias = counter_cfg.get("source_camera", "")
        
        if source_camera_alias not in CAMERA_MAP:
            return JSONResponse({"error": "Camera not found for counter"}, status_code=404)
        
        frigate_camera = CAMERA_MAP[source_camera_alias]["frigate_camera"]
        
        # Date range
        if start_date:
            try:
                start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            except Exception:
                start_dt = datetime.utcnow() - timedelta(days=1)
        else:
            start_dt = datetime.utcnow() - timedelta(days=1)
        
        if end_date:
            try:
                end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            except Exception:
                end_dt = datetime.utcnow()
        else:
            end_dt = datetime.utcnow()
        
        # Group by clause
        if group_by == "hour":
            time_format = "%Y-%m-%d %H:00:00"
            group_clause = "strftime('%Y-%m-%d %H:00:00', end_time)"
        else:  # day
            time_format = "%Y-%m-%d"
            group_clause = "DATE(end_time)"
        
        with engine.begin() as conn:
            rows = conn.execute(text(f"""
                SELECT 
                    {group_clause} AS time_bucket,
                    zone,
                    COUNT(*) as count
                FROM events
                WHERE camera = :camera
                  AND end_time >= :start
                  AND end_time < :end
                  AND zone IS NOT NULL
                GROUP BY time_bucket, zone
                ORDER BY time_bucket
            """), {"camera": frigate_camera, "start": start_dt, "end": end_dt}).mappings().all()
            
            # Organize data
            history = {}
            for r in rows:
                time_bucket = r["time_bucket"]
                zone = r["zone"] or ""
                count = r["count"]
                
                if time_bucket not in history:
                    history[time_bucket] = {"in": 0, "out": 0}
                
                if "IN" in zone.upper():
                    history[time_bucket]["in"] += count
                elif "OUT" in zone.upper():
                    history[time_bucket]["out"] += count
            
            # Convert to list
            history_list = [
                {
                    "timestamp": ts,
                    "in": data["in"],
                    "out": data["out"],
                    "occupancy_change": data["in"] - data["out"]
                }
                for ts, data in sorted(history.items())
            ]
        
        return {
            "counter_id": counter_id,
            "camera": frigate_camera,
            "start_date": start_dt.isoformat(),
            "end_date": end_dt.isoformat(),
            "group_by": group_by,
            "history": history_list
        }
    
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

@app.get("/api/cameras")
def api_cameras():
    """
    Get list of configured cameras
    Example: /api/cameras
    """
    try:
        cameras_data = []
        for alias, cam_cfg in CAMERA_MAP.items():
            # Get stats for this camera
            frigate_camera = cam_cfg["frigate_camera"]
            zone_counts = CAMERA_ZONE_COUNTS.get(frigate_camera, {"IN": 0, "OUT": 0})
            
            cameras_data.append({
                "alias": alias,
                "frigate_camera": frigate_camera,
                "server": cam_cfg.get("server", ""),
                "mode": cam_cfg.get("mode", "zones"),
                "zone_in": cam_cfg.get("zone_in", "IN"),
                "zone_out": cam_cfg.get("zone_out", "OUT"),
                "totals": {
                    "in": zone_counts.get("IN", 0),
                    "out": zone_counts.get("OUT", 0),
                    "balance": zone_counts.get("IN", 0) - zone_counts.get("OUT", 0)
                }
            })
        
        return {"cameras": cameras_data, "count": len(cameras_data)}
    
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
