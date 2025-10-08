/**
 * Base de datos SQLite para el sistema de conteo de objetos
 * 
 * Maneja la persistencia de eventos de conteo y configuración del módulo.
 * Utiliza la base de datos compartida en /DB para mantener consistencia con el proyecto.
 * 
 * Tablas:
 * - conteo_eventos: Almacena cada evento de detección válido
 * - conteo_configuracion: Configuración general del módulo
 */

import Database from 'better-sqlite3';
import path from 'path';

// Interfaces TypeScript para tipado
export interface counting_event {
  id: string; // Identificador único del evento de Frigate
  camera: string; // Nombre de la cámara
  label: string; // Etiqueta del objeto en español
  start_time: string; // ISO timestamp de inicio
  end_time: string; // ISO timestamp de fin
  zone?: string; // Zonas separadas por comas (opcional)
  confidence?: number; // Confianza de la detección
  metadata?: string; // JSON string con metadata adicional
}

export interface counting_configuration {
  id: number;
  mqtt_host: string;
  mqtt_port: number;
  mqtt_user?: string;
  mqtt_pass?: string;
  mqtt_topic: string;
  // Nuevos campos para modos de operación
  operation_mode: 'two_cameras' | 'zones';
  // Para modo de 2 cámaras
  camera_in?: string;
  camera_out?: string;
  // Para modo de zonas
  camera_zones?: string;
  zone_in?: string;
  zone_out?: string;
  // Configuración de objetos
  objects: string; // JSON array como string
  active_objects: string; // JSON array como string
  confidence_threshold: number;
  retention_days: number;
  // Notificaciones
  notifications_enabled: boolean;
  notification_email?: string;
  enabled: boolean;
  // Configuración adicional en JSON
  config_json: string;
  created_at: string;
  updated_at: string;
}

export interface counting_summary_totals {
  label: string;
  cnt: number;
}

export interface counting_summary_by_hour {
  idx: number; // Hora del día (0-23)
  label: string;
  cnt: number;
}

export interface counting_summary_by_bucket {
  idx: number; // Día del período
  label: string;
  cnt: number;
}

export interface counting_summary_response {
  totals: counting_summary_totals[];
  by_hour: {
    labels: string[];
    rows: counting_summary_by_hour[];
  };
  by_bucket: {
    labels: string[];
    rows: counting_summary_by_bucket[];
  };
}

/**
 * Clase para gestionar la base de datos del sistema de conteo
 */
export class CountingDatabase {
  private db: Database.Database;
  private db_path: string;

  constructor() {
    // Usar la carpeta DB compartida del proyecto
    this.db_path = path.join(process.cwd(), 'DB', 'counting.db');
    this.db = new Database(this.db_path);
    this.db.pragma('journal_mode = WAL');
    this.initialize_tables();
  }

  /**
   * Inicializa las tablas necesarias para el módulo de conteo
   */
  private initialize_tables(): void {
    // Tabla de eventos de conteo
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conteo_eventos (
        id TEXT PRIMARY KEY,
        camera TEXT NOT NULL,
        label TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT NOT NULL,
        zone TEXT,
        confidence REAL,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Índices para optimizar consultas
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conteo_camera_end_time 
      ON conteo_eventos(camera, end_time)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conteo_label_end_time 
      ON conteo_eventos(label, end_time)
    `);

    // Tabla de configuración
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conteo_configuracion (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mqtt_host TEXT NOT NULL DEFAULT 'localhost',
        mqtt_port INTEGER NOT NULL DEFAULT 1883,
        mqtt_user TEXT,
        mqtt_pass TEXT,
        mqtt_topic TEXT NOT NULL DEFAULT 'frigate/events',
        operation_mode TEXT NOT NULL DEFAULT 'two_cameras',
        camera_in TEXT,
        camera_out TEXT,
        camera_zones TEXT,
        zone_in TEXT,
        zone_out TEXT,
        objects TEXT NOT NULL DEFAULT '["car","bus","motorcycle","bicycle","truck","person"]',
        active_objects TEXT NOT NULL DEFAULT '["car","person"]',
        confidence_threshold REAL NOT NULL DEFAULT 0.7,
        retention_days INTEGER NOT NULL DEFAULT 30,
        notifications_enabled BOOLEAN NOT NULL DEFAULT 0,
        notification_email TEXT,
        config_json TEXT NOT NULL DEFAULT '{}',
        enabled BOOLEAN NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insertar configuración por defecto si no existe
    const has_config = this.db.prepare('SELECT COUNT(*) as count FROM conteo_configuracion').get() as { count: number };
    if (has_config.count === 0) {
      this.db.prepare(`
        INSERT INTO conteo_configuracion (
          mqtt_host, mqtt_port, mqtt_topic, operation_mode,
          objects, active_objects, confidence_threshold, retention_days,
          notifications_enabled, config_json, enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'localhost',
        1883,
        'frigate/events',
        'two_cameras',
        JSON.stringify(['car', 'bus', 'motorcycle', 'bicycle', 'truck', 'person']),
        JSON.stringify(['car', 'person']),
        0.7,
        30,
        0,
        '{}',
        0
      );
    }
    
    // Migrar estructura de tabla si es necesario
    this.migrate_table_structure();
  }

  /**
   * Migra la estructura de la tabla para soportar nuevos campos
   */
  private migrate_table_structure(): void {
    try {
      // Verificar si existen las nuevas columnas y agregarlas si no existen
      const table_info = this.db.prepare("PRAGMA table_info(conteo_configuracion)").all() as any[];
      const existing_columns = table_info.map(col => col.name);
      
      const required_columns = [
        { name: 'operation_mode', type: 'TEXT', default: "'two_cameras'" },
        { name: 'camera_in', type: 'TEXT', default: 'NULL' },
        { name: 'camera_out', type: 'TEXT', default: 'NULL' },
        { name: 'camera_zones', type: 'TEXT', default: 'NULL' },
        { name: 'zone_in', type: 'TEXT', default: 'NULL' },
        { name: 'zone_out', type: 'TEXT', default: 'NULL' },
        { name: 'confidence_threshold', type: 'REAL', default: '0.7' },
        { name: 'notifications_enabled', type: 'BOOLEAN', default: '0' },
        { name: 'notification_email', type: 'TEXT', default: 'NULL' },
        { name: 'config_json', type: 'TEXT', default: "'{}'" }
      ];
      
      for (const column of required_columns) {
        if (!existing_columns.includes(column.name)) {
          this.db.exec(`ALTER TABLE conteo_configuracion ADD COLUMN ${column.name} ${column.type} DEFAULT ${column.default}`);
          console.log(`✅ Added column ${column.name} to conteo_configuracion`);
        }
      }
    } catch (error) {
      console.error('Error migrating table structure:', error);
    }
  }

  /**
   * Obtiene la configuración actual del módulo de conteo
   */
  get_configuration(): counting_configuration | null {
    const stmt = this.db.prepare('SELECT * FROM conteo_configuracion ORDER BY id DESC LIMIT 1');
    return stmt.get() as counting_configuration | null;
  }

  /**
   * Actualiza la configuración del módulo de conteo
   */
  update_configuration(config: Partial<counting_configuration>): boolean {
    try {
      const current_config = this.get_configuration();
      if (!current_config) {
        throw new Error('No se encontró configuración base');
      }

      const updated_config = {
        ...current_config,
        ...config,
        updated_at: new Date().toISOString()
      };

      const stmt = this.db.prepare(`
        UPDATE conteo_configuracion SET
          mqtt_host = ?, mqtt_port = ?, mqtt_user = ?, mqtt_pass = ?,
          mqtt_topic = ?, operation_mode = ?, camera_in = ?, camera_out = ?,
          camera_zones = ?, zone_in = ?, zone_out = ?, objects = ?, 
          active_objects = ?, confidence_threshold = ?, retention_days = ?, 
          notifications_enabled = ?, notification_email = ?, config_json = ?,
          enabled = ?, updated_at = ?
        WHERE id = ?
      `);

      const result = stmt.run(
        updated_config.mqtt_host,
        updated_config.mqtt_port,
        updated_config.mqtt_user,
        updated_config.mqtt_pass,
        updated_config.mqtt_topic,
        updated_config.operation_mode,
        updated_config.camera_in,
        updated_config.camera_out,
        updated_config.camera_zones,
        updated_config.zone_in,
        updated_config.zone_out,
        updated_config.objects,
        updated_config.active_objects,
        updated_config.confidence_threshold,
        updated_config.retention_days,
        updated_config.notifications_enabled ? 1 : 0,
        updated_config.notification_email,
        updated_config.config_json,
        updated_config.enabled ? 1 : 0,
        updated_config.updated_at,
        current_config.id
      );

      return result.changes > 0;
    } catch (error) {
      console.error('Error updating counting configuration:', error);
      return false;
    }
  }

  /**
   * Inserta un nuevo evento de conteo
   */
  insert_event(event: counting_event): boolean {
    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO conteo_eventos 
        (id, camera, label, start_time, end_time, zone, confidence, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        event.id,
        event.camera,
        event.label,
        event.start_time,
        event.end_time,
        event.zone,
        event.confidence,
        event.metadata
      );

      return result.changes > 0;
    } catch (error) {
      console.error('Error inserting counting event:', error);
      return false;
    }
  }

  /**
   * Obtiene resumen de conteo para un período específico
   */
  get_summary(
    view: 'day' | 'week' | 'month',
    date: string,
    camera?: string
  ): counting_summary_response {
    const config = this.get_configuration();
    if (!config) {
      return {
        totals: [],
        by_hour: { labels: [], rows: [] },
        by_bucket: { labels: [], rows: [] }
      };
    }

    const active_objects = JSON.parse(config.active_objects);
        // Obtener cámaras configuradas según modo de operación
    let cameras: string[] = [];
    if (camera) {
      cameras = [camera];
    } else {
      if (config.operation_mode === 'two_cameras') {
        cameras = [config.camera_in, config.camera_out].filter(Boolean) as string[];
      } else if (config.operation_mode === 'zones' && config.camera_zones) {
        cameras = [config.camera_zones];
      }
    }

    // Calcular rango de fechas
    const { start_date, end_date, bucket_labels } = this.calculate_date_range(view, date);

    // Construir WHERE clause
    let where_clause = `
      WHERE end_time >= ? AND end_time <= ?
      AND label IN (${active_objects.map(() => '?').join(',')})
    `;
    let params = [start_date, end_date, ...active_objects];

    if (cameras.length > 0) {
      where_clause += ` AND camera IN (${cameras.map(() => '?').join(',')})`;
      params.push(...cameras);
    }

    // Query para totales
    const totals_query = `
      SELECT label, COUNT(*) as cnt
      FROM conteo_eventos
      ${where_clause}
      GROUP BY label
      ORDER BY cnt DESC
    `;
    const totals = this.db.prepare(totals_query).all(...params) as counting_summary_totals[];

    // Query para conteo por hora
    const by_hour_query = `
      SELECT 
        CAST(strftime('%H', end_time) AS INTEGER) as idx,
        label,
        COUNT(*) as cnt
      FROM conteo_eventos
      ${where_clause}
      GROUP BY idx, label
      ORDER BY idx, label
    `;
    const by_hour_rows = this.db.prepare(by_hour_query).all(...params) as counting_summary_by_hour[];

    // Query para conteo por bucket (día)
    let bucket_format = '';
    switch (view) {
      case 'day':
        bucket_format = '%H';
        break;
      case 'week':
        bucket_format = '%w'; // Día de la semana
        break;
      case 'month':
        bucket_format = '%d'; // Día del mes
        break;
    }

    const by_bucket_query = `
      SELECT 
        CAST(strftime('${bucket_format}', end_time) AS INTEGER) as idx,
        label,
        COUNT(*) as cnt
      FROM conteo_eventos
      ${where_clause}
      GROUP BY idx, label
      ORDER BY idx, label
    `;
    const by_bucket_rows = this.db.prepare(by_bucket_query).all(...params) as counting_summary_by_bucket[];

    return {
      totals,
      by_hour: {
        labels: Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')),
        rows: by_hour_rows
      },
      by_bucket: {
        labels: bucket_labels,
        rows: by_bucket_rows
      }
    };
  }

  /**
   * Calcula el rango de fechas para las consultas
   */
  private calculate_date_range(view: 'day' | 'week' | 'month', date: string) {
    const base_date = new Date(date);
    let start_date: string;
    let end_date: string;
    let bucket_labels: string[];

    switch (view) {
      case 'day':
        start_date = `${date}T00:00:00.000Z`;
        end_date = `${date}T23:59:59.999Z`;
        bucket_labels = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
        break;

      case 'week':
        const start_of_week = new Date(base_date);
        start_of_week.setDate(base_date.getDate() - base_date.getDay());
        const end_of_week = new Date(start_of_week);
        end_of_week.setDate(start_of_week.getDate() + 6);
        
        start_date = start_of_week.toISOString().split('T')[0] + 'T00:00:00.000Z';
        end_date = end_of_week.toISOString().split('T')[0] + 'T23:59:59.999Z';
        
        bucket_labels = Array.from({ length: 7 }, (_, i) => {
          const day = new Date(start_of_week);
          day.setDate(start_of_week.getDate() + i);
          return day.toISOString().split('T')[0];
        });
        break;

      case 'month':
        const year = base_date.getFullYear();
        const month = base_date.getMonth();
        const start_of_month = new Date(year, month, 1);
        const end_of_month = new Date(year, month + 1, 0);
        
        start_date = start_of_month.toISOString().split('T')[0] + 'T00:00:00.000Z';
        end_date = end_of_month.toISOString().split('T')[0] + 'T23:59:59.999Z';
        
        const days_in_month = end_of_month.getDate();
        bucket_labels = Array.from({ length: days_in_month }, (_, i) => {
          const day = new Date(year, month, i + 1);
          return day.toISOString().split('T')[0];
        });
        break;

      default:
        throw new Error(`Vista no soportada: ${view}`);
    }

    return { start_date, end_date, bucket_labels };
  }

  /**
   * Actualiza los objetos activos (toggle)
   */
  toggle_active_object(label: string): string[] {
    const config = this.get_configuration();
    if (!config) {
      throw new Error('No se encontró configuración');
    }

    const active_objects = JSON.parse(config.active_objects);
    const index = active_objects.indexOf(label);

    if (index > -1) {
      // Remover si ya está activo
      active_objects.splice(index, 1);
    } else {
      // Agregar si no está activo
      active_objects.push(label);
    }

    this.update_configuration({
      active_objects: JSON.stringify(active_objects)
    });

    return active_objects;
  }

  /**
   * Limpia eventos antiguos según la configuración de retención
   */
  cleanup_old_events(): number {
    const config = this.get_configuration();
    if (!config || config.retention_days === 0) {
      return 0; // Retención infinita
    }

    const cutoff_date = new Date();
    cutoff_date.setDate(cutoff_date.getDate() - config.retention_days);
    const cutoff_iso = cutoff_date.toISOString();

    const stmt = this.db.prepare('DELETE FROM conteo_eventos WHERE end_time < ?');
    const result = stmt.run(cutoff_iso);

    return result.changes;
  }

  /**
   * Obtiene estadísticas básicas del módulo
   */
  get_stats() {
    const config = this.get_configuration();
    if (!config) {
      return {
        total_events: 0,
        events_today: 0,
        active_cameras: 0,
        active_objects: []
      };
    }

    const today = new Date().toISOString().split('T')[0];
    
    const total_events = this.db.prepare('SELECT COUNT(*) as count FROM conteo_eventos').get() as { count: number };
    const events_today = this.db.prepare('SELECT COUNT(*) as count FROM conteo_eventos WHERE DATE(end_time) = ?').get(today) as { count: number };
    
    // Obtener cámaras configuradas según modo de operación  
    let cameras: string[] = [];
    if (config.operation_mode === 'two_cameras') {
      cameras = [config.camera_in, config.camera_out].filter(Boolean) as string[];
    } else if (config.operation_mode === 'zones' && config.camera_zones) {
      cameras = [config.camera_zones];
    }
    const active_objects = JSON.parse(config.active_objects);

    return {
      total_events: total_events.count,
      events_today: events_today.count,
      active_cameras: cameras.length,
      active_objects
    };
  }

  /**
   * Cierra la conexión a la base de datos
   */
  close(): void {
    this.db.close();
  }

  /**
   * Ejecuta una consulta preparada (para uso del servicio de limpieza)
   */
  execute_statement(sql: string, params: any[] = []): any {
    const stmt = this.db.prepare(sql);
    return stmt.run(...params);
  }

  /**
   * Ejecuta una consulta que retorna datos (para uso del servicio de limpieza)
   */
  query_statement(sql: string, params: any[] = []): any {
    const stmt = this.db.prepare(sql);
    return stmt.get(...params);
  }

  /**
   * Ejecuta una consulta que retorna múltiples filas (para uso del servicio de limpieza)
   */
  query_all_statement(sql: string, params: any[] = []): any[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }

  /**
   * Ejecuta comando SQL directo (para VACUUM, ANALYZE, etc.)
   */
  execute_sql(sql: string): void {
    this.db.exec(sql);
  }
}

/**
 * Función helper para obtener una instancia de la base de datos
 */
let counting_db_instance: CountingDatabase | null = null;

export function get_counting_database(): CountingDatabase {
  if (!counting_db_instance) {
    counting_db_instance = new CountingDatabase();
  }
  return counting_db_instance;
}