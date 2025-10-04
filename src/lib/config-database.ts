/**
 * Sistema de configuración con SQLite
 * Maneja servidores, usuarios, grupos y configuraciones de backend
 */

import Database from 'better-sqlite3';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DB_DIR = path.join(process.cwd(), 'DB');
const CONFIG_DB_PATH = path.join(DB_DIR, 'config.db');

// Interfaces
export interface Server {
  id: number;
  name: string;
  url: string;
  port: number;
  protocol: 'http' | 'https';
  username?: string;
  password?: string;
  auth_type?: 'basic' | 'jwt' | 'none';
  jwt_token?: string;
  jwt_expires_at?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: 'admin' | 'operator' | 'viewer';
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  saved_views: string; // JSON array of view IDs
  created_at: string;
  updated_at: string;
}

export interface BackendConfig {
  id: number;
  service_name: string;
  enabled: boolean;
  config: string; // JSON configuration
  created_at: string;
  updated_at: string;
}

export interface ServerStatus {
  serverId: number;
  cpu_usage: number;
  gpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  api_status: 'online' | 'offline' | 'error';
  last_check: string;
}

class ConfigDatabase {
  private db: Database.Database;

  constructor() {
    this.initializeDatabase();
    this.db = new Database(CONFIG_DB_PATH);
    this.initializeTables();
    this.insertDefaultData();
  }

  private async initializeDatabase() {
    if (!existsSync(DB_DIR)) {
      await mkdir(DB_DIR, { recursive: true });
      console.log('📁 Directorio DB creado');
    }
  }

  private initializeTables() {
    // Tabla de servidores
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        url TEXT NOT NULL,
        port INTEGER NOT NULL,
        protocol TEXT NOT NULL CHECK(protocol IN ('http', 'https')),
        username TEXT,
        password TEXT,
        auth_type TEXT DEFAULT 'basic' CHECK(auth_type IN ('basic', 'jwt', 'none')),
        jwt_token TEXT,
        jwt_expires_at DATETIME,
        enabled BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Agregar columnas si no existen (migración)
    try {
      this.db.exec(`ALTER TABLE servers ADD COLUMN auth_type TEXT DEFAULT 'basic' CHECK(auth_type IN ('basic', 'jwt', 'none'))`);
    } catch (e) { /* Columna ya existe */ }
    
    try {
      this.db.exec(`ALTER TABLE servers ADD COLUMN jwt_token TEXT`);
    } catch (e) { /* Columna ya existe */ }
    
    try {
      this.db.exec(`ALTER TABLE servers ADD COLUMN jwt_expires_at DATETIME`);
    } catch (e) { /* Columna ya existe */ }

    // Tabla de usuarios
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin', 'operator', 'viewer')),
        enabled BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de grupos
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        saved_views TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de configuración de backend
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS backend_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_name TEXT NOT NULL UNIQUE,
        enabled BOOLEAN DEFAULT 0,
        config TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabla de estado de servidores (temporal, se actualiza periódicamente)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS server_status (
        server_id INTEGER PRIMARY KEY,
        cpu_usage REAL DEFAULT 0,
        gpu_usage REAL DEFAULT 0,
        memory_usage REAL DEFAULT 0,
        disk_usage REAL DEFAULT 0,
        api_status TEXT DEFAULT 'offline',
        last_check DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES servers (id) ON DELETE CASCADE
      )
    `);

    console.log('✅ Tablas de configuración inicializadas');
  }

  private insertDefaultData() {
    // Insertar servidor por defecto si no existe ninguno
    const serverCount = this.db.prepare('SELECT COUNT(*) as count FROM servers').get() as { count: number };
    
    if (serverCount.count === 0) {
      const serverId = this.db.prepare(`
        INSERT INTO servers (name, url, port, protocol, enabled)
        VALUES (?, ?, ?, ?, ?)
      `).run('Servidor Principal', '10.1.1.252', 5000, 'http', 1).lastInsertRowid;
      
      // Insertar estado por defecto para el servidor
      this.db.prepare(`
        INSERT INTO server_status (server_id, cpu_usage, gpu_usage, memory_usage, disk_usage, api_status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(serverId, 25.5, 0, 45.2, 62.8, 'online');
      
      console.log('🖥️ Servidor por defecto creado con estado inicial');
    }

    // Insertar usuario admin por defecto si no existe ninguno
    const userCount = this.db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    
    if (userCount.count === 0) {
      // Hash simple para "admin" (en producción usar bcrypt)
      const passwordHash = Buffer.from('admin').toString('base64');
      
      this.db.prepare(`
        INSERT INTO users (username, password_hash, role, enabled)
        VALUES (?, ?, ?, ?)
      `).run('admin', passwordHash, 'admin', 1);
      
      console.log('👤 Usuario admin por defecto creado');
    }

    // Insertar configuraciones de backend por defecto
    const backendCount = this.db.prepare('SELECT COUNT(*) as count FROM backend_config').get() as { count: number };
    
    if (backendCount.count === 0) {
      const services = [
        {
          name: 'LPR (Matrículas)',
          config: JSON.stringify({
            mqtt_host: 'localhost',
            mqtt_port: 1883,
            mqtt_topic: 'frigate/events',
            enabled: false
          })
        },
        {
          name: 'Conteo de Personas',
          config: JSON.stringify({
            mqtt_host: 'localhost',
            mqtt_port: 1883,
            mqtt_topic: 'frigate/stats',
            enabled: false
          })
        },
        {
          name: 'Notificaciones',
          config: JSON.stringify({
            webhook_url: '',
            email_enabled: false,
            sms_enabled: false
          })
        }
      ];

      for (const service of services) {
        this.db.prepare(`
          INSERT INTO backend_config (service_name, config, enabled)
          VALUES (?, ?, ?)
        `).run(service.name, service.config, 0);
      }
      
      console.log('⚙️ Configuraciones de backend por defecto creadas');
    }
  }

  // === MÉTODOS PARA SERVIDORES ===
  
  getAllServers(): Server[] {
    return this.db.prepare('SELECT * FROM servers ORDER BY name').all() as Server[];
  }

  getServerById(id: number): Server | undefined {
    return this.db.prepare('SELECT * FROM servers WHERE id = ?').get(id) as Server | undefined;
  }

  createServer(data: Omit<Server, 'id' | 'created_at' | 'updated_at'>): number {
    const result = this.db.prepare(`
      INSERT INTO servers (name, url, port, protocol, username, password, auth_type, jwt_token, jwt_expires_at, enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.name, 
      data.url, 
      data.port, 
      data.protocol, 
      data.username || null, 
      data.password || null, 
      data.auth_type || 'basic', 
      data.jwt_token || null, 
      data.jwt_expires_at || null, 
      data.enabled ? 1 : 0
    );
    
    return result.lastInsertRowid as number;
  }

  updateServer(id: number, data: Partial<Server>): boolean {
    const result = this.db.prepare(`
      UPDATE servers 
      SET name = ?, url = ?, port = ?, protocol = ?, username = ?, password = ?, 
          auth_type = ?, jwt_token = ?, jwt_expires_at = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      data.name, 
      data.url, 
      data.port, 
      data.protocol, 
      data.username || null, 
      data.password || null, 
      data.auth_type || 'basic',
      data.jwt_token || null, 
      data.jwt_expires_at || null, 
      data.enabled ? 1 : 0, 
      id
    );
    
    return result.changes > 0;
  }

  deleteServer(id: number): boolean {
    const result = this.db.prepare('DELETE FROM servers WHERE id = ?').run(id);
    return result.changes > 0;
  }

  toggleServer(id: number): boolean {
    const result = this.db.prepare(`
      UPDATE servers 
      SET enabled = NOT enabled, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    
    return result.changes > 0;
  }

  // === MÉTODOS PARA JWT ===
  
  updateServerJWT(id: number, token: string, expiresAt: string): boolean {
    const result = this.db.prepare(`
      UPDATE servers 
      SET jwt_token = ?, jwt_expires_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(token, expiresAt, id);
    
    return result.changes > 0;
  }

  clearServerJWT(id: number): boolean {
    const result = this.db.prepare(`
      UPDATE servers 
      SET jwt_token = NULL, jwt_expires_at = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);
    
    return result.changes > 0;
  }

  isJWTValid(id: number): boolean {
    const server = this.getServerById(id);
    if (!server || !server.jwt_token || !server.jwt_expires_at) {
      return false;
    }
    
    const expiresAt = new Date(server.jwt_expires_at);
    const now = new Date();
    
    return expiresAt > now;
  }

  // === MÉTODOS PARA USUARIOS ===
  
  getAllUsers(): User[] {
    return this.db.prepare('SELECT * FROM users ORDER BY username').all() as User[];
  }

  getUserById(id: number): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
  }

  getUserByUsername(username: string): User | undefined {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as User | undefined;
  }

  createUser(data: Omit<User, 'id' | 'created_at' | 'updated_at'>): number {
    const result = this.db.prepare(`
      INSERT INTO users (username, password_hash, role, enabled)
      VALUES (?, ?, ?, ?)
    `).run(data.username, data.password_hash, data.role, data.enabled);
    
    return result.lastInsertRowid as number;
  }

  updateUser(id: number, data: Partial<User>): boolean {
    const result = this.db.prepare(`
      UPDATE users 
      SET username = ?, password_hash = ?, role = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(data.username, data.password_hash, data.role, data.enabled, id);
    
    return result.changes > 0;
  }

  deleteUser(id: number): boolean {
    const result = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // === MÉTODOS PARA GRUPOS ===
  
  getAllGroups(): Group[] {
    return this.db.prepare('SELECT * FROM groups ORDER BY name').all() as Group[];
  }

  getGroupById(id: number): Group | undefined {
    return this.db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as Group | undefined;
  }

  createGroup(data: Omit<Group, 'id' | 'created_at' | 'updated_at'>): number {
    const result = this.db.prepare(`
      INSERT INTO groups (name, description, saved_views)
      VALUES (?, ?, ?)
    `).run(data.name, data.description, data.saved_views);
    
    return result.lastInsertRowid as number;
  }

  updateGroup(id: number, data: Partial<Group>): boolean {
    const result = this.db.prepare(`
      UPDATE groups 
      SET name = ?, description = ?, saved_views = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(data.name, data.description, data.saved_views, id);
    
    return result.changes > 0;
  }

  deleteGroup(id: number): boolean {
    const result = this.db.prepare('DELETE FROM groups WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // === MÉTODOS PARA CONFIGURACIÓN DE BACKEND ===
  
  getAllBackendConfigs(): BackendConfig[] {
    return this.db.prepare('SELECT * FROM backend_config ORDER BY service_name').all() as BackendConfig[];
  }

  getBackendConfigByService(serviceName: string): BackendConfig | undefined {
    return this.db.prepare('SELECT * FROM backend_config WHERE service_name = ?').get(serviceName) as BackendConfig | undefined;
  }

  updateBackendConfig(serviceName: string, config: string, enabled: boolean): boolean {
    const result = this.db.prepare(`
      UPDATE backend_config 
      SET config = ?, enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE service_name = ?
    `).run(config, enabled, serviceName);
    
    return result.changes > 0;
  }

  // Método para obtener configuración consolidada de backend
  getConsolidatedBackendConfig(): any {
    const configs = this.getAllBackendConfigs();
    const consolidated: any = {};
    
    // Configuraciones por defecto
    const defaultConfig = {
      lpr_enabled: false,
      lpr_confidence_threshold: 0.8,
      lpr_max_processing_time: 30,
      lpr_regions: '',
      lpr_save_images: true,
      lpr_webhook_url: '',
      counting_enabled: false,
      counting_zones: '',
      counting_reset_interval: 24,
      counting_min_confidence: 0.7,
      counting_webhook_url: '',
      notifications_enabled: false,
      email_enabled: false,
      email_smtp_host: '',
      email_smtp_port: 587,
      email_username: '',
      email_password: '',
      email_recipients: '',
      webhook_enabled: false,
      webhook_url: '',
      webhook_secret: '',
      telegram_enabled: false,
      telegram_bot_token: '',
      telegram_chat_id: '',
      db_retention_days: 30,
      db_auto_cleanup: true,
      db_backup_enabled: false,
      db_backup_interval: 7
    };

    // Aplicar configuraciones de servicios específicos
    configs.forEach(config => {
      try {
        const parsedConfig = JSON.parse(config.config);
        Object.assign(consolidated, parsedConfig);
      } catch (error) {
        console.error(`Error parsing config for ${config.service_name}:`, error);
      }
    });

    return { ...defaultConfig, ...consolidated };
  }

  // Método para actualizar configuración consolidada
  updateConsolidatedBackendConfig(configData: any): void {
    const serviceMappings = {
      lpr: ['lpr_enabled', 'lpr_confidence_threshold', 'lpr_max_processing_time', 'lpr_regions', 'lpr_save_images', 'lpr_webhook_url'],
      counting: ['counting_enabled', 'counting_zones', 'counting_reset_interval', 'counting_min_confidence', 'counting_webhook_url'],
      notifications: ['notifications_enabled', 'email_enabled', 'email_smtp_host', 'email_smtp_port', 'email_username', 'email_password', 'email_recipients', 'webhook_enabled', 'webhook_url', 'webhook_secret', 'telegram_enabled', 'telegram_bot_token', 'telegram_chat_id'],
      database: ['db_retention_days', 'db_auto_cleanup', 'db_backup_enabled', 'db_backup_interval']
    };

    Object.entries(serviceMappings).forEach(([serviceName, keys]) => {
      const serviceConfig: any = {};
      keys.forEach(key => {
        if (configData.hasOwnProperty(key)) {
          serviceConfig[key] = configData[key];
        }
      });

      if (Object.keys(serviceConfig).length > 0) {
        this.updateBackendConfig(serviceName, JSON.stringify(serviceConfig), true);
      }
    });
  }

  // === MÉTODOS PARA ESTADO DE SERVIDORES ===
  
  updateServerStatus(serverId: number, status: Omit<ServerStatus, 'serverId'>): boolean {
    const result = this.db.prepare(`
      INSERT OR REPLACE INTO server_status 
      (server_id, cpu_usage, gpu_usage, memory_usage, disk_usage, api_status, last_check)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      serverId, status.cpu_usage, status.gpu_usage, 
      status.memory_usage, status.disk_usage, status.api_status
    );
    
    return result.changes > 0;
  }

  getServerStatus(serverId: number): ServerStatus | undefined {
    return this.db.prepare('SELECT * FROM server_status WHERE server_id = ?').get(serverId) as ServerStatus | undefined;
  }

  getAllServerStatuses(): ServerStatus[] {
    return this.db.prepare('SELECT * FROM server_status').all() as ServerStatus[];
  }

  close() {
    this.db.close();
  }
}

// Singleton instance
let configDbInstance: ConfigDatabase | null = null;

export function getConfigDatabase(): ConfigDatabase {
  if (!configDbInstance) {
    configDbInstance = new ConfigDatabase();
  }
  return configDbInstance;
}

export default ConfigDatabase;