#!/usr/bin/env python3
"""
Script de inicio del Sistema LPR Backend
Punto de entrada simplificado para desarrollo y producción
"""

import sys
import os
import subprocess
import argparse
from pathlib import Path

# Agregar el directorio actual al path para importaciones
sys.path.insert(0, str(Path(__file__).parent))

def check_dependencies():
    """Verificar que las dependencias estén instaladas"""
    try:
        import fastapi
        import uvicorn
        import sqlalchemy
        import paho.mqtt.client
        print("✓ Todas las dependencias están disponibles")
        return True
    except ImportError as e:
        print(f"✗ Error: Falta la dependencia {e.name}")
        print("Ejecuta: pip install -r requirements.txt")
        return False

def setup_database():
    """Configurar la base de datos si es necesario"""
    try:
        from app.database import engine, Base
        from app.models import PlateEvent, LPRSettings
        
        # Crear directorios necesarios
        os.makedirs("data", exist_ok=True)
        os.makedirs("logs", exist_ok=True)
        
        # Crear tablas
        Base.metadata.create_all(bind=engine)
        print("✓ Base de datos configurada")
        return True
    except Exception as e:
        print(f"⚠ Warning: Error configurando base de datos: {e}")
        print("La base de datos se creará automáticamente al iniciar")
        return False

def start_server(host="localhost", port=2221, reload=False, workers=1):
    """Iniciar el servidor LPR"""
    print(f"🚀 Iniciando servidor LPR en {host}:{port}")
    
    if reload:
        # Modo desarrollo con auto-reload
        subprocess.run([
            "uvicorn", "app.main:app",
            "--host", host,
            "--port", str(port),
            "--reload"
        ])
    else:
        # Modo producción
        if workers > 1:
            subprocess.run([
                "gunicorn", "app.main:app",
                "-w", str(workers),
                "-k", "uvicorn.workers.UvicornWorker",
                "--bind", f"{host}:{port}"
            ])
        else:
            subprocess.run([
                "uvicorn", "app.main:app",
                "--host", host,
                "--port", str(port)
            ])

def main():
    parser = argparse.ArgumentParser(description="Sistema LPR Backend")
    parser.add_argument("--host", default="localhost", help="Host del servidor (default: localhost)")
    parser.add_argument("--port", type=int, default=2221, help="Puerto del servidor (default: 2221)")
    parser.add_argument("--reload", action="store_true", help="Activar auto-reload (desarrollo)")
    parser.add_argument("--workers", type=int, default=1, help="Número de workers (producción)")
    parser.add_argument("--no-setup", action="store_true", help="Omitir configuración inicial")
    
    args = parser.parse_args()
    
    print("=== Sistema LPR Backend ===")
    print()
    
    # Verificar dependencias
    if not check_dependencies():
        sys.exit(1)
    
    # Configurar base de datos
    if not args.no_setup:
        setup_database()
    
    # Iniciar servidor
    try:
        start_server(
            host=args.host,
            port=args.port,
            reload=args.reload,
            workers=args.workers
        )
    except KeyboardInterrupt:
        print("\n👋 Servidor detenido")
    except Exception as e:
        print(f"✗ Error iniciando servidor: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()