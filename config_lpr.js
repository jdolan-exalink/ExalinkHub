const Database = require('better-sqlite3');
const path = require('path');

// Conectar a la base de datos del frontend
const dbPath = path.join(__dirname, 'DB', 'config.db');
console.log('Conectando a:', dbPath);

const db = new Database(dbPath);

console.log('=== CONFIGURACIÓN ACTUAL ===');

// Verificar paneles habilitados
const panels = db.prepare('SELECT * FROM panel_config WHERE enabled = 1').all();
console.log('Paneles habilitados:', panels.map(p => p.panel_name));

// Habilitar panel LPR
console.log('Habilitando panel LPR...');
const updateResult = db.prepare('UPDATE panel_config SET enabled = 1 WHERE panel_name = ?').run('lpr');
console.log('Resultado de actualización:', updateResult);

// Verificar servidores
const servers = db.prepare('SELECT * FROM servers').all();
console.log('Servidores configurados:', servers.length);

if (servers.length === 0) {
  console.log('Creando servidor Frigate por defecto...');
  const insertStmt = db.prepare('INSERT INTO servers (name, url, port, protocol, username, password, auth_type, enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const result = insertStmt.run('Servidor Principal', '10.1.1.252', 5000, 'http', 'admin', 'password', 'basic', 1);
  console.log('Servidor creado con ID:', result.lastInsertRowid);
}

// Verificar configuración backend
const backendConfigs = db.prepare('SELECT service_name, enabled FROM backend_config').all();
console.log('Configuración backend:', backendConfigs);

// Verificar configuración final
const finalPanels = db.prepare('SELECT * FROM panel_config WHERE enabled = 1').all();
console.log('Paneles finales habilitados:', finalPanels.map(p => p.panel_name));

db.close();
console.log('Configuración completada ');
