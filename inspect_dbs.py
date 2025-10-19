import sqlite3
import os

# Función para ver tablas y contenido
def inspect_db(db_path):
    if not os.path.exists(db_path):
        print(f'Base de datos no encontrada: {db_path}')
        return

    print(f'\n=== {os.path.basename(db_path)} ===')
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Ver tablas
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print(f'Tablas: {[t[0] for t in tables]}')

    # Ver contenido de cada tabla
    for table_name, in tables:
        cursor.execute(f'SELECT COUNT(*) FROM {table_name}')
        count = cursor.fetchone()[0]
        print(f'  {table_name}: {count} registros')

        if count > 0 and count < 10:  # Solo mostrar si hay pocos registros
            cursor.execute(f'SELECT * FROM {table_name} LIMIT 3')
            rows = cursor.fetchall()
            for row in rows:
                print(f'    {row}')

    conn.close()

# Inspeccionar todas las bases de datos
dbs = ['DB/config.db', 'DB/matriculas.db', 'DB/counting.db', 'DB/vehicle_counting.db']
for db in dbs:
    inspect_db(db)