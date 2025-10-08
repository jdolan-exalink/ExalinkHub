/**
 * Base de datos para Sistema de Conteo Vehicular IN/OUT
 * Maneja zonas de entrada y salida con transiciones de vehículos
 */

import Database from 'better-sqlite3';
import path from 'path';
import { existsSync, mkdirSync } from 'fs';

const DB_DIR = path.join(process.cwd(), 'DB');
const VEHICLE_COUNTING_DB_PATH = path.join(DB_DIR, 'vehicle_counting.db');

/**
 * Configuración de zona IN/OUT para una cámara
 */
export interface VehicleZoneConfig {
  id: number;
  camera_name: string;
  zone_in: string; // Nombre de la zona IN en Frigate
  zone_out: string; // Nombre de la zona OUT en Frigate
  enabled: boolean;
  title: string;
  created_at: string;
  updated_at: string;
}

/**
 * Evento de transición vehicular (IN o OUT)
 */
export interface VehicleTransitionEvent {
  id: number;
  camera_name: string;
  zone_config_id: number;
  object_id: string; // ID del objeto detectado por Frigate
  object_type: string; // 'car', 'truck', 'motorcycle', etc.
  transition_type: 'in' | 'out';
  confidence: number;
  zone_name: string; // Zona específica que activó el evento
  timestamp: string;
  processed: boolean;
}

/**
 * Estadísticas agregadas de conteo vehicular
 */
export interface VehicleCountStats {
  id: number;
  camera_name: string;
  zone_config_id: number;
  period_start: string;
  period_end: string;
  total_in: number;
  total_out: number;
  current_count: number; // in - out
  by_type: string; // JSON: {car: {in: 5, out: 3}, truck: {in: 2, out: 1}}
  created_at: string;
}

class VehicleCountingDatabase {
  private db: Database.Database;

  constructor() {
    this.initialize_database();
    this.db = new Database(VEHICLE_COUNTING_DB_PATH);
    this.initialize_tables();
  }

  /**
   * Inicializa el directorio de la base de datos
   */
  private initialize_database() {
    if (!existsSync(DB_DIR)) {
      mkdirSync(DB_DIR, { recursive: true });
      console.log('📁 Directorio DB creado para conteo vehicular');
    }
  }

  /**
   * Crea las tablas necesarias para el sistema de conteo vehicular
   */
  private initialize_tables() {
    // Tabla de configuración de zonas IN/OUT por cámara
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vehicle_zone_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        camera_name TEXT NOT NULL,
        zone_in TEXT NOT NULL,
        zone_out TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(camera_name, zone_in, zone_out)
      )
    `);

    // Tabla de eventos de transición
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vehicle_transition_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        camera_name TEXT NOT NULL,
        zone_config_id INTEGER NOT NULL,
        object_id TEXT NOT NULL,
        object_type TEXT NOT NULL,
        transition_type TEXT NOT NULL CHECK(transition_type IN ('in', 'out')),
        confidence REAL NOT NULL,
        zone_name TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        processed BOOLEAN DEFAULT 0,
        FOREIGN KEY (zone_config_id) REFERENCES vehicle_zone_configs (id) ON DELETE CASCADE
      )
    `);

    // Tabla de estadísticas agregadas
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS vehicle_count_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        camera_name TEXT NOT NULL,
        zone_config_id INTEGER NOT NULL,
        period_start DATETIME NOT NULL,
        period_end DATETIME NOT NULL,
        total_in INTEGER DEFAULT 0,
        total_out INTEGER DEFAULT 0,
        current_count INTEGER DEFAULT 0,
        by_type TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (zone_config_id) REFERENCES vehicle_zone_configs (id) ON DELETE CASCADE
      )
    `);

    // Índices para mejorar rendimiento
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_transition_events_camera_time ON vehicle_transition_events(camera_name, timestamp)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_transition_events_object ON vehicle_transition_events(object_id, timestamp)`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_stats_camera_period ON vehicle_count_stats(camera_name, period_start, period_end)`);

    console.log('✅ Tablas de conteo vehicular inicializadas');
  }

  // ========================================
  // MÉTODOS PARA CONFIGURACIÓN DE ZONAS
  // ========================================

  /**
   * Crea una nueva configuración de zona IN/OUT
   */
  create_zone_config(camera_name: string, zone_in: string, zone_out: string, title: string): number | null {
    try {
      const result = this.db.prepare(`
        INSERT INTO vehicle_zone_configs (camera_name, zone_in, zone_out, title)
        VALUES (?, ?, ?, ?)
      `).run(camera_name, zone_in, zone_out, title);
      
      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Error creating vehicle zone config:', error);
      return null;
    }
  }

  /**
   * Obtiene todas las configuraciones de zonas
   */
  get_all_zone_configs(): VehicleZoneConfig[] {
    return this.db.prepare('SELECT * FROM vehicle_zone_configs ORDER BY camera_name, title').all() as VehicleZoneConfig[];
  }

  /**
   * Obtiene configuraciones habilitadas solamente
   */
  get_enabled_zone_configs(): VehicleZoneConfig[] {
    return this.db.prepare('SELECT * FROM vehicle_zone_configs WHERE enabled = 1 ORDER BY camera_name, title').all() as VehicleZoneConfig[];
  }

  /**
   * Obtiene configuración por ID
   */
  get_zone_config(id: number): VehicleZoneConfig | null {
    return this.db.prepare('SELECT * FROM vehicle_zone_configs WHERE id = ?').get(id) as VehicleZoneConfig | null;
  }

  /**
   * Actualiza configuración de zona
   */
  update_zone_config(id: number, data: Partial<VehicleZoneConfig>): boolean {
    const allowed_fields = ['camera_name', 'zone_in', 'zone_out', 'enabled', 'title'];
    const updates: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (allowed_fields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) return false;

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    try {
      this.db.prepare(`
        UPDATE vehicle_zone_configs 
        SET ${updates.join(', ')}
        WHERE id = ?
      `).run(...values);
      return true;
    } catch (error) {
      console.error('Error updating vehicle zone config:', error);
      return false;
    }
  }

  /**
   * Elimina configuración de zona
   */
  delete_zone_config(id: number): boolean {
    try {
      this.db.prepare('DELETE FROM vehicle_zone_configs WHERE id = ?').run(id);
      return true;
    } catch (error) {
      console.error('Error deleting vehicle zone config:', error);
      return false;
    }
  }

  // ========================================
  // MÉTODOS PARA EVENTOS DE TRANSICIÓN
  // ========================================

  /**
   * Registra un evento de transición (IN o OUT)
   */
  insert_transition_event(
    camera_name: string,
    zone_config_id: number,
    object_id: string,
    object_type: string,
    transition_type: 'in' | 'out',
    confidence: number,
    zone_name: string
  ): number | null {
    try {
      const result = this.db.prepare(`
        INSERT INTO vehicle_transition_events 
        (camera_name, zone_config_id, object_id, object_type, transition_type, confidence, zone_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(camera_name, zone_config_id, object_id, object_type, transition_type, confidence, zone_name);

      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Error inserting vehicle transition event:', error);
      return null;
    }
  }

  /**
   * Obtiene eventos de transición con filtros
   */
  get_transition_events(filters: {
    camera_name?: string;
    zone_config_id?: number;
    transition_type?: 'in' | 'out';
    start_date?: string;
    end_date?: string;
    limit?: number;
  } = {}): VehicleTransitionEvent[] {
    let sql = 'SELECT * FROM vehicle_transition_events WHERE 1=1';
    const params: any[] = [];

    if (filters.camera_name) {
      sql += ' AND camera_name = ?';
      params.push(filters.camera_name);
    }

    if (filters.zone_config_id) {
      sql += ' AND zone_config_id = ?';
      params.push(filters.zone_config_id);
    }

    if (filters.transition_type) {
      sql += ' AND transition_type = ?';
      params.push(filters.transition_type);
    }

    if (filters.start_date) {
      sql += ' AND timestamp >= ?';
      params.push(filters.start_date);
    }

    if (filters.end_date) {
      sql += ' AND timestamp <= ?';
      params.push(filters.end_date);
    }

    sql += ' ORDER BY timestamp DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    return this.db.prepare(sql).all(...params) as VehicleTransitionEvent[];
  }

  /**
   * Obtiene estadísticas de conteo para una cámara/zona en tiempo real
   */
  get_current_count(camera_name: string, zone_config_id?: number): {
    total_in: number;
    total_out: number;
    current_count: number;
    by_type: Record<string, { in: number; out: number }>;
  } {
    let sql = `
      SELECT 
        object_type,
        transition_type,
        COUNT(*) as count
      FROM vehicle_transition_events 
      WHERE camera_name = ?
    `;
    const params: any[] = [camera_name];

    if (zone_config_id) {
      sql += ' AND zone_config_id = ?';
      params.push(zone_config_id);
    }

    sql += ' AND DATE(timestamp) = DATE("now") GROUP BY object_type, transition_type';

    const results = this.db.prepare(sql).all(...params) as Array<{
      object_type: string;
      transition_type: 'in' | 'out';
      count: number;
    }>;

    const stats = {
      total_in: 0,
      total_out: 0,
      current_count: 0,
      by_type: {} as Record<string, { in: number; out: number }>
    };

    // Procesar resultados
    for (const result of results) {
      if (!stats.by_type[result.object_type]) {
        stats.by_type[result.object_type] = { in: 0, out: 0 };
      }

      stats.by_type[result.object_type][result.transition_type] = result.count;

      if (result.transition_type === 'in') {
        stats.total_in += result.count;
      } else {
        stats.total_out += result.count;
      }
    }

    stats.current_count = stats.total_in - stats.total_out;

    return stats;
  }

  /**
   * Obtiene estadísticas históricas por período
   */
  get_historical_stats(
    start_date: string,
    end_date: string,
    camera_name?: string,
    group_by: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Array<{
    period: string;
    camera_name: string;
    total_in: number;
    total_out: number;
    current_count: number;
    by_type: Record<string, { in: number; out: number }>;
  }> {
    const date_format = {
      hour: "strftime('%Y-%m-%d %H:00:00', timestamp)",
      day: "DATE(timestamp)",
      week: "strftime('%Y-W%W', timestamp)",
      month: "strftime('%Y-%m', timestamp)"
    }[group_by];

    let sql = `
      SELECT 
        ${date_format} as period,
        camera_name,
        object_type,
        transition_type,
        COUNT(*) as count
      FROM vehicle_transition_events 
      WHERE timestamp BETWEEN ? AND ?
    `;
    const params: any[] = [start_date, end_date];

    if (camera_name) {
      sql += ' AND camera_name = ?';
      params.push(camera_name);
    }

    sql += ' GROUP BY period, camera_name, object_type, transition_type ORDER BY period, camera_name';

    const results = this.db.prepare(sql).all(...params) as Array<{
      period: string;
      camera_name: string;
      object_type: string;
      transition_type: 'in' | 'out';
      count: number;
    }>;

    // Agrupar por período y cámara
    const grouped: Record<string, {
      period: string;
      camera_name: string;
      total_in: number;
      total_out: number;
      current_count: number;
      by_type: Record<string, { in: number; out: number }>;
    }> = {};

    for (const result of results) {
      const key = `${result.period}-${result.camera_name}`;
      
      if (!grouped[key]) {
        grouped[key] = {
          period: result.period,
          camera_name: result.camera_name,
          total_in: 0,
          total_out: 0,
          current_count: 0,
          by_type: {}
        };
      }

      if (!grouped[key].by_type[result.object_type]) {
        grouped[key].by_type[result.object_type] = { in: 0, out: 0 };
      }

      grouped[key].by_type[result.object_type][result.transition_type] = result.count;

      if (result.transition_type === 'in') {
        grouped[key].total_in += result.count;
      } else {
        grouped[key].total_out += result.count;
      }
    }

    // Calcular current_count y convertir a array
    return Object.values(grouped).map(stats => {
      stats.current_count = stats.total_in - stats.total_out;
      return stats;
    });
  }

  /**
   * Limpia eventos antiguos según la configuración de retención
   */
  cleanup_old_events(retention_days: number): number {
    const cutoff_date = new Date();
    cutoff_date.setDate(cutoff_date.getDate() - retention_days);

    const result = this.db.prepare(`
      DELETE FROM vehicle_transition_events 
      WHERE timestamp < ?
    `).run(cutoff_date.toISOString());

    console.log(`🧹 Limpiados ${result.changes} eventos de conteo vehicular anteriores a ${retention_days} días`);
    return result.changes || 0;
  }

  /**
   * Cierra la conexión a la base de datos
   */
  close() {
    this.db.close();
  }
}

// Singleton instance
let vehicleCountingDbInstance: VehicleCountingDatabase | null = null;

export function getVehicleCountingDatabase(): VehicleCountingDatabase {
  if (!vehicleCountingDbInstance) {
    vehicleCountingDbInstance = new VehicleCountingDatabase();
  }
  return vehicleCountingDbInstance;
}

export default VehicleCountingDatabase;