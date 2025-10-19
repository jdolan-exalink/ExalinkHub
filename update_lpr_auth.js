const Database = require('better-sqlite3');
const path = require('path');

const DB_DIR = path.join(process.cwd(), 'DB');
const CONFIG_DB_PATH = path.join(DB_DIR, 'config.db');

try {
  const db = new Database(CONFIG_DB_PATH);

  // Obtener configuración LPR actual
  const lprConfig = db.prepare('SELECT * FROM backend_config WHERE service_name = ?').get('LPR (Matrículas)');

  if (lprConfig) {
    // Parsear configuración actual
    let config = {};
    try {
      config = JSON.parse(lprConfig.config);
    } catch (e) {
      console.error('Error parseando config actual:', e);
    }

    // Agregar credenciales de autenticación
    config.lpr_auth_username = 'admin';
    config.lpr_auth_password = 'admin123';

    // Actualizar configuración
    const updatedConfig = JSON.stringify(config);
    const result = db.prepare(`
      UPDATE backend_config
      SET config = ?, updated_at = CURRENT_TIMESTAMP
      WHERE service_name = ?
    `).run(updatedConfig, 'LPR (Matrículas)');

    console.log('Configuración LPR actualizada con credenciales de autenticación');
    console.log('Nueva configuración:', config);
    console.log('Resultado update:', result);
  } else {
    console.error('No se encontró configuración LPR');
  }

  db.close();
} catch (error) {
  console.error('Error:', error);
}