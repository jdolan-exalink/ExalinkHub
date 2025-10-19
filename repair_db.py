import sqlite3
import os

db_path = 'DB/Matriculas.db'

try:
    # Conectar a la base de datos
    conn = sqlite3.connect(db_path)

    # Ejecutar checkpoint para escribir todos los cambios pendientes
    conn.execute('PRAGMA wal_checkpoint(TRUNCATE);')

    # Verificar integridad
    result = conn.execute('PRAGMA integrity_check;').fetchone()
    print(f"Integrity check: {result[0]}")

    # Obtener estadísticas
    stats = conn.execute('SELECT COUNT(*) FROM events;').fetchone()
    print(f"Total events in database: {stats[0]}")

    conn.close()

    # Verificar si los archivos WAL/SHM existen y eliminarlos
    wal_file = db_path + '-wal'
    shm_file = db_path + '-shm'

    if os.path.exists(wal_file):
        os.remove(wal_file)
        print("Removed WAL file")

    if os.path.exists(shm_file):
        os.remove(shm_file)
        print("Removed SHM file")

    print("Database repair completed successfully")

except Exception as e:
    print(f"Error repairing database: {e}")