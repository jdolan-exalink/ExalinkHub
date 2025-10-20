const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./DB/matriculas.db');

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plate TEXT,
      score REAL,
      speed REAL,
      camera TEXT,
      ts DATETIME,
      payload_json TEXT,
      snapshot_path TEXT,
      clip_path TEXT,
      plate_crop_path TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) {
      console.error('Error creando tabla:', err);
    } else {
      console.log('✅ Tabla events creada exitosamente');
    }
    db.close();
  });
});