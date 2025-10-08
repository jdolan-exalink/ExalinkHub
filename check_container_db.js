const Database = require('better-sqlite3');
const db = new Database('./DB/config_container.db');

// Ver tablas disponibles
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tablas disponibles en config_container.db:', tables);

// Ver contenido de backend_config
console.log('Contenido de backend_config en contenedor:');
const configs = db.prepare("SELECT * FROM backend_config").all();
console.log(JSON.stringify(configs, null, 2));

db.close();