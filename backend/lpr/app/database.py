"""
Configuración y gestión de la base de datos SQLite para el sistema LPR

Maneja la conexión a la base de datos matriculas.db ubicada en la carpeta DB/
siguiendo las convenciones del proyecto ExalinkHub.
"""

import os
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.engine import Engine
import sqlite3

# Configuración de la base de datos
DB_DIR = "DB"  # Carpeta donde se almacena la base de datos
DB_NAME = "matriculas.db"  # Nombre del archivo de base de datos

# Crear directorio si no existe
os.makedirs(DB_DIR, exist_ok=True)

# Ruta completa de la base de datos
DB_PATH = os.path.join(DB_DIR, DB_NAME)

# URL de conexión SQLAlchemy
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

# Configuración del engine con optimizaciones para SQLite
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={
        "check_same_thread": False,  # Permite múltiples threads
        "timeout": 30,  # Timeout de 30 segundos para conexiones
    },
    echo=False,  # Cambiar a True para debug de SQL
    pool_pre_ping=True,  # Verifica conexiones antes de usarlas
    pool_recycle=3600,  # Recicla conexiones cada hora
)

# Configuración de optimizaciones SQLite
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """
    Configura pragmas de SQLite para optimizar rendimiento
    
    Se ejecuta cada vez que se establece una nueva conexión.
    """
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        
        # Habilitar claves foráneas
        cursor.execute("PRAGMA foreign_keys=ON")
        
        # Configurar WAL mode para mejor concurrencia
        cursor.execute("PRAGMA journal_mode=WAL")
        
        # Configurar sincronización para mejor rendimiento
        cursor.execute("PRAGMA synchronous=NORMAL")
        
        # Configurar cache de páginas (32MB)
        cursor.execute("PRAGMA cache_size=-32000")
        
        # Habilitar análisis automático de consultas
        cursor.execute("PRAGMA analysis_limit=1000")
        
        # Configurar timeout para bloqueos
        cursor.execute("PRAGMA busy_timeout=30000")
        
        cursor.close()

# Factory de sesiones
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Base declarativa para modelos
Base = declarative_base()

def get_database_session() -> Session:
    """
    Genera una nueva sesión de base de datos
    
    Usar con dependency injection en FastAPI:
    @app.get("/endpoint")
    def endpoint(db: Session = Depends(get_database_session)):
        ...
    
    Returns:
        Session: Nueva sesión de base de datos
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_database():
    """
    Inicializa la base de datos creando todas las tablas
    
    Debe llamarse al inicio de la aplicación para asegurar
    que todas las tablas existan.
    """
    from app.models import Base
    
    try:
        # Crear todas las tablas
        Base.metadata.create_all(bind=engine)
        print(f"✅ Base de datos inicializada: {DB_PATH}")
        
        # Verificar que la base de datos es accesible
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
        print("✅ Conexión a la base de datos verificada")
        
    except Exception as e:
        print(f"❌ Error al inicializar la base de datos: {str(e)}")
        raise

def get_database_info() -> dict:
    """
    Obtiene información sobre la base de datos
    
    Returns:
        dict: Información de la base de datos incluyendo tamaño y estadísticas
    """
    try:
        # Obtener tamaño del archivo
        db_size = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0
        
        # Obtener estadísticas de la base de datos
        with SessionLocal() as session:
            # Contar registros en tabla principal
            plate_events_count = session.execute(
                text("SELECT COUNT(*) FROM plate_events")
            ).scalar() or 0
            
            # Obtener información de la base de datos
            db_info = session.execute(text("PRAGMA database_list")).fetchall()
            page_count = session.execute(text("PRAGMA page_count")).scalar()
            page_size = session.execute(text("PRAGMA page_size")).scalar()
            
        return {
            "database_path": DB_PATH,
            "database_size_bytes": db_size,
            "database_size_mb": round(db_size / (1024 * 1024), 2),
            "plate_events_count": plate_events_count,
            "page_count": page_count,
            "page_size": page_size,
            "estimated_size": page_count * page_size if page_count and page_size else 0,
            "accessible": True
        }
        
    except Exception as e:
        return {
            "database_path": DB_PATH,
            "error": str(e),
            "accessible": False
        }

def optimize_database():
    """
    Ejecuta operaciones de optimización en la base de datos
    
    Incluye VACUUM, ANALYZE y otras operaciones de mantenimiento.
    Debe ejecutarse periódicamente para mantener el rendimiento.
    """
    try:
        with SessionLocal() as session:
            print("🔧 Iniciando optimización de la base de datos...")
            
            # Análisis de estadísticas para el optimizador de consultas
            session.execute(text("ANALYZE"))
            print("✅ Análisis de estadísticas completado")
            
            # Nota: VACUUM se puede hacer pero bloquea la base de datos
            # session.execute("VACUUM")
            # print("✅ VACUUM completado")
            
            # Verificar integridad
            integrity_check = session.execute(text("PRAGMA integrity_check")).fetchone()
            if integrity_check and integrity_check[0] == "ok":
                print("✅ Verificación de integridad exitosa")
            else:
                print(f"⚠️ Problemas de integridad: {integrity_check}")
                
        print("✅ Optimización de la base de datos completada")
        
    except Exception as e:
        print(f"❌ Error durante la optimización: {str(e)}")
        raise

def backup_database(backup_path: str = None) -> str:
    """
    Crea una copia de seguridad de la base de datos
    
    Args:
        backup_path: Ruta donde crear el backup. Si no se especifica,
                    se crea en la misma carpeta con timestamp.
    
    Returns:
        str: Ruta del archivo de backup creado
    """
    import shutil
    from datetime import datetime
    
    if backup_path is None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = os.path.join(DB_DIR, f"matriculas_backup_{timestamp}.db")
    
    try:
        if os.path.exists(DB_PATH):
            shutil.copy2(DB_PATH, backup_path)
            print(f"✅ Backup creado: {backup_path}")
            return backup_path
        else:
            raise FileNotFoundError(f"La base de datos no existe: {DB_PATH}")
            
    except Exception as e:
        print(f"❌ Error al crear backup: {str(e)}")
        raise

# Función de utilidad para testing
def create_test_database(test_db_path: str = ":memory:") -> tuple:
    """
    Crea una base de datos de prueba en memoria
    
    Args:
        test_db_path: Ruta de la base de datos de prueba
    
    Returns:
        tuple: (engine, SessionLocal) para testing
    """
    test_engine = create_engine(
        f"sqlite:///{test_db_path}",
        connect_args={"check_same_thread": False},
        echo=False
    )
    
    TestSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=test_engine
    )
    
    # Crear tablas
    from app.models import Base
    Base.metadata.create_all(bind=test_engine)
    
    return test_engine, TestSessionLocal