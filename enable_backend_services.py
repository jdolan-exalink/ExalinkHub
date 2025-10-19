#!/usr/bin/env python3
"""
Script para habilitar los servicios backend después de la limpieza de datos demo
"""

import sqlite3
import json
from datetime import datetime

def enable_backend_services():
    """Habilita todos los servicios backend en la base de datos"""

    # Conectar a la base de datos de configuración
    db_path = "DB/config.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    print("🔧 Habilitando servicios backend...")

    # Configuraciones por defecto para cada servicio
    services_config = {
        "LPR (Matrículas)": {
            "enabled": True,
            "config": json.dumps({
                "mqtt_host": "10.147.18.148",
                "mqtt_port": 1883,
                "mqtt_topic": "frigate/events",
                "frigate_host": "10.1.1.252",
                "frigate_port": 5000,
                "database_path": "./DB/matriculas.db",
                "retention_days": 30
            })
        },
        "Conteo de Personas": {
            "enabled": True,
            "config": json.dumps({
                "mqtt_host": "10.147.18.148",
                "mqtt_port": 1883,
                "mqtt_topic": "frigate/events",
                "database_path": "./DB/counting.db",
                "processing_interval": 30
            })
        },
        "Notificaciones": {
            "enabled": True,
            "config": json.dumps({
                "webhook_url": "",
                "email_enabled": False,
                "sms_enabled": False,
                "mqtt_host": "10.147.18.148",
                "mqtt_port": 1883
            })
        }
    }

    # Actualizar cada servicio
    for service_name, config in services_config.items():
        cursor.execute("""
            UPDATE backend_config
            SET enabled = ?, config = ?, updated_at = ?
            WHERE service_name = ?
        """, (
            1 if config["enabled"] else 0,
            config["config"],
            datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            service_name
        ))

        if cursor.rowcount > 0:
            print(f"✅ {service_name}: habilitado")
        else:
            print(f"⚠️ {service_name}: no encontrado, creando...")

            # Si no existe, insertar
            cursor.execute("""
                INSERT INTO backend_config (service_name, enabled, config, created_at, updated_at, auto_start)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                service_name,
                1 if config["enabled"] else 0,
                config["config"],
                datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                1  # auto_start
            ))
            print(f"✅ {service_name}: creado y habilitado")

    # Confirmar cambios
    conn.commit()
    conn.close()

    print("\n🎉 Servicios backend habilitados exitosamente!")
    print("📋 Configuración aplicada:")
    for service_name, config in services_config.items():
        print(f"   • {service_name}: {'✅ Habilitado' if config['enabled'] else '❌ Deshabilitado'}")

if __name__ == "__main__":
    enable_backend_services()