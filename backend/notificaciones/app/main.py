from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import time
import json
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional, Dict, Any
import asyncio

app = FastAPI(title="Notificaciones Backend", version="0.1.0")

# Configurar CORS para permitir conexiones desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, especificar los orígenes permitidos
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

start_time = time.time()

# Estado global del backend
notifications_sent = 0
active_channels = []
notification_history = []

# Archivo de configuración
CONFIG_FILE = "config/notifications_config.json"

# Asegurar que existe el directorio de configuración
os.makedirs("config", exist_ok=True)

# Modelos Pydantic para configuración
class NotificationConfig(BaseModel):
    enabled: bool = False
    title: str = "Sistema de Notificaciones"
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    use_tls: bool = True
    default_sender: str = ""
    admin_emails: List[str] = []
    notification_types: Dict[str, bool] = {
        "lpr_detected": True,
        "counting_threshold": True,
        "system_alerts": True,
        "maintenance": False
    }
    templates: Dict[str, str] = {}
    config_json: str = "{}"

class NotificationPreferences(BaseModel):
    theme: str = "light"
    language: str = "es"
    email_notifications: bool = True
    push_notifications: bool = False
    notification_filters: Dict[str, bool] = {}
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None

class EmailRequest(BaseModel):
    to: List[str]
    subject: str
    body: str
    notification_type: str = "general"

class NotificationHistoryItem(BaseModel):
    id: str
    timestamp: float
    type: str
    recipient: str
    subject: str
    status: str
    error_message: Optional[str] = None

# Funciones de utilidad para configuración
def load_config() -> NotificationConfig:
    """Carga la configuración desde archivo"""
    try:
        if os.path.exists(CONFIG_FILE):
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return NotificationConfig(**data)
    except Exception as e:
        print(f"Error loading config: {e}")

    # Retornar configuración por defecto
    return NotificationConfig()

def save_config(config: NotificationConfig) -> bool:
    """Guarda la configuración en archivo"""
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config.dict(), f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving config: {e}")
        return False

def load_preferences() -> NotificationPreferences:
    """Carga las preferencias desde archivo"""
    prefs_file = "config/notifications_preferences.json"
    try:
        if os.path.exists(prefs_file):
            with open(prefs_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return NotificationPreferences(**data)
    except Exception as e:
        print(f"Error loading preferences: {e}")

    # Retornar preferencias por defecto
    return NotificationPreferences()

def save_preferences(prefs: NotificationPreferences) -> bool:
    """Guarda las preferencias en archivo"""
    prefs_file = "config/notifications_preferences.json"
    try:
        with open(prefs_file, 'w', encoding='utf-8') as f:
            json.dump(prefs.dict(), f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"Error saving preferences: {e}")
        return False

# Funciones de envío de email
async def send_email_async(to: List[str], subject: str, body: str) -> tuple[bool, str]:
    """Envía un email de forma asíncrona"""
    global notifications_sent

    config = load_config()
    if not config.enabled or not config.smtp_username or not config.smtp_password:
        return False, "Servicio de notificaciones no configurado"

    try:
        # Crear mensaje
        msg = MIMEMultipart()
        msg['From'] = config.default_sender
        msg['To'] = ', '.join(to)
        msg['Subject'] = subject

        # Agregar cuerpo del mensaje
        msg.attach(MIMEText(body, 'html'))

        # Conectar al servidor SMTP
        server = smtplib.SMTP(config.smtp_server, config.smtp_port)
        if config.use_tls:
            server.starttls()

        server.login(config.smtp_username, config.smtp_password)
        text = msg.as_string()
        server.sendmail(config.default_sender, to, text)
        server.quit()

        notifications_sent += 1
        return True, "Email enviado exitosamente"

    except Exception as e:
        return False, f"Error enviando email: {str(e)}"

def add_to_history(notification_type: str, recipient: str, subject: str, status: str, error_message: Optional[str] = None):
    """Agrega una entrada al historial de notificaciones"""
    global notification_history

    item = NotificationHistoryItem(
        id=f"{int(time.time())}_{len(notification_history)}",
        timestamp=time.time(),
        type=notification_type,
        recipient=recipient,
        subject=subject,
        status=status,
        error_message=error_message
    )

    notification_history.append(item.dict())

    # Mantener solo las últimas 1000 notificaciones
    if len(notification_history) > 1000:
        notification_history = notification_history[-1000:]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/metrics")
def metrics():
    """Obtiene métricas de notificaciones"""
    config = load_config()
    uptime = int(time.time() - start_time)

    return {
        "uptime": uptime,
        "notifications_sent": notifications_sent,
        "active_channels": len(active_channels),
        "config_enabled": config.enabled,
        "smtp_configured": bool(config.smtp_username and config.smtp_password)
    }

# Endpoints de configuración
@app.get("/config", response_model=NotificationConfig)
def get_config():
    """Obtiene la configuración actual del sistema de notificaciones"""
    return load_config()

@app.post("/config")
def update_config(config: NotificationConfig):
    """Actualiza la configuración del sistema de notificaciones"""
    if save_config(config):
        return {"status": "success", "message": "Configuración actualizada"}
    else:
        raise HTTPException(status_code=500, detail="Error al guardar configuración")

@app.get("/preferences", response_model=NotificationPreferences)
def get_preferences():
    """Obtiene las preferencias de usuario"""
    return load_preferences()

@app.post("/preferences")
def update_preferences(prefs: NotificationPreferences):
    """Actualiza las preferencias de usuario"""
    if save_preferences(prefs):
        return {"status": "success", "message": "Preferencias actualizadas"}
    else:
        raise HTTPException(status_code=500, detail="Error al guardar preferencias")

@app.post("/send-email")
async def send_email(request: EmailRequest):
    """Envía un email de notificación"""
    success, message = await send_email_async(request.to, request.subject, request.body)

    # Agregar al historial
    status = "sent" if success else "failed"
    for recipient in request.to:
        add_to_history(request.notification_type, recipient, request.subject, status,
                      None if success else message)

    if success:
        return {"status": "success", "message": message}
    else:
        raise HTTPException(status_code=500, detail=message)

@app.get("/history")
def get_history(limit: int = 50):
    """Obtiene el historial de notificaciones"""
    return notification_history[-limit:]

@app.get("/status")
def get_status():
    """Obtiene el estado completo del sistema de notificaciones"""
    config = load_config()
    uptime = int(time.time() - start_time)

    return {
        "config": config.dict(),
        "status": {
            "running": config.enabled,
            "uptime": uptime,
            "notifications_sent": notifications_sent,
            "active_channels": active_channels,
            "smtp_ready": bool(config.smtp_username and config.smtp_password)
        },
        "preferences": load_preferences().dict(),
        "history_count": len(notification_history)
    }

@app.post("/test-email")
async def test_email(to: str):
    """Envía un email de prueba"""
    subject = "Prueba de Notificaciones - ExalinkHub"
    body = """
    <h2>Prueba de Sistema de Notificaciones</h2>
    <p>Este es un email de prueba enviado desde el backend de notificaciones de ExalinkHub.</p>
    <p>Si recibió este email, el sistema está funcionando correctamente.</p>
    <p>Fecha y hora: {time.strftime('%Y-%m-%d %H:%M:%S')}</p>
    """

    success, message = await send_email_async([to], subject, body)

    # Agregar al historial
    status = "sent" if success else "failed"
    add_to_history("test", to, subject, status, None if success else message)

    if success:
        return {"status": "success", "message": "Email de prueba enviado"}
    else:
        raise HTTPException(status_code=500, detail=message)