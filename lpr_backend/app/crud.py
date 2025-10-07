"""
Operaciones CRUD para el sistema de matrículas (LPR)

Contiene todas las funciones para crear, leer, actualizar y eliminar
eventos de matrícula y configuración del sistema.
Todas las funciones usan snake_case siguiendo las convenciones del proyecto.
"""

from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func, text
from typing import List, Optional, Dict, Any, Tuple
from datetime import datetime, timedelta
import json

from app.models import PlateEvent, SystemConfig
from app.schemas import (
    PlateEventCreate, PlateEventUpdate, PlateEventFilters,
    TrafficLightStatus, VehicleType
)

# ==================== OPERACIONES CRUD PARA EVENTOS ====================

def create_plate_event(db: Session, event_data: PlateEventCreate) -> PlateEvent:
    """
    Crea un nuevo evento de matrícula en la base de datos
    
    Args:
        db: Sesión de base de datos
        event_data: Datos del evento a crear
    
    Returns:
        PlateEvent: Evento creado
    """
    # Convertir metadata a JSON string si existe
    metadata_json = None
    if event_data.metadata:
        metadata_json = json.dumps(event_data.metadata)
    
    db_event = PlateEvent(
        frigate_event_id=event_data.frigate_event_id,
        camera_name=event_data.camera_name,
        license_plate=event_data.license_plate.upper(),
        start_time=event_data.start_time,
        end_time=event_data.end_time,
        zone=event_data.zone,
        plate_confidence=event_data.plate_confidence,
        plate_region=event_data.plate_region,
        vehicle_type=event_data.vehicle_type,
        vehicle_color=event_data.vehicle_color,
        vehicle_confidence=event_data.vehicle_confidence,
        speed_kmh=event_data.speed_kmh,
        direction=event_data.direction,
        traffic_light_status=event_data.traffic_light_status,
        snapshot_url=event_data.snapshot_url,
        clip_url=event_data.clip_url,
        top_score=event_data.top_score,
        false_positive=event_data.false_positive,
        has_clip=event_data.has_clip,
        has_snapshot=event_data.has_snapshot,
        metadata=metadata_json,
        processed=True  # Marcar como procesado al crear
    )
    
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

def get_plate_event_by_id(db: Session, event_id: int) -> Optional[PlateEvent]:
    """
    Obtiene un evento por su ID
    
    Args:
        db: Sesión de base de datos
        event_id: ID del evento
    
    Returns:
        PlateEvent o None si no existe
    """
    return db.query(PlateEvent).filter(PlateEvent.id == event_id).first()

def get_plate_event_by_frigate_id(db: Session, frigate_id: str) -> Optional[PlateEvent]:
    """
    Obtiene un evento por su ID de Frigate
    
    Args:
        db: Sesión de base de datos
        frigate_id: ID del evento en Frigate
    
    Returns:
        PlateEvent o None si no existe
    """
    return db.query(PlateEvent).filter(PlateEvent.frigate_event_id == frigate_id).first()

def update_plate_event(db: Session, event_id: int, event_data: PlateEventUpdate) -> Optional[PlateEvent]:
    """
    Actualiza un evento existente
    
    Args:
        db: Sesión de base de datos
        event_id: ID del evento a actualizar
        event_data: Nuevos datos del evento
    
    Returns:
        PlateEvent actualizado o None si no existe
    """
    db_event = get_plate_event_by_id(db, event_id)
    if not db_event:
        return None
    
    # Actualizar campos proporcionados
    update_data = event_data.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        if field == "license_plate" and value:
            value = value.upper()
        elif field == "metadata" and value:
            value = json.dumps(value)
        
        setattr(db_event, field, value)
    
    # Actualizar timestamp de modificación
    db_event.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_event)
    return db_event

def delete_plate_event(db: Session, event_id: int) -> bool:
    """
    Elimina un evento de la base de datos
    
    Args:
        db: Sesión de base de datos
        event_id: ID del evento a eliminar
    
    Returns:
        bool: True si se eliminó, False si no existía
    """
    db_event = get_plate_event_by_id(db, event_id)
    if not db_event:
        return False
    
    db.delete(db_event)
    db.commit()
    return True

def get_plate_events_paginated(
    db: Session,
    filters: Optional[PlateEventFilters] = None,
    page: int = 1,
    limit: int = 50,
    order_by: str = "timestamp",
    order_desc: bool = True
) -> Tuple[List[PlateEvent], int]:
    """
    Obtiene eventos paginados con filtros opcionales
    
    Args:
        db: Sesión de base de datos
        filters: Filtros a aplicar
        page: Número de página (inicia en 1)
        limit: Cantidad de eventos por página
        order_by: Campo por el que ordenar
        order_desc: Si ordenar descendente
    
    Returns:
        Tuple con (lista de eventos, total de eventos)
    """
    query = db.query(PlateEvent)
    
    # Aplicar filtros si se proporcionan
    if filters:
        if filters.camera_name:
            query = query.filter(PlateEvent.camera_name.ilike(f"%{filters.camera_name}%"))
        
        if filters.license_plate:
            query = query.filter(PlateEvent.license_plate.ilike(f"%{filters.license_plate.upper()}%"))
        
        if filters.start_date:
            query = query.filter(PlateEvent.timestamp >= filters.start_date)
        
        if filters.end_date:
            query = query.filter(PlateEvent.timestamp <= filters.end_date)
        
        if filters.traffic_light_status:
            query = query.filter(PlateEvent.traffic_light_status == filters.traffic_light_status)
        
        if filters.vehicle_type:
            query = query.filter(PlateEvent.vehicle_type == filters.vehicle_type)
        
        if filters.false_positive is not None:
            query = query.filter(PlateEvent.false_positive == filters.false_positive)
        
        if filters.zone:
            query = query.filter(PlateEvent.zone.ilike(f"%{filters.zone}%"))
        
        if filters.min_confidence:
            query = query.filter(PlateEvent.plate_confidence >= filters.min_confidence)
    
    # Contar total de eventos
    total = query.count()
    
    # Aplicar ordenamiento
    order_field = getattr(PlateEvent, order_by, PlateEvent.timestamp)
    if order_desc:
        query = query.order_by(desc(order_field))
    else:
        query = query.order_by(order_field)
    
    # Aplicar paginación
    offset = (page - 1) * limit
    events = query.offset(offset).limit(limit).all()
    
    return events, total

def search_plate_events(db: Session, search_term: str, limit: int = 20) -> List[PlateEvent]:
    """
    Busca eventos por término de búsqueda general
    
    Args:
        db: Sesión de base de datos
        search_term: Término a buscar en múltiples campos
        limit: Límite de resultados
    
    Returns:
        Lista de eventos que coinciden
    """
    search_pattern = f"%{search_term.upper()}%"
    
    events = db.query(PlateEvent).filter(
        or_(
            PlateEvent.license_plate.ilike(search_pattern),
            PlateEvent.camera_name.ilike(search_pattern),
            PlateEvent.vehicle_color.ilike(search_pattern),
            PlateEvent.zone.ilike(search_pattern)
        )
    ).order_by(desc(PlateEvent.timestamp)).limit(limit).all()
    
    return events

# ==================== ESTADÍSTICAS Y REPORTES ====================

def get_plate_event_stats(db: Session) -> Dict[str, Any]:
    """
    Obtiene estadísticas generales de eventos
    
    Args:
        db: Sesión de base de datos
    
    Returns:
        Diccionario con estadísticas
    """
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())
    month_start = today_start.replace(day=1)
    
    # Estadísticas básicas
    total_events = db.query(PlateEvent).count()
    events_today = db.query(PlateEvent).filter(PlateEvent.timestamp >= today_start).count()
    events_this_week = db.query(PlateEvent).filter(PlateEvent.timestamp >= week_start).count()
    events_this_month = db.query(PlateEvent).filter(PlateEvent.timestamp >= month_start).count()
    
    # Cámaras activas (con eventos en las últimas 24 horas)
    cameras_active = db.query(PlateEvent.camera_name).filter(
        PlateEvent.timestamp >= today_start
    ).distinct().count()
    
    # Top cámaras por eventos
    top_cameras = db.query(
        PlateEvent.camera_name,
        func.count(PlateEvent.id).label('event_count')
    ).group_by(PlateEvent.camera_name).order_by(
        desc('event_count')
    ).limit(5).all()
    
    # Top matrículas
    top_plates = db.query(
        PlateEvent.license_plate,
        func.count(PlateEvent.id).label('event_count')
    ).filter(
        PlateEvent.false_positive == False
    ).group_by(PlateEvent.license_plate).order_by(
        desc('event_count')
    ).limit(10).all()
    
    # Estadísticas de semáforos
    traffic_light_stats = {}
    for status in ['red', 'yellow', 'green', 'unknown']:
        count = db.query(PlateEvent).filter(
            PlateEvent.traffic_light_status == status
        ).count()
        traffic_light_stats[status] = count
    
    return {
        "total_events": total_events,
        "events_today": events_today,
        "events_this_week": events_this_week,
        "events_this_month": events_this_month,
        "cameras_active": cameras_active,
        "top_cameras": [{"name": name, "count": count} for name, count in top_cameras],
        "top_plates": [{"plate": plate, "count": count} for plate, count in top_plates],
        "traffic_light_stats": traffic_light_stats
    }

def get_camera_stats(db: Session, camera_name: str, days: int = 7) -> Dict[str, Any]:
    """
    Obtiene estadísticas de una cámara específica
    
    Args:
        db: Sesión de base de datos
        camera_name: Nombre de la cámara
        days: Días hacia atrás para las estadísticas
    
    Returns:
        Diccionario con estadísticas de la cámara
    """
    start_date = datetime.utcnow() - timedelta(days=days)
    
    total_events = db.query(PlateEvent).filter(
        PlateEvent.camera_name == camera_name,
        PlateEvent.timestamp >= start_date
    ).count()
    
    # Eventos por día
    daily_events = db.query(
        func.date(PlateEvent.timestamp).label('date'),
        func.count(PlateEvent.id).label('count')
    ).filter(
        PlateEvent.camera_name == camera_name,
        PlateEvent.timestamp >= start_date
    ).group_by(func.date(PlateEvent.timestamp)).all()
    
    # Tipos de vehículos
    vehicle_types = db.query(
        PlateEvent.vehicle_type,
        func.count(PlateEvent.id).label('count')
    ).filter(
        PlateEvent.camera_name == camera_name,
        PlateEvent.timestamp >= start_date,
        PlateEvent.vehicle_type.isnot(None)
    ).group_by(PlateEvent.vehicle_type).all()
    
    return {
        "camera_name": camera_name,
        "total_events": total_events,
        "daily_events": [{"date": str(date), "count": count} for date, count in daily_events],
        "vehicle_types": [{"type": vtype, "count": count} for vtype, count in vehicle_types]
    }

# ==================== OPERACIONES DE CONFIGURACIÓN ====================

def set_config_value(db: Session, key: str, value: Any, config_type: str = "string", description: str = None) -> SystemConfig:
    """
    Establece un valor de configuración
    
    Args:
        db: Sesión de base de datos
        key: Clave de configuración
        value: Valor a almacenar
        config_type: Tipo de dato (string, int, float, bool, json)
        description: Descripción opcional
    
    Returns:
        SystemConfig: Configuración creada o actualizada
    """
    # Convertir valor según el tipo
    if config_type == "json":
        config_value = json.dumps(value)
    else:
        config_value = str(value)
    
    # Buscar configuración existente
    config = db.query(SystemConfig).filter(SystemConfig.config_key == key).first()
    
    if config:
        # Actualizar existente
        config.config_value = config_value
        config.config_type = config_type
        config.updated_at = datetime.utcnow()
        if description:
            config.description = description
    else:
        # Crear nueva
        config = SystemConfig(
            config_key=key,
            config_value=config_value,
            config_type=config_type,
            description=description
        )
        db.add(config)
    
    db.commit()
    db.refresh(config)
    return config

def get_config_value(db: Session, key: str, default_value: Any = None) -> Any:
    """
    Obtiene un valor de configuración
    
    Args:
        db: Sesión de base de datos
        key: Clave de configuración
        default_value: Valor por defecto si no existe
    
    Returns:
        Valor de configuración convertido al tipo apropiado
    """
    config = db.query(SystemConfig).filter(SystemConfig.config_key == key).first()
    
    if not config:
        return default_value
    
    # Convertir valor según el tipo
    if config.config_type == "int":
        return int(config.config_value)
    elif config.config_type == "float":
        return float(config.config_value)
    elif config.config_type == "bool":
        return config.config_value.lower() == "true"
    elif config.config_type == "json":
        return json.loads(config.config_value)
    else:
        return config.config_value

def get_all_config(db: Session) -> Dict[str, Any]:
    """
    Obtiene toda la configuración del sistema
    
    Args:
        db: Sesión de base de datos
    
    Returns:
        Diccionario con toda la configuración
    """
    configs = db.query(SystemConfig).all()
    result = {}
    
    for config in configs:
        result[config.config_key] = get_config_value(db, config.config_key)
    
    return result

# ==================== OPERACIONES DE MANTENIMIENTO ====================

def cleanup_old_events(db: Session, retention_days: int = 30) -> int:
    """
    Elimina eventos antiguos según la política de retención
    
    Args:
        db: Sesión de base de datos
        retention_days: Días de retención
    
    Returns:
        Número de eventos eliminados
    """
    cutoff_date = datetime.utcnow() - timedelta(days=retention_days)
    
    deleted_count = db.query(PlateEvent).filter(
        PlateEvent.timestamp < cutoff_date
    ).delete()
    
    db.commit()
    return deleted_count

def mark_false_positives_bulk(db: Session, event_ids: List[int], is_false_positive: bool = True) -> int:
    """
    Marca múltiples eventos como falsos positivos o los desmarca
    
    Args:
        db: Sesión de base de datos
        event_ids: Lista de IDs de eventos
        is_false_positive: Si marcar como falso positivo o no
    
    Returns:
        Número de eventos actualizados
    """
    updated_count = db.query(PlateEvent).filter(
        PlateEvent.id.in_(event_ids)
    ).update({
        PlateEvent.false_positive: is_false_positive,
        PlateEvent.updated_at: datetime.utcnow()
    }, synchronize_session=False)
    
    db.commit()
    return updated_count

def get_recent_events(db: Session, hours: int = 24, limit: int = 100) -> List[PlateEvent]:
    """
    Obtiene eventos recientes
    
    Args:
        db: Sesión de base de datos
        hours: Horas hacia atrás
        limit: Límite de eventos
    
    Returns:
        Lista de eventos recientes
    """
    start_time = datetime.utcnow() - timedelta(hours=hours)
    
    return db.query(PlateEvent).filter(
        PlateEvent.timestamp >= start_time
    ).order_by(desc(PlateEvent.timestamp)).limit(limit).all()