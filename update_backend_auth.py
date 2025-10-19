#!/usr/bin/env python3
"""
Script para actualizar las credenciales de autenticación del backend LPR
"""
import sqlite3
import hashlib

def hash_password(password: str) -> str:
    """Hashea la contraseña usando SHA256"""
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    return f"sha256:{password_hash}"

db_path = './DB/matriculas.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("=== Actualizando Credenciales de Autenticación ===\n")

# Nuevas credenciales
username = "admin"
password = "admin123"
hashed_password = hash_password(password)

print(f"Usuario: {username}")
print(f"Password: {password}")
print(f"Hash: {hashed_password}\n")

# Verificar si existe la tabla system_config
cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='system_config'")
if not cursor.fetchone():
    print("❌ Tabla system_config no existe. Creándola...")
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            type TEXT DEFAULT 'string',
            description TEXT
        )
    """)
    conn.commit()
    print("✅ Tabla creada")

# Actualizar o insertar credenciales
try:
    from datetime import datetime
    now = datetime.now().isoformat()
    
    # Actualizar usuario (ya existe)
    cursor.execute("""
        UPDATE system_config 
        SET config_value = ?, updated_at = ?
        WHERE config_key = 'auth_username'
    """, (username, now))
    
    # Verificar si auth_password existe
    cursor.execute("SELECT id FROM system_config WHERE config_key = 'auth_password'")
    if cursor.fetchone():
        # Actualizar contraseña existente
        cursor.execute("""
            UPDATE system_config 
            SET config_value = ?, updated_at = ?
            WHERE config_key = 'auth_password'
        """, (hashed_password, now))
    else:
        # Insertar nueva contraseña
        cursor.execute("""
            INSERT INTO system_config (config_key, config_value, config_type, description, created_at, updated_at)
            VALUES ('auth_password', ?, 'string', 'Contraseña de autenticación (hasheada)', ?, ?)
        """, (hashed_password, now, now))
    
    # Asegurar que auth_enabled esté en True
    cursor.execute("""
        UPDATE system_config 
        SET config_value = 'True', updated_at = ?
        WHERE config_key = 'auth_enabled'
    """, (now,))
    
    conn.commit()
    print("✅ Credenciales actualizadas exitosamente\n")
    
    # Verificar
    print("=== Verificación ===")
    cursor.execute("SELECT config_key, config_value FROM system_config WHERE config_key LIKE 'auth%'")
    for key, value in cursor.fetchall():
        if 'password' in key.lower():
            print(f"  {key}: {value[:20]}...")
        else:
            print(f"  {key}: {value}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    conn.rollback()
finally:
    conn.close()

print("\n✅ Proceso completado")
