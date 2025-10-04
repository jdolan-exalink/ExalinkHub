/**
 * Base de datos SQLite para el sistema LPR
 * Almacena lecturas de matrículas en tiempo real
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Esquema de la base de datos
export interface LPRReading {
  id: number;
  event_id: string;
  server_id: string;
  server_name: string;
  camera: string;
  plate: string;
  confidence: number;
  timestamp: number;
  end_time?: number;
  vehicle_type?: string;
  speed?: number;
  direction?: string;
  has_clip: boolean;
  has_snapshot: boolean;
  score: number;
  box?: string; // JSON stringified
  
  // Archivos locales
  snapshot_path?: string;
  clip_path?: string;
  crop_path?: string;
  
  // Metadatos
  created_at: number;
  updated_at: number;
}

export interface LPRFile {
  id: number;
  event_id: string;
  file_type: 'snapshot' | 'clip' | 'crop';
  original_url: string;
  local_path: string;
  file_size: number;
  downloaded_at: number;
  hash?: string;
}

export interface LPRStats {
  total_readings: number;
  unique_plates: number;
  today_readings: number;
  cameras_active: number;
  average_confidence: number;
  last_reading?: number;
}

class LPRDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    // Crear directorio de datos si no existe
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.dbPath = path.join(dataDir, 'lpr-readings.db');
    this.db = new Database(this.dbPath);
    this.initializeSchema();
  }

  private initializeSchema() {
    // Habilitar WAL mode para mejor rendimiento
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');

    // Tabla principal de lecturas LPR
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS lpr_readings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT UNIQUE NOT NULL,
        server_id TEXT NOT NULL,
        server_name TEXT NOT NULL,
        camera TEXT NOT NULL,
        plate TEXT NOT NULL,
        confidence REAL NOT NULL,
        timestamp INTEGER NOT NULL,
        end_time INTEGER,
        vehicle_type TEXT,
        speed REAL,
        direction TEXT,
        has_clip BOOLEAN NOT NULL DEFAULT 0,
        has_snapshot BOOLEAN NOT NULL DEFAULT 0,
        score REAL NOT NULL DEFAULT 0,
        box TEXT,
        
        snapshot_path TEXT,
        clip_path TEXT,
        crop_path TEXT,
        
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    // Tabla de archivos descargados
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS lpr_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT NOT NULL,
        file_type TEXT NOT NULL CHECK (file_type IN ('snapshot', 'clip', 'crop')),
        original_url TEXT NOT NULL,
        local_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        downloaded_at INTEGER NOT NULL DEFAULT (unixepoch()),
        hash TEXT,
        
        FOREIGN KEY (event_id) REFERENCES lpr_readings(event_id) ON DELETE CASCADE
      )
    `);

    // Índices para optimizar consultas
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_lpr_timestamp ON lpr_readings(timestamp);
      CREATE INDEX IF NOT EXISTS idx_lpr_camera ON lpr_readings(camera);
      CREATE INDEX IF NOT EXISTS idx_lpr_plate ON lpr_readings(plate);
      CREATE INDEX IF NOT EXISTS idx_lpr_server ON lpr_readings(server_id);
      CREATE INDEX IF NOT EXISTS idx_lpr_confidence ON lpr_readings(confidence);
      CREATE INDEX IF NOT EXISTS idx_files_event ON lpr_files(event_id);
      CREATE INDEX IF NOT EXISTS idx_files_type ON lpr_files(file_type);
    `);

    // Trigger para actualizar updated_at
    this.db.exec(`
      CREATE TRIGGER IF NOT EXISTS update_lpr_readings_timestamp 
      AFTER UPDATE ON lpr_readings
      BEGIN
        UPDATE lpr_readings SET updated_at = unixepoch() WHERE id = NEW.id;
      END
    `);

    console.log('✓ Base de datos LPR inicializada:', this.dbPath);
  }

  // Insertar nueva lectura LPR
  public insertReading(reading: Omit<LPRReading, 'id' | 'created_at' | 'updated_at'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO lpr_readings (
        event_id, server_id, server_name, camera, plate, confidence,
        timestamp, end_time, vehicle_type, speed, direction,
        has_clip, has_snapshot, score, box,
        snapshot_path, clip_path, crop_path
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?
      )
    `);

    const result = stmt.run(
      reading.event_id,
      reading.server_id,
      reading.server_name,
      reading.camera,
      reading.plate,
      reading.confidence,
      reading.timestamp,
      reading.end_time,
      reading.vehicle_type,
      reading.speed,
      reading.direction,
      reading.has_clip ? 1 : 0,
      reading.has_snapshot ? 1 : 0,
      reading.score,
      reading.box,
      reading.snapshot_path,
      reading.clip_path,
      reading.crop_path
    );

    return result.lastInsertRowid as number;
  }

  // Actualizar rutas de archivos locales
  public updateLocalPaths(eventId: string, paths: {
    snapshot_path?: string;
    clip_path?: string;
    crop_path?: string;
  }): void {
    const setParts: string[] = [];
    const values: any[] = [];

    if (paths.snapshot_path) {
      setParts.push('snapshot_path = ?');
      values.push(paths.snapshot_path);
    }
    if (paths.clip_path) {
      setParts.push('clip_path = ?');
      values.push(paths.clip_path);
    }
    if (paths.crop_path) {
      setParts.push('crop_path = ?');
      values.push(paths.crop_path);
    }

    if (setParts.length === 0) return;

    values.push(eventId);
    
    const stmt = this.db.prepare(`
      UPDATE lpr_readings 
      SET ${setParts.join(', ')}, updated_at = unixepoch()
      WHERE event_id = ?
    `);

    stmt.run(...values);
  }

  // Registrar archivo descargado
  public insertFile(file: Omit<LPRFile, 'id' | 'downloaded_at'>): number {
    const stmt = this.db.prepare(`
      INSERT INTO lpr_files (event_id, file_type, original_url, local_path, file_size, hash)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      file.event_id,
      file.file_type,
      file.original_url,
      file.local_path,
      file.file_size,
      file.hash
    );

    return result.lastInsertRowid as number;
  }

  // Buscar lecturas con filtros
  public searchReadings(filters: {
    afterTimestamp?: number;
    beforeTimestamp?: number;
    cameras?: string[];
    plates?: string[];
    minConfidence?: number;
    limit?: number;
    offset?: number;
  } = {}): LPRReading[] {
    let query = 'SELECT * FROM lpr_readings WHERE 1=1';
    const params: any[] = [];

    if (filters.afterTimestamp) {
      query += ' AND timestamp >= ?';
      params.push(filters.afterTimestamp);
    }

    if (filters.beforeTimestamp) {
      query += ' AND timestamp <= ?';
      params.push(filters.beforeTimestamp);
    }

    if (filters.cameras && filters.cameras.length > 0) {
      query += ` AND camera IN (${filters.cameras.map(() => '?').join(',')})`;
      params.push(...filters.cameras);
    }

    if (filters.plates && filters.plates.length > 0) {
      query += ` AND plate IN (${filters.plates.map(() => '?').join(',')})`;
      params.push(...filters.plates);
    }

    if (filters.minConfidence) {
      query += ' AND confidence >= ?';
      params.push(filters.minConfidence);
    }

    query += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
      
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const stmt = this.db.prepare(query);
    return stmt.all(...params) as LPRReading[];
  }

  // Obtener estadísticas
  public getStats(): LPRStats {
    const today = Math.floor(Date.now() / 1000) - (24 * 60 * 60); // Hace 24 horas

    const totalReadings = this.db.prepare('SELECT COUNT(*) as count FROM lpr_readings').get() as { count: number };
    
    const uniquePlates = this.db.prepare('SELECT COUNT(DISTINCT plate) as count FROM lpr_readings').get() as { count: number };
    
    const todayReadings = this.db.prepare('SELECT COUNT(*) as count FROM lpr_readings WHERE timestamp >= ?').get(today) as { count: number };
    
    const activeCameras = this.db.prepare('SELECT COUNT(DISTINCT camera) as count FROM lpr_readings WHERE timestamp >= ?').get(today) as { count: number };
    
    const avgConfidence = this.db.prepare('SELECT AVG(confidence) as avg FROM lpr_readings WHERE timestamp >= ?').get(today) as { avg: number };
    
    const lastReading = this.db.prepare('SELECT MAX(timestamp) as last FROM lpr_readings').get() as { last: number };

    return {
      total_readings: totalReadings.count,
      unique_plates: uniquePlates.count,
      today_readings: todayReadings.count,
      cameras_active: activeCameras.count,
      average_confidence: avgConfidence.avg || 0,
      last_reading: lastReading.last
    };
  }

  // Verificar si un evento ya existe
  public eventExists(eventId: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM lpr_readings WHERE event_id = ? LIMIT 1');
    return stmt.get(eventId) !== undefined;
  }

  // Obtener lecturas recientes
  public getRecentReadings(limit: number = 50): LPRReading[] {
    const stmt = this.db.prepare(`
      SELECT * FROM lpr_readings 
      ORDER BY timestamp DESC 
      LIMIT ?
    `);
    return stmt.all(limit) as LPRReading[];
  }

  // Limpiar lecturas antiguas (mantener solo últimos N días)
  public cleanupOldReadings(daysToKeep: number = 30): number {
    const cutoffTimestamp = Math.floor(Date.now() / 1000) - (daysToKeep * 24 * 60 * 60);
    
    const stmt = this.db.prepare('DELETE FROM lpr_readings WHERE timestamp < ?');
    const result = stmt.run(cutoffTimestamp);
    
    console.log(`✓ Limpieza BD: eliminadas ${result.changes} lecturas anteriores a ${daysToKeep} días`);
    return result.changes;
  }

  // Cerrar conexión
  public close(): void {
    this.db.close();
  }

  // Obtener instancia de la base de datos (para operaciones avanzadas)
  public getDatabase(): Database.Database {
    return this.db;
  }
}

// Singleton para acceso global
let dbInstance: LPRDatabase | null = null;

export function getLPRDatabase(): LPRDatabase {
  if (!dbInstance) {
    dbInstance = new LPRDatabase();
  }
  return dbInstance;
}

export default LPRDatabase;