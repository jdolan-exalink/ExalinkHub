from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time
import json
import os
from typing import List, Optional, Dict, Any

app = FastAPI(title="Conteo Backend", version="0.1.0")

# Configurar CORS para permitir conexiones desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar los orígenes permitidos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

start_time = time.time()

# Estado global del backend
events_processed = 0
active_cameras = []
active_objects = []

# Archivo de configuración
CONFIG_FILE = "config/counting_config.json"

# Asegurar que existe el directorio de configuración
os.makedirs("config", exist_ok=True)

# Modelos Pydantic para configuración
class CountingConfig(BaseModel):
    enabled: bool = False
    operation_mode: str = "zones"  # "two_cameras" o "zones"
    title: str = "Sistema de Conteo"
    camera_in: Optional[str] = None
    camera_out: Optional[str] = None
    camera_zones: Optional[str] = None
    zone_in: Optional[str] = None
    zone_out: Optional[str] = None
    objects: List[str] = []
    retention_days: int = 30
    confidence_threshold: float = 0.7
    notifications_enabled: bool = False
    notification_email: Optional[str] = None
    config_json: str = "{}"

class CountingPreferences(BaseModel):
    theme: str = "light"
    language: str = "es"
    auto_refresh: bool = True
    refresh_interval: int = 30
    show_real_time: bool = True
    alert_thresholds: Dict[str, int] = {}
    dashboard_layout: str = "default"

class IncrementRequest(BaseModel):
    amount: int = 1

# Funciones de utilidad para configuración
def load_config() -> CountingConfig:
    """Carga la configuración desde archivo"""
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return CountingConfig(**data)
    except Exception as e:
        print(f"Error loading config: {e}")

    # Retornar configuración por defecto
    return CountingConfig()

def save_config(config: CountingConfig) -> bool:
    """Guarda la configuración en archivo"""
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config.dict(), f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving config: {e}")
        return False

def load_preferences() -> CountingPreferences:
    """Carga las preferencias desde archivo"""
    prefs_file = "config/counting_preferences.json"
    try:
        if os.path.exists(prefs_file):
            with open(prefs_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return CountingPreferences(**data)
    except Exception as e:
        print(f"Error loading preferences: {e}")

    # Retornar preferencias por defecto
    return CountingPreferences()

def save_preferences(prefs: CountingPreferences) -> bool:
    """Guarda las preferencias en archivo"""
    prefs_file = "config/counting_preferences.json"
    try:
        with open(prefs_file, 'w', encoding='utf-8') as f:
            json.dump(prefs.dict(), f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving preferences: {e}")
        return False

class IncrementRequest(BaseModel):
    amount: int = 1

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/metrics")
def metrics():
    """Obtiene métricas de conteo por objeto"""
    config = load_config()
    uptime = int(time.time() - start_time)

    # Generar métricas simuladas basadas en objetos activos
    # En producción, esto vendría de la base de datos o procesamiento real
    object_metrics = {}
    for obj in config.objects:
        # Simular conteos aleatorios para demostración
        # En producción, consultar la base de datos real
        object_metrics[obj] = {
            "count": 0,  # Por ahora 0, luego conectar con BD real
            "last_seen": None,
            "confidence_avg": 0.0
        }

    return {
        "uptime": uptime,
        "processed_events": events_processed,
        "active_cameras": len(active_cameras) if active_cameras else 1,  # Simular 1 cámara activa
        "active_objects": config.objects,  # Usar objetos de configuración
        "object_metrics": object_metrics,
        "total_count": sum(m["count"] for m in object_metrics.values())
    }

@app.post("/increment")
def increment(req: IncrementRequest):
    global events_processed
    events_processed += req.amount
    return {"processed": events_processed}

# Endpoints de configuración
@app.get("/config", response_model=CountingConfig)
def get_config():
    """Obtiene la configuración actual del sistema de conteo"""
    return load_config()

@app.post("/config")
def update_config(config: CountingConfig):
    """Actualiza la configuración del sistema de conteo"""
    if save_config(config):
        return {"status": "success", "message": "Configuración actualizada"}
    else:
        raise HTTPException(status_code=500, detail="Error al guardar configuración")

@app.get("/preferences", response_model=CountingPreferences)
def get_preferences():
    """Obtiene las preferencias de usuario"""
    return load_preferences()

@app.post("/preferences")
def update_preferences(prefs: CountingPreferences):
    """Actualiza las preferencias de usuario"""
    if save_preferences(prefs):
        return {"status": "success", "message": "Preferencias actualizadas"}
    else:
        raise HTTPException(status_code=500, detail="Error al guardar preferencias")

@app.get("/status")
def get_status():
    """Obtiene el estado completo del sistema de conteo"""
    config = load_config()
    uptime = int(time.time() - start_time)

    return {
        "config": config.dict(),
        "status": {
            "running": config.enabled,
            "uptime": uptime,
            "processed_events": events_processed,
            "active_cameras": len(active_cameras),
            "active_objects": active_objects
        },
        "preferences": load_preferences().dict()
    }
