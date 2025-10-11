/**
 * Script de migración para agregar la columna auto_start a la tabla backend_config
 * Se ejecuta automáticamente al inicializar la base de datos
 */

import { getConfigDatabase } from './config-database';

/**
 * Ejecuta la migración de auto_start usando una instancia de ConfigDatabase
 * @param db Instancia de ConfigDatabase
 */
export function runAutoStartMigration(db: any) {
  try {

    // Verificar si la columna auto_start ya existe intentando una consulta que la use
    try {
      // Intentar una consulta que incluya la columna auto_start usando un método público
  const configs = db.getAllBackendConfigs();
      // Si podemos obtener las configs y alguna tiene auto_start definido, la columna existe
  const hasAutoStart = configs.some((config: any) => config.auto_start !== undefined);
      if (hasAutoStart) {
        console.log('ℹ️ Columna auto_start ya existe, migración omitida');
        return;
      }
    } catch (error: any) {
      // Si hay un error al obtener las configs, probablemente la columna no existe
      console.log('🔄 Migrando tabla backend_config: agregando columna auto_start...');
      db.runMigration('ALTER TABLE backend_config ADD COLUMN auto_start BOOLEAN DEFAULT 0');
      console.log('✅ Migración completada: columna auto_start agregada');
      return;
    }

    // Si no hay error pero no se detectó la columna, intentar la migración
    console.log('🔄 Migrando tabla backend_config: agregando columna auto_start...');
    db.runMigration('ALTER TABLE backend_config ADD COLUMN auto_start BOOLEAN DEFAULT 0');
    console.log('✅ Migración completada: columna auto_start agregada');

  } catch (error) {
    console.error('❌ Error durante la migración de auto_start:', error);
  }
}