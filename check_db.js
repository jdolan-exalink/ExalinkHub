const Database = require('better-sqlite3');
const db = new Database('./DB/matriculas.db');

// Ver tablas disponibles
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tablas disponibles:', tables);

// Ver estructura de la tabla principal
if (tables.length > 0) {
  const tableName = tables[0].name;
  console.log(`Estructura de la tabla ${tableName}:`);
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  console.log(columns);

  // Ver algunos registros de ejemplo
  console.log('Primeros 5 registros:');
  const records = db.prepare(`SELECT * FROM ${tableName} LIMIT 5`).all();
  console.log(records);
}

db.close();