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

// Nuevas interfaces según especificación técnica
export interface area {
  id: number;
  nombre: string;
  tipo: 'personas' | 'vehiculos'; // Tipo de objetos que cuenta
  max_ocupacion: number; // Límite máximo de ocupación
  modo_limite: 'soft' | 'hard'; // Tipo de límite (warning o bloqueo)
  estado_actual: number; // Ocupación actual
  color_estado: string; // Color basado en estado (verde/amarillo/rojo)
  metadata_mapa?: string; // JSON con coordenadas y forma en mapa
  enabled: boolean; // Si el área está activa
  created_at: string;
  updated_at: string;
}

export interface access_point {
  id: number;
  area_id: number; // FK a area
  fuente_id: string; // Cámara o zona de Frigate
  direccion: 'entrada' | 'salida'; // Tipo de punto de acceso
  geometry?: string; // JSON con geometría del punto
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface counting_new_event {
  id: number;
  area_id: number; // FK a area
  tipo: 'enter' | 'exit' | 'warning' | 'exceeded'; // Tipo de evento
  valor: number; // +1 entrada, -1 salida, 0 alertas
  fuente: string; // Cámara o zona origen
  ts: string; // Timestamp ISO
  metadata?: string; // JSON con datos adicionales
  created_at: string;
}

export interface measurement {
  id: number;
  area_id: number; // FK a area
  ocupacion_actual: number; // Snapshot de ocupación
  densidad?: number; // Densidad opcional (personas/m²)
  ts: string; // Timestamp del snapshot
  created_at: string;
}

export interface parking_zone {
  id: number;
  nombre: string;
  tenant_id?: number; // Para multi-tenant (opcional)
  capacidad_total: number; // Capacidad total del parking
  metadata?: string; // JSON con configuración adicional
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface parking_snapshot {
  id: number;
  zone_id: number; // FK a parking_zone
  ocupacion: number; // Vehículos presentes
  ts: string; // Timestamp del snapshot
  created_at: string;
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
    // Tabla legacy de eventos de conteo (mantener para compatibilidad)
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

    // NUEVAS TABLAS SEGÚN ESPECIFICACIÓN TÉCNICA
    
    // Tabla de áreas de conteo
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS areas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        tipo TEXT NOT NULL CHECK (tipo IN ('personas', 'vehiculos')),
        max_ocupacion INTEGER NOT NULL DEFAULT 100,
        modo_limite TEXT NOT NULL DEFAULT 'soft' CHECK (modo_limite IN ('soft', 'hard')),
        estado_actual INTEGER NOT NULL DEFAULT 0,
        color_estado TEXT NOT NULL DEFAULT 'green',
        metadata_mapa TEXT,
        enabled BOOLEAN NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de puntos de acceso
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS access_points (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        area_id INTEGER NOT NULL,
        fuente_id TEXT NOT NULL,
        direccion TEXT NOT NULL CHECK (direccion IN ('entrada', 'salida')),
        geometry TEXT,
        enabled BOOLEAN NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
      )
    `);

    // Tabla de eventos (nueva estructura)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS counting_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        area_id INTEGER NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('enter', 'exit', 'warning', 'exceeded')),
        valor INTEGER NOT NULL DEFAULT 0,
        fuente TEXT NOT NULL,
        ts TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
      )
    `);

    // Tabla de mediciones periódicas
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS measurements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        area_id INTEGER NOT NULL,
        ocupacion_actual INTEGER NOT NULL,
        densidad REAL,
        ts TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE
      )
    `);

    // Tabla de zonas de parking (opcional)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS parking_zones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL UNIQUE,
        tenant_id INTEGER,
        capacidad_total INTEGER NOT NULL DEFAULT 50,
        metadata TEXT,
        enabled BOOLEAN NOT NULL DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de snapshots de parking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS parking_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        zone_id INTEGER NOT NULL,
        ocupacion INTEGER NOT NULL,
        ts TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (zone_id) REFERENCES parking_zones(id) ON DELETE CASCADE
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

    // Nuevos índices para las tablas actualizadas
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_counting_events_area_ts 
      ON counting_events(area_id, ts)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_counting_events_tipo_ts 
      ON counting_events(tipo, ts)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_measurements_area_ts 
      ON measurements(area_id, ts)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_access_points_area 
      ON access_points(area_id, enabled)
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_parking_snapshots_zone_ts 
      ON parking_snapshots(zone_id, ts)
    `);

    // Tabla de configuración (existente)
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

    // Insertar áreas de ejemplo si no existen
    this.insert_default_areas();
    
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
   * Inserta áreas de ejemplo por defecto si no existen
   */
  private insert_default_areas(): void {
    const has_areas = this.db.prepare('SELECT COUNT(*) as count FROM areas').get() as { count: number };
    if (has_areas.count === 0) {
      const areas_to_insert = [
        {
          nombre: 'Hall Principal',
          tipo: 'personas',
          max_ocupacion: 50,
          modo_limite: 'soft',
          metadata_mapa: JSON.stringify({ x: 100, y: 100, width: 200, height: 150 })
        },
        {
          nombre: 'Estacionamiento A',
          tipo: 'vehiculos',
          max_ocupacion: 25,
          modo_limite: 'hard',
          metadata_mapa: JSON.stringify({ x: 300, y: 100, width: 150, height: 200 })
        },
        {
          nombre: 'Sala de Reuniones',
          tipo: 'personas',
          max_ocupacion: 12,
          modo_limite: 'soft',
          metadata_mapa: JSON.stringify({ x: 150, y: 300, width: 100, height: 80 })
        }
      ];

      const insert_stmt = this.db.prepare(`
        INSERT INTO areas (nombre, tipo, max_ocupacion, modo_limite, metadata_mapa)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const area of areas_to_insert) {
        insert_stmt.run(area.nombre, area.tipo, area.max_ocupacion, area.modo_limite, area.metadata_mapa);
      }

      // Agregar puntos de acceso para las áreas por defecto
      const access_points_to_insert = [
        { area_id: 1, fuente_id: 'Hall_Principal', direccion: 'entrada' },
        { area_id: 1, fuente_id: 'Hall_Principal_Exit', direccion: 'salida' },
        { area_id: 2, fuente_id: 'Parking_A_Entry', direccion: 'entrada' },
        { area_id: 2, fuente_id: 'Parking_A_Exit', direccion: 'salida' },
        { area_id: 3, fuente_id: 'Meeting_Room_Door', direccion: 'entrada' }
      ];

      const insert_access_stmt = this.db.prepare(`
        INSERT INTO access_points (area_id, fuente_id, direccion)
        VALUES (?, ?, ?)
      `);

      for (const access_point of access_points_to_insert) {
        insert_access_stmt.run(access_point.area_id, access_point.fuente_id, access_point.direccion);
      }
    }
  }

  // MÉTODOS PARA GESTIÓN DE ÁREAS

  /**
   * Obtiene todas las áreas definidas
   */
  get_all_areas(): area[] {
    return this.db.prepare('SELECT * FROM areas ORDER BY nombre').all() as area[];
  }

  /**
   * Obtiene un área específica por ID
   */
  get_area_by_id(id: number): area | null {
    return this.db.prepare('SELECT * FROM areas WHERE id = ?').get(id) as area | null;
  }

  /**
   * Crea una nueva área
   */
  create_area(area_data: Omit<area, 'id' | 'created_at' | 'updated_at'>): number | null {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO areas (nombre, tipo, max_ocupacion, modo_limite, estado_actual, color_estado, metadata_mapa, enabled)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        area_data.nombre,
        area_data.tipo,
        area_data.max_ocupacion,
        area_data.modo_limite,
        area_data.estado_actual,
        area_data.color_estado,
        area_data.metadata_mapa,
        area_data.enabled ? 1 : 0
      );

      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Error creating area:', error);
      return null;
    }
  }

  /**
   * Actualiza un área existente
   */
  update_area(id: number, area_data: Partial<area>): boolean {
    try {
      const current_area = this.get_area_by_id(id);
      if (!current_area) {
        return false;
      }

      const updated_area = {
        ...current_area,
        ...area_data,
        updated_at: new Date().toISOString()
      };

      const stmt = this.db.prepare(`
        UPDATE areas SET
          nombre = ?, tipo = ?, max_ocupacion = ?, modo_limite = ?,
          estado_actual = ?, color_estado = ?, metadata_mapa = ?, enabled = ?, updated_at = ?
        WHERE id = ?
      `);

      const result = stmt.run(
        updated_area.nombre,
        updated_area.tipo,
        updated_area.max_ocupacion,
        updated_area.modo_limite,
        updated_area.estado_actual,
        updated_area.color_estado,
        updated_area.metadata_mapa,
        updated_area.enabled ? 1 : 0,
        updated_area.updated_at,
        id
      );

      return result.changes > 0;
    } catch (error) {
      console.error('Error updating area:', error);
      return false;
    }
  }

  /**
   * Actualiza la ocupación actual de un área
   */
  update_area_ocupacion(area_id: number, new_ocupacion: number): boolean {
    try {
      const area = this.get_area_by_id(area_id);
      if (!area) {
        return false;
      }

      // Calcular nuevo color basado en ocupación
      let new_color = 'green';
      const percentage = (new_ocupacion / area.max_ocupacion) * 100;
      
      if (percentage >= 100) {
        new_color = 'red';
      } else if (percentage >= 80) {
        new_color = 'orange';
      } else if (percentage >= 60) {
        new_color = 'yellow';
      }

      const stmt = this.db.prepare(`
        UPDATE areas SET 
          estado_actual = ?, 
          color_estado = ?, 
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      const result = stmt.run(new_ocupacion, new_color, area_id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating area ocupacion:', error);
      return false;
    }
  }

  // MÉTODOS PARA GESTIÓN DE EVENTOS DE CONTEO

  /**
   * Inserta un nuevo evento de conteo en la tabla nueva
   */
  insert_counting_event(event_data: Omit<counting_new_event, 'id' | 'created_at'>): number | null {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO counting_events (area_id, tipo, valor, fuente, ts, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        event_data.area_id,
        event_data.tipo,
        event_data.valor,
        event_data.fuente,
        event_data.ts,
        event_data.metadata
      );

      // Si es un evento de entrada/salida, actualizar ocupación del área
      if (event_data.tipo === 'enter' || event_data.tipo === 'exit') {
        this.update_ocupacion_from_event(event_data.area_id, event_data.valor);
      }

      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Error inserting counting event:', error);
      return null;
    }
  }

  /**
   * Actualiza la ocupación de un área basada en un evento
   */
  private update_ocupacion_from_event(area_id: number, valor: number): void {
    const area = this.get_area_by_id(area_id);
    if (!area) return;

    const new_ocupacion = Math.max(0, area.estado_actual + valor);
    this.update_area_ocupacion(area_id, new_ocupacion);
  }

  // MÉTODOS PARA GESTIÓN DE MEDICIONES

  /**
   * Inserta una nueva medición periódica
   */
  insert_measurement(measurement_data: Omit<measurement, 'id' | 'created_at'>): number | null {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO measurements (area_id, ocupacion_actual, densidad, ts)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(
        measurement_data.area_id,
        measurement_data.ocupacion_actual,
        measurement_data.densidad,
        measurement_data.ts
      );

      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Error inserting measurement:', error);
      return null;
    }
  }

  /**
   * Obtiene mediciones históricas de un área
   */
  get_area_measurements(
    area_id: number,
    start_time: string,
    end_time: string,
    limit: number = 100
  ): measurement[] {
    return this.db.prepare(`
      SELECT * FROM measurements 
      WHERE area_id = ? AND ts >= ? AND ts <= ?
      ORDER BY ts DESC 
      LIMIT ?
    `).all(area_id, start_time, end_time, limit) as measurement[];
  }

  // MÉTODOS PARA GESTIÓN DE PUNTOS DE ACCESO

  /**
   * Obtiene todos los puntos de acceso de un área
   */
  get_access_points_by_area(area_id: number): access_point[] {
    return this.db.prepare('SELECT * FROM access_points WHERE area_id = ? AND enabled = 1').all(area_id) as access_point[];
  }

  /**
   * Crea un nuevo punto de acceso
   */
  create_access_point(access_point_data: Omit<access_point, 'id' | 'created_at' | 'updated_at'>): number | null {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO access_points (area_id, fuente_id, direccion, geometry, enabled)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        access_point_data.area_id,
        access_point_data.fuente_id,
        access_point_data.direccion,
        access_point_data.geometry,
        access_point_data.enabled ? 1 : 0
      );

      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Error creating access point:', error);
      return null;
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
   * Actualizado para usar las nuevas tablas de áreas y eventos
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

    // Calcular rango de fechas
    const { start_date, end_date, bucket_labels } = this.calculate_date_range(view, date);

    // Obtener áreas activas
    const areas = this.get_all_areas().filter(area => area.enabled);
    
    if (areas.length === 0) {
      return {
        totals: [],
        by_hour: { labels: [], rows: [] },
        by_bucket: { labels: [], rows: [] }
      };
    }

    // Construir WHERE clause para eventos
    let where_clause = `
      WHERE ce.ts >= ? AND ce.ts <= ?
      AND ce.tipo IN ('enter', 'exit')
      AND a.enabled = 1
    `;
    let params = [start_date, end_date];

    // Filtrar por cámara si se especifica (usando puntos de acceso)
    if (camera) {
      where_clause += ` AND ap.fuente_id = ?`;
      params.push(camera);
    }

    // Query para totales por tipo de área
    const totals_query = `
      SELECT 
        a.tipo as label,
        COUNT(*) as cnt
      FROM counting_events ce
      JOIN areas a ON ce.area_id = a.id
      LEFT JOIN access_points ap ON a.id = ap.area_id
      ${where_clause}
      GROUP BY a.tipo
      ORDER BY cnt DESC
    `;
    const totals = this.db.prepare(totals_query).all(...params) as counting_summary_totals[];

    // Query para conteo por hora
    const by_hour_query = `
      SELECT 
        CAST(strftime('%H', ce.ts) AS INTEGER) as idx,
        a.tipo as label,
        COUNT(*) as cnt
      FROM counting_events ce
      JOIN areas a ON ce.area_id = a.id
      LEFT JOIN access_points ap ON a.id = ap.area_id
      ${where_clause}
      GROUP BY idx, a.tipo
      ORDER BY idx, a.tipo
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
        CAST(strftime('${bucket_format}', ce.ts) AS INTEGER) as idx,
        a.tipo as label,
        COUNT(*) as cnt
      FROM counting_events ce
      JOIN areas a ON ce.area_id = a.id
      LEFT JOIN access_points ap ON a.id = ap.area_id
      ${where_clause}
      GROUP BY idx, a.tipo
      ORDER BY idx, a.tipo
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
   * Obtiene el estado actual de todas las áreas
   */
  get_areas_current_status(): any {
    return this.db.prepare(`
      SELECT 
        a.id,
        a.nombre,
        a.tipo,
        a.max_ocupacion,
        a.estado_actual,
        a.color_estado,
        a.modo_limite,
        a.enabled,
        COUNT(ap.id) as access_points_count
      FROM areas a
      LEFT JOIN access_points ap ON a.id = ap.area_id AND ap.enabled = 1
      WHERE a.enabled = 1
      GROUP BY a.id
      ORDER BY a.nombre
    `).all();
  }

  /**
   * Obtiene eventos recientes de un área específica
   */
  get_area_recent_events(area_id: number, limit: number = 50): counting_new_event[] {
    return this.db.prepare(`
      SELECT * FROM counting_events 
      WHERE area_id = ? 
      ORDER BY ts DESC 
      LIMIT ?
    `).all(area_id, limit) as counting_new_event[];
  }

  /**
   * Obtiene estadísticas de alertas por área
   */
  get_alert_stats(start_date: string, end_date: string): any[] {
    return this.db.prepare(`
      SELECT 
        a.nombre as area_nombre,
        a.tipo,
        COUNT(CASE WHEN ce.tipo = 'warning' THEN 1 END) as warnings_count,
        COUNT(CASE WHEN ce.tipo = 'exceeded' THEN 1 END) as exceeded_count,
        MAX(ce.ts) as last_alert
      FROM areas a
      LEFT JOIN counting_events ce ON a.id = ce.area_id 
        AND ce.ts >= ? AND ce.ts <= ?
        AND ce.tipo IN ('warning', 'exceeded')
      WHERE a.enabled = 1
      GROUP BY a.id, a.nombre, a.tipo
      ORDER BY warnings_count + exceeded_count DESC
    `).all(start_date, end_date);
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
   * Obtiene estadísticas básicas del módulo (actualizado para nuevas tablas)
   */
  get_stats() {
    const config = this.get_configuration();
    if (!config) {
      return {
        total_events: 0,
        events_today: 0,
        active_areas: 0,
        active_cameras: 0,
        total_ocupacion: 0,
        areas_status: []
      };
    }

    const today = new Date().toISOString().split('T')[0];
    
    // Estadísticas de eventos (nuevas tablas)
    const total_events = this.db.prepare('SELECT COUNT(*) as count FROM counting_events').get() as { count: number };
    const events_today = this.db.prepare('SELECT COUNT(*) as count FROM counting_events WHERE DATE(ts) = ?').get(today) as { count: number };
    
    // Estadísticas de áreas
    const active_areas = this.db.prepare('SELECT COUNT(*) as count FROM areas WHERE enabled = 1').get() as { count: number };
    const total_ocupacion = this.db.prepare('SELECT SUM(estado_actual) as total FROM areas WHERE enabled = 1').get() as { total: number };
    
    // Estadísticas de cámaras (basado en puntos de acceso únicos)
    const active_cameras = this.db.prepare(`
      SELECT COUNT(DISTINCT fuente_id) as count 
      FROM access_points ap
      JOIN areas a ON ap.area_id = a.id 
      WHERE ap.enabled = 1 AND a.enabled = 1
    `).get() as { count: number };

    // Estado de cada área
    const areas_status = this.get_areas_current_status();

    return {
      total_events: total_events.count,
      events_today: events_today.count,
      active_areas: active_areas.count,
      active_cameras: active_cameras.count,
      total_ocupacion: total_ocupacion.total || 0,
      areas_status
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