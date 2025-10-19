import sqlite3
import os

db_path = r'.\DB\Matriculas.db'

print(f"🔧 Consolidando base de datos: {db_path}")

try:
    conn = sqlite3.connect(db_path)
    
    # Hacer checkpoint para consolidar WAL
    print("📝 Ejecutando PRAGMA wal_checkpoint(TRUNCATE)...")
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    
    # Verificar integridad
    print("🔍 Verificando integridad de la base de datos...")
    result = conn.execute("PRAGMA integrity_check").fetchone()
    print(f"   Resultado: {result[0]}")
    
    # Mostrar estadísticas
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM events")
    count = cur.fetchone()[0]
    print(f"\n📊 Total de eventos: {count}")
    
    # Mostrar últimos eventos con plate y speed
    cur.execute("SELECT id, camera, plate, speed FROM events WHERE plate IS NOT NULL OR speed IS NOT NULL ORDER BY id DESC LIMIT 3")
    rows = cur.fetchall()
    print("\n📋 Últimos eventos con plate/speed:")
    for row in rows:
        print(f"   ID:{row[0]} | Cámara:{row[1]} | Matrícula:{row[2]} | Velocidad:{row[3]}")
    
    conn.close()
    print("\n✅ Base de datos consolidada correctamente")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
