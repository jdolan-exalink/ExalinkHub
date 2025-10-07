"""
API Principal del sistema de matrículas (LPR)

Implementa la API REST con FastAPI y maneja la suscripción MQTT para
recibir eventos de Frigate en tiempo real.
Todas las funciones usan snake_case siguiendo las convenciones del proyecto.
"""

import os
import json
import asyncio
import hashlib
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Depends, HTTPException, status, BackgroundTasks, Query
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
import paho.mqtt.client as mqtt
import requests
from openpyxl import Workbook
from io import BytesIO

from app.database import get_database_session, init_database, get_database_info, optimize_database
from app.models import PlateEvent, SystemConfig
from app.schemas import (
    PlateEventCreate, PlateEventUpdate, PlateEventResponse, PlateEventListResponse,
    PlateEventFilters, AppConfig, AppConfigResponse, StatsResponse, ExportRequest,
    HealthResponse, TrafficLightStatus, VehicleType
)
import app.crud as crud

# ==================== CONFIGURACIÓN GLOBAL ====================

# Versión del sistema
VERSION = "1.0.0"

# Variable global para la configuración en memoria
app_config = AppConfig()

# Cliente MQTT global
mqtt_client: Optional[mqtt.Client] = None

# Cache en memoria para eventos en progreso de Frigate
frigate_events_cache: Dict[str, Dict[str, Any]] = {}

# Estado de salud del sistema
system_health = {
    "mqtt_connected": False,
    "database_connected": False,
    "frigate_accessible": False,
    "last_event_time": None
}

# Configuración de autenticación HTTP Basic
security = HTTPBasic()

# ==================== GESTIÓN DEL CICLO DE VIDA ====================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gestiona el ciclo de vida de la aplicación
    
    Inicializa la base de datos y el cliente MQTT al arrancar,
    y limpia recursos al cerrar.
    """
    print("🚀 Iniciando sistema LPR...")
    
    # Inicializar base de datos
    try:
        init_database()
        system_health["database_connected"] = True
    except Exception as e:
        print(f"❌ Error al inicializar la base de datos: {str(e)}")
        system_health["database_connected"] = False
    
    # Cargar configuración desde la base de datos
    await load_config_from_database()
    
    # Iniciar cliente MQTT
    start_mqtt_client()
    
    print("✅ Sistema LPR iniciado correctamente")
    
    yield
    
    # Limpiar recursos al cerrar
    print("🔄 Cerrando sistema LPR...")
    
    if mqtt_client and mqtt_client.is_connected():
        mqtt_client.disconnect()
        mqtt_client.loop_stop()
    
    print("✅ Sistema LPR cerrado correctamente")

# ==================== INICIALIZACIÓN DE FASTAPI ====================

app = FastAPI(
    title="ExalinkHub LPR API",
    description="API REST para el sistema de reconocimiento de matrículas integrado con Frigate",
    version=VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configurar CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar dominios específicos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== FUNCIONES DE AUTENTICACIÓN ====================

def verify_credentials(credentials: HTTPBasicCredentials = Depends(security)) -> str:
    """
    Verifica las credenciales de autenticación HTTP Basic
    
    Args:
        credentials: Credenciales HTTP Basic
    
    Returns:
        Nombre de usuario si es válido
    
    Raises:
        HTTPException: Si las credenciales son inválidas
    """
    # Hash de la contraseña proporcionada
    password_hash = hashlib.sha256(credentials.password.encode()).hexdigest()
    
    # Verificar credenciales
    is_correct_username = credentials.username == app_config.auth.username
    is_correct_password = password_hash == app_config.auth.password or credentials.password == app_config.auth.password
    
    if not (is_correct_username and is_correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas",
            headers={"WWW-Authenticate": "Basic"},
        )
    
    return credentials.username

def require_auth(username: str = Depends(verify_credentials)) -> str:
    """
    Dependencia que requiere autenticación para endpoints protegidos
    
    Args:
        username: Nombre de usuario autenticado
    
    Returns:
        Nombre de usuario
    """
    return username

# ==================== FUNCIONES AUXILIARES ====================

async def load_config_from_database():
    """
    Carga la configuración desde la base de datos al iniciar
    """
    try:
        db = next(get_database_session())
        # Cargar configuración existente o crear valores por defecto
        config_data = crud.get_all_config(db)

        if config_data:
            # Actualizar configuración global con datos de la BD
            print("📖 Configuración cargada desde la base de datos")
            # Asignar valores MQTT
            app_config.mqtt.host = config_data.get("mqtt_host", app_config.mqtt.host)
            app_config.mqtt.port = config_data.get("mqtt_port", app_config.mqtt.port)
            app_config.mqtt.username = config_data.get("mqtt_username", app_config.mqtt.username)
            app_config.mqtt.password = config_data.get("mqtt_password", app_config.mqtt.password)
            app_config.mqtt.topic_prefix = config_data.get("mqtt_topic_prefix", app_config.mqtt.topic_prefix)
        else:
            # Guardar configuración por defecto en la BD
            await save_config_to_database()
            print("💾 Configuración por defecto guardada en la base de datos")
            
    except Exception as e:
        print(f"⚠️ Error al cargar configuración: {str(e)}")
        print("📝 Usando configuración por defecto")

async def save_config_to_database():
    """
    Guarda la configuración actual en la base de datos
    """
    try:
        db = next(get_database_session())
        
        # Guardar configuración MQTT
        crud.set_config_value(db, "mqtt_host", app_config.mqtt.host, "string", "Host del broker MQTT")
        crud.set_config_value(db, "mqtt_port", app_config.mqtt.port, "int", "Puerto del broker MQTT")
        crud.set_config_value(db, "mqtt_username", app_config.mqtt.username or "", "string", "Usuario MQTT")
        crud.set_config_value(db, "mqtt_topic_prefix", app_config.mqtt.topic_prefix, "string", "Prefijo de topics MQTT")
        
        # Guardar configuración Frigate
        crud.set_config_value(db, "frigate_host", app_config.frigate.host, "string", "Host de Frigate")
        crud.set_config_value(db, "frigate_port", app_config.frigate.port, "int", "Puerto de Frigate")
        crud.set_config_value(db, "frigate_use_ssl", app_config.frigate.use_ssl, "bool", "Usar HTTPS para Frigate")
        
        # Guardar configuración de autenticación
        crud.set_config_value(db, "auth_enabled", app_config.auth.enabled, "bool", "Autenticación habilitada")
        crud.set_config_value(db, "auth_username", app_config.auth.username, "string", "Usuario de autenticación")
        
        # Guardar configuración general
        crud.set_config_value(db, "retention_days", app_config.retention_days, "int", "Días de retención de eventos")
        crud.set_config_value(db, "max_events_per_camera", app_config.max_events_per_camera, "int", "Máximo eventos por cámara")
        
        print("💾 Configuración guardada en la base de datos")
        
    except Exception as e:
        print(f"❌ Error al guardar configuración: {str(e)}")

def start_mqtt_client():
    """
    Inicia o reinicia el cliente MQTT
    """
    global mqtt_client
    
    try:
        # Detener cliente existente si hay uno
        if mqtt_client:
            mqtt_client.disconnect()
            mqtt_client.loop_stop()
        
        # Crear nuevo cliente
        mqtt_client = mqtt.Client()
        
        # Configurar callbacks
        mqtt_client.on_connect = on_mqtt_connect
        mqtt_client.on_disconnect = on_mqtt_disconnect
        mqtt_client.on_message = on_mqtt_message
        
        # Configurar credenciales si están disponibles
        if app_config.mqtt.username and app_config.mqtt.password:
            mqtt_client.username_pw_set(app_config.mqtt.username, app_config.mqtt.password)
        
        # Conectar al broker
        mqtt_client.connect_async(app_config.mqtt.host, app_config.mqtt.port, 60)
        mqtt_client.loop_start()
        
        print(f"🔄 Intentando conectar a MQTT: {app_config.mqtt.host}:{app_config.mqtt.port}")
        
    except Exception as e:
        print(f"❌ Error al iniciar cliente MQTT: {str(e)}")
        system_health["mqtt_connected"] = False

def on_mqtt_connect(client, userdata, flags, rc):
    """
    Callback cuando se conecta al broker MQTT
    """
    if rc == 0:
        print("✅ Conectado al broker MQTT")
        system_health["mqtt_connected"] = True
        
        # Suscribirse a eventos de Frigate
        topic = f"{app_config.mqtt.topic_prefix}/events"
        client.subscribe(topic)
        print(f"📡 Suscrito a topic: {topic}")
        
    else:
        print(f"❌ Error de conexión MQTT: {rc}")
        system_health["mqtt_connected"] = False

def on_mqtt_disconnect(client, userdata, rc):
    """
    Callback cuando se desconecta del broker MQTT
    """
    print(f"🔌 Desconectado del broker MQTT: {rc}")
    system_health["mqtt_connected"] = False

def on_mqtt_message(client, userdata, msg):
    """
    Callback cuando se recibe un mensaje MQTT
    
    Procesa los eventos de Frigate y los almacena en la base de datos.
    """
    try:
        # Decodificar mensaje
        payload = json.loads(msg.payload.decode())
        
        # Verificar que sea un evento de matrícula
        if payload.get("type") != "new" and payload.get("type") != "update" and payload.get("type") != "end":
            return
        
        # Procesar evento según el tipo
        asyncio.create_task(process_frigate_event(payload))
        
    except Exception as e:
        print(f"❌ Error al procesar mensaje MQTT: {str(e)}")

async def process_frigate_event(event_data: Dict[str, Any]):
    """
    Procesa un evento de Frigate
    
    Args:
        event_data: Datos del evento de Frigate
    """
    try:
        event_type = event_data.get("type")
        after_data = event_data.get("after", {})
        event_id = after_data.get("id")
        
        if not event_id:
            return
        
        # Verificar que sea un evento de matrícula
        if not after_data.get("objects") or "license_plate" not in after_data.get("objects", []):
            return
        
        if event_type in ["new", "update"]:
            # Actualizar cache con datos del evento
            frigate_events_cache[event_id] = after_data
            system_health["last_event_time"] = datetime.utcnow()
            
        elif event_type == "end":
            # Procesar evento finalizado
            if event_id in frigate_events_cache:
                await save_completed_event(event_id, frigate_events_cache[event_id])
                del frigate_events_cache[event_id]
            
    except Exception as e:
        print(f"❌ Error al procesar evento de Frigate: {str(e)}")

async def save_completed_event(event_id: str, event_data: Dict[str, Any]):
    """
    Guarda un evento completado en la base de datos
    
    Args:
        event_id: ID del evento de Frigate
        event_data: Datos del evento
    """
    try:
        db = next(get_database_session())
        
        # Verificar si el evento ya existe
        existing_event = crud.get_plate_event_by_frigate_id(db, event_id)
        if existing_event:
            return
        
        # Extraer información del evento
        camera_name = event_data.get("camera", "unknown")
        start_time = datetime.fromisoformat(event_data.get("start_time", "").replace("Z", "+00:00"))
        end_time = datetime.fromisoformat(event_data.get("end_time", "").replace("Z", "+00:00"))
        
        # Extraer mejor matrícula detectada
        license_plate = extract_best_license_plate(event_data)
        if not license_plate:
            return
        
        # Crear evento para guardar
        plate_event = PlateEventCreate(
            frigate_event_id=event_id,
            camera_name=camera_name,
            license_plate=license_plate,
            start_time=start_time,
            end_time=end_time,
            zone=event_data.get("zones", [None])[0] if event_data.get("zones") else None,
            plate_confidence=extract_plate_confidence(event_data),
            vehicle_type=extract_vehicle_type(event_data),
            top_score=event_data.get("top_score"),
            has_clip=event_data.get("has_clip", False),
            has_snapshot=event_data.get("has_snapshot", False),
            snapshot_url=build_media_url("snapshot", event_id),
            clip_url=build_media_url("clip", event_id) if event_data.get("has_clip") else None,
            traffic_light_status=await detect_traffic_light_status(camera_name, start_time),
            metadata={"frigate_data": event_data}
        )
        
        # Guardar en la base de datos
        saved_event = crud.create_plate_event(db, plate_event)
        print(f"💾 Evento guardado: {license_plate} en {camera_name}")
        
    except Exception as e:
        print(f"❌ Error al guardar evento: {str(e)}")

def extract_best_license_plate(event_data: Dict[str, Any]) -> Optional[str]:
    """
    Extrae la mejor matrícula detectada del evento
    
    Args:
        event_data: Datos del evento de Frigate
    
    Returns:
        Mejor matrícula detectada o None
    """
    # Buscar en current_zones primero
    if "current_zones" in event_data:
        for zone_data in event_data["current_zones"].values():
            if isinstance(zone_data, dict) and "license_plate" in zone_data:
                return zone_data["license_plate"]
    
    # Buscar en data o other_data
    extra_data = event_data.get("data", {})
    if "license_plate" in extra_data:
        return extra_data["license_plate"]
    
    # Buscar en attributes
    attributes = event_data.get("attributes", [])
    for attr in attributes:
        if attr.get("label") == "license_plate":
            return attr.get("value")
    
    return None

def extract_plate_confidence(event_data: Dict[str, Any]) -> Optional[float]:
    """
    Extrae la confianza de la detección de matrícula
    
    Args:
        event_data: Datos del evento de Frigate
    
    Returns:
        Confianza de detección o None
    """
    # Buscar en attributes
    attributes = event_data.get("attributes", [])
    for attr in attributes:
        if attr.get("label") == "license_plate":
            return attr.get("score")
    
    return event_data.get("top_score")

def extract_vehicle_type(event_data: Dict[str, Any]) -> Optional[str]:
    """
    Extrae el tipo de vehículo del evento
    
    Args:
        event_data: Datos del evento de Frigate
    
    Returns:
        Tipo de vehículo o None
    """
    objects = event_data.get("objects", [])
    for obj in objects:
        if obj in ["car", "truck", "motorcycle", "bus", "bicycle"]:
            return obj
    
    return None

def build_media_url(media_type: str, event_id: str) -> str:
    """
    Construye URL para medios de Frigate
    
    Args:
        media_type: Tipo de medio (snapshot, clip)
        event_id: ID del evento
    
    Returns:
        URL completa del medio
    """
    protocol = "https" if app_config.frigate.use_ssl else "http"
    base_url = f"{protocol}://{app_config.frigate.host}:{app_config.frigate.port}"
    
    if media_type == "snapshot":
        return f"{base_url}/api/events/{event_id}/snapshot.jpg"
    elif media_type == "clip":
        return f"{base_url}/api/events/{event_id}/clip.mp4"
    
    return ""

async def detect_traffic_light_status(camera_name: str, timestamp: datetime) -> Optional[str]:
    """
    Detecta el estado del semáforo para una cámara en un momento dado
    
    Args:
        camera_name: Nombre de la cámara
        timestamp: Momento de la detección
    
    Returns:
        Estado del semáforo o None
    """
    # Esta función debería implementar la lógica específica para detectar
    # el estado del semáforo. Por ahora retorna None.
    # Se puede integrar con sistemas de control de tráfico o análisis de imagen.
    return None

# ==================== ENDPOINTS DE LA API ====================

@app.get("/", response_model=Dict[str, str])
async def root():
    """Endpoint raíz con información básica del sistema"""
    return {
        "name": "ExalinkHub LPR API",
        "version": VERSION,
        "status": "running",
        "docs": "/docs"
    }

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Verifica el estado de salud del sistema"""
    # Verificar acceso a Frigate
    try:
        protocol = "https" if app_config.frigate.use_ssl else "http"
        frigate_url = f"{protocol}://{app_config.frigate.host}:{app_config.frigate.port}/api/stats"
        response = requests.get(frigate_url, timeout=5)
        system_health["frigate_accessible"] = response.status_code == 200
    except:
        system_health["frigate_accessible"] = False
    
    # Determinar estado general
    status_value = "healthy"
    if not system_health["database_connected"]:
        status_value = "unhealthy"
    elif not system_health["mqtt_connected"] or not system_health["frigate_accessible"]:
        status_value = "degraded"
    
    return HealthResponse(
        status=status_value,
        mqtt_connected=system_health["mqtt_connected"],
        database_connected=system_health["database_connected"],
        frigate_accessible=system_health["frigate_accessible"],
        last_event_time=system_health["last_event_time"],
        version=VERSION
    )

# ==================== ENDPOINTS DE CONFIGURACIÓN ====================

@app.get("/api/preferences", response_model=AppConfigResponse, dependencies=[Depends(require_auth)])
async def get_preferences():
    """Obtiene la configuración actual del sistema"""
    return app_config

@app.post("/api/preferences", dependencies=[Depends(require_auth)])
async def update_preferences(config: AppConfig):
    """Actualiza la configuración del sistema"""
    global app_config
    
    # Mantener contraseña existente si no se proporciona nueva
    if not config.auth.password:
        config.auth.password = app_config.auth.password
    
    # Convertir nombres de cámaras a minúsculas
    config.cameras = {key.lower(): value for key, value in config.cameras.items()}
    
    # Actualizar configuración global
    app_config = config
    
    # Guardar en base de datos
    await save_config_to_database()
    
    # Reiniciar cliente MQTT para aplicar cambios
    start_mqtt_client()
    
    print("✅ Configuración actualizada desde API y MQTT reiniciado")
    return {"message": "Configuración actualizada correctamente"}

# ==================== ENDPOINTS DE EVENTOS ====================

@app.get("/api/events", response_model=PlateEventListResponse, dependencies=[Depends(require_auth)])
async def get_events(
    page: int = Query(1, ge=1, description="Número de página"),
    limit: int = Query(50, ge=1, le=200, description="Eventos por página"),
    camera_name: Optional[str] = Query(None, description="Filtrar por cámara"),
    license_plate: Optional[str] = Query(None, description="Filtrar por matrícula"),
    start_date: Optional[datetime] = Query(None, description="Fecha de inicio"),
    end_date: Optional[datetime] = Query(None, description="Fecha de fin"),
    traffic_light_status: Optional[TrafficLightStatus] = Query(None, description="Estado del semáforo"),
    vehicle_type: Optional[VehicleType] = Query(None, description="Tipo de vehículo"),
    false_positive: Optional[bool] = Query(None, description="Filtrar falsos positivos"),
    zone: Optional[str] = Query(None, description="Filtrar por zona"),
    min_confidence: Optional[float] = Query(None, ge=0, le=1, description="Confianza mínima"),
    db: Session = Depends(get_database_session)
):
    """Obtiene eventos paginados con filtros opcionales"""
    
    # Crear filtros
    filters = PlateEventFilters(
        camera_name=camera_name,
        license_plate=license_plate,
        start_date=start_date,
        end_date=end_date,
        traffic_light_status=traffic_light_status,
        vehicle_type=vehicle_type,
        false_positive=false_positive,
        zone=zone,
        min_confidence=min_confidence
    )
    
    # Obtener eventos
    events, total = crud.get_plate_events_paginated(db, filters, page, limit)
    
    # Calcular si hay más páginas
    has_next = (page * limit) < total
    
    return PlateEventListResponse(
        events=events,
        total=total,
        page=page,
        limit=limit,
        has_next=has_next
    )

@app.get("/api/events/{event_id}", response_model=PlateEventResponse, dependencies=[Depends(require_auth)])
async def get_event(event_id: int, db: Session = Depends(get_database_session)):
    """Obtiene un evento específico por ID"""
    event = crud.get_plate_event_by_id(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return event

@app.put("/api/events/{event_id}", response_model=PlateEventResponse, dependencies=[Depends(require_auth)])
async def update_event(
    event_id: int,
    event_data: PlateEventUpdate,
    db: Session = Depends(get_database_session)
):
    """Actualiza un evento existente"""
    updated_event = crud.update_plate_event(db, event_id, event_data)
    if not updated_event:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return updated_event

@app.delete("/api/events/{event_id}", dependencies=[Depends(require_auth)])
async def delete_event(event_id: int, db: Session = Depends(get_database_session)):
    """Elimina un evento"""
    success = crud.delete_plate_event(db, event_id)
    if not success:
        raise HTTPException(status_code=404, detail="Evento no encontrado")
    return {"message": "Evento eliminado correctamente"}

@app.get("/api/events/search/{search_term}", response_model=List[PlateEventResponse], dependencies=[Depends(require_auth)])
async def search_events(search_term: str, db: Session = Depends(get_database_session)):
    """Busca eventos por término de búsqueda"""
    events = crud.search_plate_events(db, search_term)
    return events

# ==================== ENDPOINTS DE ESTADÍSTICAS ====================

@app.get("/api/stats", response_model=StatsResponse, dependencies=[Depends(require_auth)])
async def get_stats(db: Session = Depends(get_database_session)):
    """Obtiene estadísticas generales del sistema"""
    stats = crud.get_plate_event_stats(db)
    return StatsResponse(**stats)

@app.get("/api/stats/camera/{camera_name}", dependencies=[Depends(require_auth)])
async def get_camera_stats(
    camera_name: str,
    days: int = Query(7, ge=1, le=365, description="Días hacia atrás"),
    db: Session = Depends(get_database_session)
):
    """Obtiene estadísticas de una cámara específica"""
    stats = crud.get_camera_stats(db, camera_name, days)
    return stats

# ==================== ENDPOINTS DE EXPORTACIÓN ====================

@app.post("/api/export", dependencies=[Depends(require_auth)])
async def export_events(
    export_request: ExportRequest,
    db: Session = Depends(get_database_session)
):
    """Exporta eventos a Excel o CSV"""
    
    # Obtener eventos según filtros
    events, _ = crud.get_plate_events_paginated(
        db, 
        export_request.filters, 
        page=1, 
        limit=10000  # Límite alto para exportación
    )
    
    if export_request.format.lower() == "xlsx":
        return await export_to_excel(events, export_request.include_images)
    else:
        return await export_to_csv(events, export_request.include_images)

async def export_to_excel(events: List[PlateEvent], include_images: bool) -> StreamingResponse:
    """Exporta eventos a formato Excel"""
    
    # Crear workbook
    wb = Workbook()
    ws = wb.active
    ws.title = "Eventos de Matrículas"
    
    # Headers
    headers = [
        "ID", "Matrícula", "Cámara", "Fecha/Hora", "Tipo Vehículo",
        "Confianza", "Semáforo", "Velocidad", "Zona", "Falso Positivo"
    ]
    
    if include_images:
        headers.extend(["URL Imagen", "URL Video"])
    
    ws.append(headers)
    
    # Datos
    for event in events:
        row = [
            event.id,
            event.license_plate,
            event.camera_name,
            event.timestamp.isoformat(),
            event.vehicle_type,
            event.plate_confidence,
            event.traffic_light_status,
            event.speed_kmh,
            event.zone,
            "Sí" if event.false_positive else "No"
        ]
        
        if include_images:
            row.extend([event.snapshot_url, event.clip_url])
        
        ws.append(row)
    
    # Guardar en memoria
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    
    # Retornar como streaming response
    return StreamingResponse(
        BytesIO(output.read()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=eventos_matriculas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"}
    )

async def export_to_csv(events: List[PlateEvent], include_images: bool) -> StreamingResponse:
    """Exporta eventos a formato CSV"""
    import csv
    from io import StringIO
    
    output = StringIO()
    writer = csv.writer(output)
    
    # Headers
    headers = [
        "ID", "Matrícula", "Cámara", "Fecha/Hora", "Tipo Vehículo",
        "Confianza", "Semáforo", "Velocidad", "Zona", "Falso Positivo"
    ]
    
    if include_images:
        headers.extend(["URL Imagen", "URL Video"])
    
    writer.writerow(headers)
    
    # Datos
    for event in events:
        row = [
            event.id,
            event.license_plate,
            event.camera_name,
            event.timestamp.isoformat(),
            event.vehicle_type,
            event.plate_confidence,
            event.traffic_light_status,
            event.speed_kmh,
            event.zone,
            "Sí" if event.false_positive else "No"
        ]
        
        if include_images:
            row.extend([event.snapshot_url, event.clip_url])
        
        writer.writerow(row)
    
    output.seek(0)
    
    return StreamingResponse(
        BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=eventos_matriculas_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"}
    )

# ==================== ENDPOINTS DE MANTENIMIENTO ====================

@app.post("/api/maintenance/cleanup", dependencies=[Depends(require_auth)])
async def cleanup_old_events(
    retention_days: int = Query(30, ge=1, description="Días de retención"),
    db: Session = Depends(get_database_session)
):
    """Elimina eventos antiguos según la política de retención"""
    deleted_count = crud.cleanup_old_events(db, retention_days)
    return {"message": f"Se eliminaron {deleted_count} eventos antiguos"}

@app.post("/api/maintenance/optimize", dependencies=[Depends(require_auth)])
async def optimize_database_endpoint(background_tasks: BackgroundTasks):
    """Optimiza la base de datos"""
    background_tasks.add_task(optimize_database)
    return {"message": "Optimización de base de datos iniciada en segundo plano"}

@app.get("/api/maintenance/database-info", dependencies=[Depends(require_auth)])
async def database_info():
    """Obtiene información de la base de datos"""
    return get_database_info()

# ==================== PUNTO DE ENTRADA ====================

if __name__ == "__main__":
    """
    Ejecuta el servidor de desarrollo
    
    Para producción, usar un servidor ASGI como Gunicorn:
    gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
    """
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=2221,
        reload=True,  # Solo para desarrollo
        log_level="info"
    )