#!/usr/bin/env python3
"""
Script para debug de mensajes MQTT
"""

import paho.mqtt.client as mqtt
import json
import sys

def on_message(client, userdata, msg):
    """Callback cuando se recibe un mensaje"""
    try:
        payload = msg.payload.decode()
        print(f"📨 Mensaje recibido en topic '{msg.topic}':")
        print(f"   Raw: {payload}")

        # Intentar parsear como JSON
        try:
            data = json.loads(payload)
            print(f"   JSON: {json.dumps(data, indent=2)}")
            print(f"   Type: {data.get('type', 'unknown')}")
            if 'plate' in data:
                print(f"   ✅ Contiene matrícula: {data['plate']}")
            else:
                print("   ❌ No contiene matrícula")
        except json.JSONDecodeError:
            print("   ❌ No es JSON válido")

        print("-" * 50)

    except Exception as e:
        print(f"❌ Error procesando mensaje: {e}")

def main():
    """Función principal"""
    broker_host = "10.147.18.148"
    broker_port = 1883
    topic = "frigate/events"

    print(f"🔍 Conectando a MQTT {broker_host}:{broker_port}, topic: {topic}")
    print("Presiona Ctrl+C para salir")
    print()

    client = mqtt.Client()
    client.on_message = on_message

    try:
        client.connect(broker_host, broker_port, 60)
        client.subscribe(topic)

        client.loop_forever()

    except KeyboardInterrupt:
        print("\n👋 Saliendo...")
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()