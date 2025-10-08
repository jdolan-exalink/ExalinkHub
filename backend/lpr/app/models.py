"""
Modelos de base de datos para el sistema de matrículas (LPR)

Todos los nombres de variables y funciones usan snake_case siguiendo
las convenciones del proyecto ExalinkHub.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, Text, Index
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime

Base = declarative_base()

class PlateEvent(Base):
    """
    Modelo para eventos de reconocimiento de matrículas
    
    Almacena la información consolidada de cada evento de detección
    de matrícula desde Frigate.
    """
    __tablename__ = "plate_events"
    
    # Identificadores principales
    id = Column(Integer, primary_key=True, index=True)
    frigate_event_id = Column(String(255), unique=True, index=True, nullable=False)
    
    # Información temporal
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=True)
    
    # Información de la cámara y ubicación
    camera_name = Column(String(100), nullable=False, index=True)
    zone = Column(String(100), nullable=True)
    
    # Información de la matrícula
    license_plate = Column(String(20), nullable=False, index=True)
    plate_confidence = Column(Float, nullable=True)
    plate_region = Column(String(50), nullable=True)
    
    # Información del vehículo
    vehicle_type = Column(String(50), nullable=True)  # car, truck, motorcycle, etc.
    vehicle_color = Column(String(30), nullable=True)
    vehicle_confidence = Column(Float, nullable=True)
    
    # Información de velocidad y movimiento
    speed_kmh = Column(Float, nullable=True)
    direction = Column(String(20), nullable=True)  # north, south, east, west
    
    # Información del semáforo
    traffic_light_status = Column(String(20), nullable=True)  # red, yellow, green, unknown
    
    # URLs de medios
    snapshot_url = Column(String(500), nullable=True)
    clip_url = Column(String(500), nullable=True)
    
    # Metadatos adicionales
    top_score = Column(Float, nullable=True)
    false_positive = Column(Boolean, default=False)
    has_clip = Column(Boolean, default=False)
    has_snapshot = Column(Boolean, default=False)
    
    # Campos de auditoría
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    processed = Column(Boolean, default=False)
    
    # Información adicional en JSON text
    extra_metadata = Column(Text, nullable=True)  # Para información adicional en formato JSON
    
    # Índices para mejorar performance de consultas
    __table_args__ = (
        Index('idx_camera_timestamp', 'camera_name', 'timestamp'),
        Index('idx_plate_timestamp', 'license_plate', 'timestamp'),
        Index('idx_traffic_light', 'traffic_light_status'),
        Index('idx_processed', 'processed'),
        Index('idx_false_positive', 'false_positive'),
    )

class SystemConfig(Base):
    """
    Modelo para configuración del sistema
    
    Almacena pares clave-valor para la configuración del sistema.
    """
    __tablename__ = "system_config"
    
    id = Column(Integer, primary_key=True, index=True)
    config_key = Column(String(100), unique=True, nullable=False, index=True)
    config_value = Column(Text, nullable=True)
    config_type = Column(String(20), default='string', nullable=False)  # string, int, float, bool, json
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)