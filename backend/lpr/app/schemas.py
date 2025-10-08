"""
Esquemas Pydantic para el sistema de matrículas (LPR)

Define las estructuras de datos de entrada y salida para la API REST.
Todos los nombres de variables y funciones usan snake_case siguiendo
las convenciones del proyecto ExalinkHub.
"""

from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum

class TrafficLightStatus(str, Enum):
    """Estados posibles del semáforo"""
    red = "red"
    yellow = "yellow"
    green = "green"
    unknown = "unknown"

class VehicleType(str, Enum):
    """Tipos de vehículos detectables"""
    car = "car"
    truck = "truck"
    motorcycle = "motorcycle"
    bus = "bus"
    bicycle = "bicycle"
    unknown = "unknown"

class Direction(str, Enum):
    """Direcciones de movimiento"""
    north = "north"
    south = "south"
    east = "east"
    west = "west"
    northeast = "northeast"
    northwest = "northwest"
    southeast = "southeast"
    southwest = "southwest"
    unknown = "unknown"

class PlateEventBase(BaseModel):
    """Esquema base para eventos de matrícula"""
    frigate_event_id: str = Field(..., description="ID único del evento en Frigate")
    camera_name: str = Field(..., description="Nombre de la cámara que detectó el evento")
    license_plate: str = Field(..., description="Matrícula detectada")
    start_time: datetime = Field(..., description="Fecha y hora de inicio del evento")
    end_time: Optional[datetime] = Field(None, description="Fecha y hora de fin del evento")
    zone: Optional[str] = Field(None, description="Zona donde se detectó el evento")
    plate_confidence: Optional[float] = Field(None, ge=0, le=1, description="Confianza de la detección de matrícula")
    plate_region: Optional[str] = Field(None, description="Región/país de la matrícula")
    vehicle_type: Optional[VehicleType] = Field(None, description="Tipo de vehículo")
    vehicle_color: Optional[str] = Field(None, description="Color del vehículo")
    vehicle_confidence: Optional[float] = Field(None, ge=0, le=1, description="Confianza de la detección del vehículo")
    speed_kmh: Optional[float] = Field(None, ge=0, description="Velocidad en km/h")
    direction: Optional[Direction] = Field(None, description="Dirección de movimiento")
    traffic_light_status: Optional[TrafficLightStatus] = Field(None, description="Estado del semáforo")
    snapshot_url: Optional[str] = Field(None, description="URL de la imagen snapshot")
    clip_url: Optional[str] = Field(None, description="URL del video clip")
    top_score: Optional[float] = Field(None, ge=0, le=1, description="Puntuación más alta del evento")
    false_positive: bool = Field(False, description="Marca si es un falso positivo")
    has_clip: bool = Field(False, description="Indica si tiene video clip")
    has_snapshot: bool = Field(False, description="Indica si tiene imagen snapshot")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Metadatos adicionales")

    @validator('license_plate')
    def validate_license_plate(cls, v):
        """Valida que la matrícula no esté vacía"""
        if not v or not v.strip():
            raise ValueError('La matrícula no puede estar vacía')
        return v.strip().upper()

class PlateEventCreate(PlateEventBase):
    """Esquema para crear un nuevo evento de matrícula"""
    pass

class PlateEventUpdate(BaseModel):
    """Esquema para actualizar un evento de matrícula"""
    license_plate: Optional[str] = Field(None, description="Nueva matrícula")
    false_positive: Optional[bool] = Field(None, description="Marcar como falso positivo")
    traffic_light_status: Optional[TrafficLightStatus] = Field(None, description="Estado del semáforo")
    vehicle_type: Optional[VehicleType] = Field(None, description="Tipo de vehículo")
    vehicle_color: Optional[str] = Field(None, description="Color del vehículo")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Metadatos adicionales")

    @validator('license_plate')
    def validate_license_plate(cls, v):
        """Valida que la matrícula no esté vacía si se proporciona"""
        if v is not None and (not v or not v.strip()):
            raise ValueError('La matrícula no puede estar vacía')
        return v.strip().upper() if v else v

class PlateEventResponse(PlateEventBase):
    """Esquema de respuesta para eventos de matrícula"""
    id: int = Field(..., description="ID único del evento")
    timestamp: datetime = Field(..., description="Fecha y hora de creación del registro")
    created_at: datetime = Field(..., description="Fecha y hora de creación")
    updated_at: datetime = Field(..., description="Fecha y hora de última actualización")
    processed: bool = Field(..., description="Indica si el evento ha sido procesado")

    class Config:
        from_attributes = True

class PlateEventListResponse(BaseModel):
    """Esquema de respuesta para listas de eventos"""
    events: List[PlateEventResponse] = Field(..., description="Lista de eventos")
    total: int = Field(..., description="Total de eventos")
    page: int = Field(..., description="Página actual")
    limit: int = Field(..., description="Límite por página")
    has_next: bool = Field(..., description="Indica si hay más páginas")

class PlateEventFilters(BaseModel):
    """Filtros para consulta de eventos"""
    camera_name: Optional[str] = Field(None, description="Filtrar por cámara")
    license_plate: Optional[str] = Field(None, description="Filtrar por matrícula")
    start_date: Optional[datetime] = Field(None, description="Fecha de inicio")
    end_date: Optional[datetime] = Field(None, description="Fecha de fin")
    traffic_light_status: Optional[TrafficLightStatus] = Field(None, description="Estado del semáforo")
    vehicle_type: Optional[VehicleType] = Field(None, description="Tipo de vehículo")
    false_positive: Optional[bool] = Field(None, description="Filtrar falsos positivos")
    zone: Optional[str] = Field(None, description="Filtrar por zona")
    min_confidence: Optional[float] = Field(None, ge=0, le=1, description="Confianza mínima")

# Esquemas para configuración de la aplicación
class CameraConfig(BaseModel):
    """Configuración de cámara"""
    name: str = Field(..., description="Nombre de la cámara")
    enabled: bool = Field(True, description="Si está habilitada")
    traffic_light_enabled: bool = Field(False, description="Si tiene semáforo")
    speed_detection_enabled: bool = Field(False, description="Si detecta velocidad")
    zones: List[str] = Field(default_factory=list, description="Zonas configuradas")

class MqttConfig(BaseModel):
    """Configuración MQTT"""
    host: str = Field("localhost", description="Host del broker MQTT")
    port: int = Field(1883, description="Puerto del broker MQTT")
    username: Optional[str] = Field(None, description="Usuario MQTT")
    password: Optional[str] = Field(None, description="Contraseña MQTT")
    topic_prefix: str = Field("frigate", description="Prefijo de topics")

class FrigateConfig(BaseModel):
    """Configuración de Frigate"""
    host: str = Field("localhost", description="Host de Frigate")
    port: int = Field(5000, description="Puerto de Frigate")
    use_ssl: bool = Field(False, description="Usar HTTPS")
    username: Optional[str] = Field(None, description="Usuario Frigate")
    password: Optional[str] = Field(None, description="Contraseña Frigate")

class AuthConfig(BaseModel):
    """Configuración de autenticación"""
    enabled: bool = Field(True, description="Si está habilitada la autenticación")
    username: str = Field("admin", description="Usuario por defecto")
    password: str = Field("", description="Contraseña (hash)")

class AppConfig(BaseModel):
    """Configuración completa de la aplicación"""
    mqtt: MqttConfig = Field(default_factory=MqttConfig, description="Configuración MQTT")
    frigate: FrigateConfig = Field(default_factory=FrigateConfig, description="Configuración Frigate")
    auth: AuthConfig = Field(default_factory=AuthConfig, description="Configuración autenticación")
    cameras: Dict[str, CameraConfig] = Field(default_factory=dict, description="Configuración de cámaras")
    retention_days: int = Field(30, description="Días de retención de eventos")
    max_events_per_camera: int = Field(1000, description="Máximo de eventos por cámara")

class AppConfigResponse(AppConfig):
    """Respuesta de configuración de la aplicación"""
    pass

class StatsResponse(BaseModel):
    """Estadísticas del sistema"""
    total_events: int = Field(..., description="Total de eventos")
    events_today: int = Field(..., description="Eventos de hoy")
    events_this_week: int = Field(..., description="Eventos esta semana")
    events_this_month: int = Field(..., description="Eventos este mes")
    cameras_active: int = Field(..., description="Cámaras activas")
    top_cameras: List[Dict[str, Any]] = Field(..., description="Cámaras con más eventos")
    top_plates: List[Dict[str, Any]] = Field(..., description="Matrículas más frecuentes")
    traffic_light_stats: Dict[str, int] = Field(..., description="Estadísticas de semáforos")

class ExportRequest(BaseModel):
    """Solicitud de exportación"""
    format: str = Field("xlsx", description="Formato de exportación (xlsx, csv)")
    filters: Optional[PlateEventFilters] = Field(None, description="Filtros a aplicar")
    include_images: bool = Field(False, description="Incluir enlaces a imágenes")

class HealthResponse(BaseModel):
    """Respuesta de estado de salud del sistema"""
    status: str = Field(..., description="Estado general")
    mqtt_connected: bool = Field(..., description="Estado de conexión MQTT")
    database_connected: bool = Field(..., description="Estado de conexión a la BD")
    frigate_accessible: bool = Field(..., description="Estado de acceso a Frigate")
    last_event_time: Optional[datetime] = Field(None, description="Último evento recibido")
    version: str = Field(..., description="Versión del sistema")