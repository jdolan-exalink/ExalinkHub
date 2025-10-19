import sqlite3
import os

def clear_demo_data():
    """Limpia todos los datos de demo de las bases de datos"""

    print("🧹 Iniciando limpieza de datos de demo...")

    # Base de datos de configuración
    if os.path.exists('DB/config.db'):
        print("\n📋 Limpiando config.db...")
        conn = sqlite3.connect('DB/config.db')
        cursor = conn.cursor()

        # Limpiar tablas manteniendo estructura
        tables_to_clear = [
            'servers', 'users', 'groups', 'backend_config',
            'server_status', 'user_groups', 'panel_config'
        ]

        for table in tables_to_clear:
            try:
                cursor.execute(f"DELETE FROM {table}")
                print(f"  ✅ {table}: limpiada")
            except Exception as e:
                print(f"  ❌ Error en {table}: {e}")

        # Resetear secuencias
        cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('servers', 'users', 'backend_config')")

        # Mantener solo configuración básica de app_settings
        cursor.execute("DELETE FROM app_settings WHERE key NOT IN ('theme', 'language', 'timezone_offset')")

        conn.commit()
        conn.close()
        print("✅ config.db limpiada")

    # Base de datos de matrículas
    if os.path.exists('DB/matriculas.db'):
        print("\n🚗 Limpiando matriculas.db...")
        conn = sqlite3.connect('DB/matriculas.db')
        cursor = conn.cursor()

        # Limpiar lecturas de matrículas
        cursor.execute("DELETE FROM lpr_readings")
        cursor.execute("DELETE FROM lpr_files")
        cursor.execute("DELETE FROM sqlite_sequence WHERE name='lpr_readings'")

        conn.commit()
        conn.close()
        print("✅ matriculas.db limpiada")

    # Base de datos de conteo
    if os.path.exists('DB/counting.db'):
        print("\n👥 Limpiando counting.db...")
        conn = sqlite3.connect('DB/counting.db')
        cursor = conn.cursor()

        # Limpiar datos de demo pero mantener configuración básica
        tables_to_clear = [
            'conteo_eventos', 'areas', 'access_points',
            'counting_events', 'measurements', 'parking_zones', 'parking_snapshots'
        ]

        for table in tables_to_clear:
            try:
                cursor.execute(f"DELETE FROM {table}")
                print(f"  ✅ {table}: limpiada")
            except Exception as e:
                print(f"  ❌ Error en {table}: {e}")

        # Resetear secuencias
        sequences_to_reset = ['areas', 'access_points', 'counting_events', 'measurements']
        for seq in sequences_to_reset:
            cursor.execute(f"DELETE FROM sqlite_sequence WHERE name='{seq}'")

        conn.commit()
        conn.close()
        print("✅ counting.db limpiada")

    # Base de datos de conteo vehicular
    if os.path.exists('DB/vehicle_counting.db'):
        print("\n🚙 Limpiando vehicle_counting.db...")
        conn = sqlite3.connect('DB/vehicle_counting.db')
        cursor = conn.cursor()

        # Limpiar todas las tablas
        tables_to_clear = [
            'vehicle_zone_configs', 'vehicle_transition_events', 'vehicle_count_stats'
        ]

        for table in tables_to_clear:
            try:
                cursor.execute(f"DELETE FROM {table}")
                print(f"  ✅ {table}: limpiada")
            except Exception as e:
                print(f"  ❌ Error en {table}: {e}")

        conn.commit()
        conn.close()
        print("✅ vehicle_counting.db limpiada")

    print("\n🎉 ¡Limpieza completada!")
    print("📝 Los esquemas de las bases de datos se mantuvieron intactos.")
    print("🔄 Listo para un despliegue limpio.")

if __name__ == "__main__":
    clear_demo_data()