const path = require('path');
const fs = require('fs');
try {
  const dbPath = path.join(process.cwd(), 'DB', 'config.db');
  if (!fs.existsSync(dbPath)) {
    console.error(JSON.stringify({ error: 'db_not_found', path: dbPath }));
    process.exit(2);
  }
  const Database = require('better-sqlite3');
  const db = new Database(dbPath, { readonly: true });
  const servers = db.prepare('SELECT * FROM servers ORDER BY id').all();
  const users = db.prepare('SELECT id, username, role, enabled FROM users ORDER BY id').all();
  console.log(JSON.stringify({ servers, users }, null, 2));
  process.exit(0);
} catch (err) {
  console.error(JSON.stringify({ error: 'inspect_failed', message: err.message, stack: err.stack }));
  process.exit(1);
}
