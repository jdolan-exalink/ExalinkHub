import Database from 'better-sqlite3';
import { join } from 'path';

export interface SavedView {
  id: number;
  name: string;
  layout: string;
  cameras: string; // JSON string
  created_at: string;
  updated_at: string;
}

export interface ViewCamera {
  position: number;
  camera_id: string | null;
}

export class ViewsDatabase {
  private db: Database.Database;

  constructor() {
    const dbPath = join(process.cwd(), 'DB', 'views.db');
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    // Crear tabla de vistas guardadas
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS saved_views (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        layout TEXT NOT NULL,
        cameras TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Crear tabla de configuración de la aplicación
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insertar configuración por defecto si no existe
    const defaultSettings = [
      { key: 'sidebar_collapsed', value: 'false' },
      { key: 'default_layout', value: '2x2' },
      { key: 'frigate_server_url', value: 'http://10.1.1.252:5000' }
    ];

    const insertSetting = this.db.prepare(`
      INSERT OR IGNORE INTO app_settings (key, value) VALUES (?, ?)
    `);

    for (const setting of defaultSettings) {
      insertSetting.run(setting.key, setting.value);
    }
  }

  // Métodos para vistas guardadas
  saveView(name: string, layout: string, cameras: ViewCamera[]): SavedView {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO saved_views (name, layout, cameras, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);
    
    const result = stmt.run(name, layout, JSON.stringify(cameras));
    return this.getViewById(result.lastInsertRowid as number)!;
  }

  getAllViews(): SavedView[] {
    const stmt = this.db.prepare(`
      SELECT * FROM saved_views ORDER BY updated_at DESC
    `);
    return stmt.all() as SavedView[];
  }

  getViewById(id: number): SavedView | null {
    const stmt = this.db.prepare(`
      SELECT * FROM saved_views WHERE id = ?
    `);
    return stmt.get(id) as SavedView | null;
  }

  getViewByName(name: string): SavedView | null {
    const stmt = this.db.prepare(`
      SELECT * FROM saved_views WHERE name = ?
    `);
    return stmt.get(name) as SavedView | null;
  }

  deleteView(id: number): boolean {
    const stmt = this.db.prepare(`
      DELETE FROM saved_views WHERE id = ?
    `);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  updateView(id: number, name: string, layout: string, cameras: ViewCamera[]): SavedView | null {
    const stmt = this.db.prepare(`
      UPDATE saved_views 
      SET name = ?, layout = ?, cameras = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    const result = stmt.run(name, layout, JSON.stringify(cameras), id);
    return result.changes > 0 ? this.getViewById(id) : null;
  }

  // Métodos para configuración de la aplicación
  getSetting(key: string): string | null {
    const stmt = this.db.prepare(`
      SELECT value FROM app_settings WHERE key = ?
    `);
    const result = stmt.get(key) as { value: string } | undefined;
    return result?.value || null;
  }

  setSetting(key: string, value: string): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO app_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `);
    stmt.run(key, value);
  }

  getAllSettings(): Record<string, string> {
    const stmt = this.db.prepare(`
      SELECT key, value FROM app_settings
    `);
    const results = stmt.all() as { key: string; value: string }[];
    
    const settings: Record<string, string> = {};
    for (const { key, value } of results) {
      settings[key] = value;
    }
    return settings;
  }

  // Método para cerrar la base de datos
  close(): void {
    this.db.close();
  }
}

// Instancia singleton
let dbInstance: ViewsDatabase | null = null;

export function getDatabase(): ViewsDatabase {
  if (!dbInstance) {
    dbInstance = new ViewsDatabase();
  }
  return dbInstance;
}