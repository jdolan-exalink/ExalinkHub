#!/usr/bin/env python3
"""
Script para enviar un evento de prueba al backend LPR
"""
import requests
import json
from datetime import datetime

# Configuración
backend_url = "http://localhost:2221"
username = "admin"
password = "admin123"

# Crear evento de prueba
test_event = {
    "license_plate": "ABC123",
    "confidence": 0.95,
    "camera_name": "camara_prueba",
    "zone": "Entrada Principal",
    "timestamp": datetime.now().isoformat(),
    "vehicle_type": "car",
    "snapshot_path": None,
    "clip_path": None,
    "crop_path": None
}

print("=== Enviando Evento de Prueba al Backend LPR ===\n")
print(f"Backend: {backend_url}")
print(f"Usuario: {username}")
print(f"Evento: {json.dumps(test_event, indent=2)}\n")

try:
    # Enviar evento
    response = requests.post(
        f"{backend_url}/api/events",
        json=test_event,
        auth=(username, password),
        timeout=10
    )
    
    print(f"Status Code: {response.status_code}")
    print(f"Respuesta: {response.text}\n")
    
    if response.status_code in [200, 201]:
        print("✅ Evento guardado exitosamente!")
        event_data = response.json()
        print(f"ID del evento: {event_data.get('id', 'N/A')}")
    else:
        print(f"❌ Error al guardar evento: {response.status_code}")
        
except Exception as e:
    print(f"❌ Error: {e}")

print("\n=== Verificando que el evento se guardó ===\n")

try:
    # Obtener últimos eventos
    response = requests.get(
        f"{backend_url}/api/events?limit=5",
        auth=(username, password),
        timeout=10
    )
    
    if response.status_code == 200:
        data = response.json()
        events = data.get('events', [])
        print(f"Total de eventos en BD: {data.get('total', 0)}")
        print(f"Eventos recuperados: {len(events)}\n")
        
        if events:
            print("Últimos eventos:")
            for event in events[:3]:
                print(f"  - {event.get('license_plate')} | Confianza: {event.get('confidence')} | Cámara: {event.get('camera_name')} | {event.get('timestamp')}")
        else:
            print("No hay eventos en la base de datos")
    else:
        print(f"❌ Error al obtener eventos: {response.status_code}")
        
except Exception as e:
    print(f"❌ Error: {e}")

print("\n=== Verificando desde el frontend ===\n")

try:
    # Obtener desde el endpoint del frontend
    response = requests.get(
        "http://localhost:9002/api/lpr/readings?limit=5",
        timeout=10
    )
    
    if response.status_code == 200:
        data = response.json()
        readings = data.get('readings', [])
        print(f"Lecturas desde frontend: {len(readings)}")
        
        if readings:
            print("Últimas lecturas:")
            for reading in readings[:3]:
                print(f"  - {reading.get('plate')} | Confianza: {reading.get('confidence')} | Cámara: {reading.get('camera')}")
        else:
            print("No hay lecturas disponibles desde el frontend")
    else:
        print(f"❌ Error al obtener lecturas del frontend: {response.status_code}")
        
except Exception as e:
    print(f"❌ Error: {e}")

print("\n✅ Prueba completada!")
