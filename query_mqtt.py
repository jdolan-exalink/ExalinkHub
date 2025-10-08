import sqlite3

conn = sqlite3.connect('DB/config.db')
cursor = conn.cursor()

# Consultar configuración MQTT en backend_config
cursor.execute("SELECT service_name, config FROM backend_config WHERE service_name LIKE '%LPR%'")
results = cursor.fetchall()

print("Configuración LPR:")
for row in results:
    print(f"Servicio: {row[0]}")
    print(f"Config: {row[1]}")
    print()

conn.close()