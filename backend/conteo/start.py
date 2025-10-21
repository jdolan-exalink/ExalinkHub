#!/usr/bin/env python3
"""
Script de inicio para el backend de conteo
Ejecuta la aplicación FastAPI con uvicorn en el puerto correcto
"""

import uvicorn
import os
import sys

if __name__ == "__main__":
    port = int(os.getenv("PORT", "8012"))
    host = os.getenv("HOST", "0.0.0.0")

    print(f"Starting conteo backend on {host}:{port}")
    
    # Agregar el directorio services/api/app al path para encontrar app.py
    sys.path.insert(0, '/app/services/api/app')
    
    uvicorn.run(
        "app:app",  # Ahora debería encontrar app.py en services/api/app/
        host=host,
        port=port,
        reload=True if os.getenv("DEBUG") else False,
        log_level="info"
    )