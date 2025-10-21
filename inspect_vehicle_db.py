import sqlite3

conn = sqlite3.connect('DB/vehicle_counting.db')
cursor = conn.cursor()

# Ver tablas
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = cursor.fetchall()
print('Tablas en vehicle_counting.db:')
for table in tables:
    print(f'  {table[0]}')
    cursor.execute(f'PRAGMA table_info({table[0]})')
    columns = cursor.fetchall()
    for col in columns:
        print(f'    {col[1]} ({col[2]})')

# Ver algunos datos de ejemplo
print('\nDatos de ejemplo:')
for table in tables:
    table_name = table[0]
    try:
        cursor.execute(f'SELECT * FROM {table_name} LIMIT 5')
        rows = cursor.fetchall()
        print(f'\n{table_name} (primeros 5 registros):')
        for row in rows:
            print(f'  {row}')
    except:
        print(f'  Error leyendo {table_name}')

conn.close()