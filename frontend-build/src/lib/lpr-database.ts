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

  /**
   * Inicializa la base de datos de matrículas en DB/Matriculas.db
   * Crea el directorio si no existe
   */
  constructor() {
    const db_dir = path.join(process.cwd(), 'DB');
    if (!fs.existsSync(db_dir)) {
      fs.mkdirSync(db_dir, { recursive: true });
    }
    this.dbPath = path.join(db_dir, 'Matriculas.db');
    this.db = new Database(this.dbPath);
    
    // Intentar inicializar esquema, pero manejar caso read-only
    try {
      this.initializeSchema();
    } catch (error: any) {
      if (error.code === 'SQLITE_READONLY') {
        console.log('ℹ️ Base de datos LPR en modo read-only, omitiendo inicialización de esquema:', this.dbPath);
      } else {
        throw error;
      }
    }
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

    console.log('✅ Base de datos LPR inicializada (FRONTEND - Lectura):', this.dbPath);
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

  // Buscar lecturas con filtros - CONSULTA TABLA events DEL BACKEND
  public searchReadings(filters: {
    afterTimestamp?: number;
    beforeTimestamp?: number;
    cameras?: string[];
    plateSearch?: string; // Búsqueda general en matrícula, cámara, servidor, tipo vehículo y dirección
    minConfidence?: number;
    limit?: number;
    offset?: number;
  } = {}): LPRReading[] {
    // Consulta la tabla events del backend LPR
    let query = `
      SELECT 
        id, 
        server as server_name,
        frigate_event_id as event_id,
        camera,
        ts,
        payload_json,
        snapshot_path,
        clip_path,
        plate_crop_path as crop_path,
        speed,
        created_at
      FROM events 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.afterTimestamp) {
      query += ' AND created_at >= datetime(?, "unixepoch")';
      params.push(filters.afterTimestamp);
    }

    if (filters.beforeTimestamp) {
      query += ' AND created_at <= datetime(?, "unixepoch")';
      params.push(filters.beforeTimestamp);
    }

    if (filters.cameras && filters.cameras.length > 0) {
      query += ` AND camera IN (${filters.cameras.map(() => '?').join(',')})`;
      params.push(...filters.cameras);
    }

    query += ' ORDER BY id DESC';

    if (filters.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
      
      if (filters.offset) {
        query += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    // Transformar los datos de la tabla events al formato LPRReading
    const readings: LPRReading[] = [];
    
    for (const row of rows) {
      try {
        const payload = JSON.parse(row.payload_json);
        
        // Extraer matrícula del payload (igual que hace el backend)
        let plate: string | null = null;
        let confidence = 0.5;
        
        const after = payload.after || {};
        
        // Buscar matrícula en múltiples ubicaciones posibles
        const sources = [
          after.recognized_license_plate,
          after.plate,
          after.text,
          (after.snapshot || {}).plate,
          (after.snapshot || {}).text,
          after.regions,
          after.box,
        ];
        
        for (const src of sources) {
          if (!src) continue;
          
          if (typeof src === 'string') {
            const p = src.trim();
            if (p) {
              plate = p.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
              break;
            }
          } else if (Array.isArray(src)) {
            for (const item of src) {
              if (typeof item === 'string') {
                const p = item.trim();
                if (p) {
                  plate = p.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
                  break;
                }
              } else if (typeof item === 'object' && item.plate) {
                plate = item.plate.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
                confidence = item.score || item.confidence || 0.5;
                break;
              }
            }
            if (plate) break;
          } else if (typeof src === 'object' && src.plate) {
            plate = src.plate.replace(/\s+/g, '').replace(/-/g, '').toUpperCase();
            confidence = src.score || src.confidence || 0.5;
            break;
          }
        }
        
        // Si no encontramos matrícula, saltar este registro
        if (!plate) continue;
        
        // Convertir timestamp ISO a unix timestamp
        let timestamp = Math.floor(Date.now() / 1000); // fallback
        if (row.ts) {
          try {
            timestamp = Math.floor(new Date(row.ts).getTime() / 1000);
          } catch (e) {
            // usar fallback
          }
        }
        
        // Filtrar por búsqueda de matrícula si se especificó
        if (filters.plateSearch && filters.plateSearch.trim()) {
          const searchTerm = filters.plateSearch.trim().toUpperCase();
          const matches = 
            plate.toUpperCase().includes(searchTerm) ||
            (row.camera || '').toUpperCase().includes(searchTerm) ||
            (row.server_name || '').toUpperCase().includes(searchTerm);
          
          if (!matches) continue;
        }
        
        // Filtrar por confianza mínima
        if (filters.minConfidence !== undefined && confidence < filters.minConfidence) {
          continue;
        }
        
        readings.push({
          id: row.id,
          event_id: row.event_id,
          server_id: row.server_name, // usar server como server_id
          server_name: row.server_name,
          camera: row.camera || '',
          plate: plate,
          confidence: confidence,
          timestamp: timestamp,
          end_time: undefined,
          vehicle_type: after.vehicle_type || undefined,
          speed: row.speed || undefined,
          direction: undefined,
          has_clip: !!row.clip_path,
          has_snapshot: !!row.snapshot_path,
          score: confidence,
          box: undefined,
          snapshot_path: row.snapshot_path,
          clip_path: row.clip_path,
          crop_path: row.crop_path,
          created_at: Math.floor(new Date(row.created_at).getTime() / 1000),
          updated_at: Math.floor(new Date(row.created_at).getTime() / 1000)
        });
        
      } catch (error) {
        console.warn('Error procesando registro de events:', error, row);
        continue;
      }
    }

    return readings;
  }

  // Obtener estadísticas
  public getStats(): LPRStats {
    // Consultar estadísticas desde la tabla events
    const totalReadings = this.db.prepare('SELECT COUNT(*) as count FROM events').get() as { count: number };
    
    // Para estadísticas más detalladas, necesitamos procesar los payloads JSON
    // Por simplicidad, calculamos estadísticas básicas
    const camerasResult = this.db.prepare('SELECT COUNT(DISTINCT camera) as count FROM events').get() as { count: number };
    
    // Obtener fecha de hoy para estadísticas diarias
    const today = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
    const todayReadings = this.db.prepare('SELECT COUNT(*) as count FROM events WHERE created_at >= datetime(?, "unixepoch")').get(today) as { count: number };
    
    // Obtener último registro
    const lastReading = this.db.prepare('SELECT MAX(created_at) as last FROM events').get() as { last: string };
    let lastTimestamp: number | undefined;
    if (lastReading.last) {
      lastTimestamp = Math.floor(new Date(lastReading.last).getTime() / 1000);
    }

    return {
      total_readings: totalReadings.count,
      unique_plates: 0, // No podemos calcular fácilmente desde events sin procesar JSON
      today_readings: todayReadings.count,
      cameras_active: camerasResult.count,
      average_confidence: 0.8, // Valor aproximado
      last_reading: lastTimestamp
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