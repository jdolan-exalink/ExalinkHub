import sqlite3

# Revisar la base de datos del backend de conteo
conn = sqlite3.connect('backend/Conteo/DB/Conteo.db')
cursor = conn.cursor()

cursor.execute('SELECT name FROM sqlite_master WHERE type="table"')
tables = cursor.fetchall()
print('Tablas en backend/Conteo/DB/Conteo.db:')
for table in tables:
    table_name = table[0]
    print(f'  {table_name}')
    try:
        cursor.execute(f'SELECT COUNT(*) FROM {table_name}')
        count = cursor.fetchone()[0]
        print(f'    Registros: {count}')
        if count > 0:
            cursor.execute(f'SELECT * FROM {table_name} ORDER BY id DESC LIMIT 3')
            rows = cursor.fetchall()
            print(f'    Últimos registros:')
            for row in rows:
                print(f'      {row}')
    except Exception as e:
        print(f'    Error: {e}')
    print()

conn.close()