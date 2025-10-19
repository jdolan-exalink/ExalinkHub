#!/usr/bin/env python3
"""
Script para insertar un evento de prueba directamente en la base de datos
"""
import sqlite3
from datetime import datetime

db_path = './DB/matriculas.db'

print("=== Insertando Evento de Prueba ===\n")

# Conectar a la base de datos
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Crear evento de prueba
timestamp = datetime.now().isoformat()
license_plate = "ABC123"
confidence = 0.95
camera_name = "camara_prueba"
zone = "Entrada Principal"
vehicle_type = "car"

print(f"Matrícula: {license_plate}")
print(f"Confianza: {confidence}")
print(f"Cámara: {camera_name}")
print(f"Zona: {zone}")
print(f"Timestamp: {timestamp}\n")

try:
    # Generar un frigate_event_id único
    frigate_event_id = f"test_{int(datetime.now().timestamp())}"
    
    # Insertar en plate_events
    cursor.execute("""
        INSERT INTO plate_events (
            frigate_event_id, timestamp, start_time, end_time, license_plate, plate_confidence, 
            camera_name, zone, vehicle_type, snapshot_path, clip_path, crop_path,
            snapshot_url, clip_url, false_positive, has_clip, has_snapshot,
            created_at, updated_at, processed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        frigate_event_id, timestamp, timestamp, timestamp, license_plate, confidence,
        camera_name, zone, vehicle_type, None, None, None, None, None, 0, 0, 0,
        timestamp, timestamp, 1
    ))
    
    event_id = cursor.lastrowid
    conn.commit()
    
    print(f"✅ Evento insertado con ID: {event_id}\n")
    
    # Verificar
    cursor.execute("SELECT COUNT(*) FROM plate_events")
    total = cursor.fetchone()[0]
    print(f"Total de eventos en BD: {total}")
    
    # Mostrar últimos 5 eventos
    cursor.execute("""
        SELECT id, license_plate, plate_confidence, camera_name, timestamp
        FROM plate_events
        ORDER BY id DESC
        LIMIT 5
    """)
    
    print("\nÚltimos 5 eventos:")
    for row in cursor.fetchall():
        print(f"  ID: {row[0]} | {row[1]} | Confianza: {row[2]} | Cámara: {row[3]} | {row[4]}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    conn.rollback()
finally:
    conn.close()

print("\n✅ Proceso completado!")
