const Database = require('better-sqlite3');
const db = new Database('./DB/config.db');

console.log('=== Actualizando Configuración LPR ===\n');

// Obtener configuración actual
const row = db.prepare('SELECT config FROM backend_config WHERE service_name = ?').get('LPR (Matrículas)');

if (row) {
    const config = JSON.parse(row.config);
    console.log('Configuración anterior:', JSON.stringify(config, null, 2));
    
    // Agregar campos de conectividad
    config.backend_host = 'exalink-lpr-backend';
    config.api_port = 2221;
    config.lpr_port = 2221;
    
    console.log('\nNueva configuración:', JSON.stringify(config, null, 2));
    
    // Actualizar en la base de datos
    db.prepare('UPDATE backend_config SET config = ? WHERE service_name = ?')
      .run(JSON.stringify(config), 'LPR (Matrículas)');
    
    console.log('\n✅ Configuración actualizada exitosamente');
} else {
    console.log('❌ No se encontró configuración para LPR');
}

db.close();
