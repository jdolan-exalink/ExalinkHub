const Database = require('better-sqlite3');
const db = new Database('./DB/config.db');

// Habilitar el servicio LPR
const updateStmt = db.prepare('UPDATE backend_config SET enabled = 1, auto_start = 1 WHERE service_name = ?');
const result = updateStmt.run('LPR (Matrículas)');

console.log(`Servicio LPR habilitado. Filas afectadas: ${result.changes}`);

// Verificar el cambio
const configs = db.prepare("SELECT service_name, enabled, auto_start FROM backend_config WHERE service_name = 'LPR (Matrículas)'").all();
console.log('Estado actual del servicio LPR:', configs);

db.close();