/**
 * Sistema de configuración con SQLite
 * Maneja servidores, usuarios, grupos y configuraciones de backend
 */

import Database from 'better-sqlite3';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { getDatabase } from './database';  // Importar la base de vistas
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

/**
 * Define los permisos disponibles en el sistema
 */
export interface Permission {
  module: 'live' | 'events' | 'recordings' | 'settings' | 'users' | 'servers' | 'statistics';
  action: 'view' | 'create' | 'edit' | 'delete' | 'manage';
  allowed: boolean;
}

/**
 * Define el conjunto completo de permisos para un rol
 */
export interface RolePermissions {
  role: 'admin' | 'operator' | 'viewer';
  permissions: Permission[];
}

export interface BackendConfig {
  id: number;
  service_name: string;
  enabled: boolean;
  auto_start: boolean;
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

/**
 * Configuración de paneles del sistema
 */
export interface PanelConfig {
  id: number;
  panel_name: 'lpr' | 'counting_people' | 'counting_vehicles';
  enabled: boolean;
  title: string;
  cameras: string; // JSON array of camera names
  config: string; // JSON configuration específica del panel
  created_at: string;
  updated_at: string;
}

/**
 * Configuración detallada de cada panel
 */
export interface LPRPanelConfig {
  enabled: boolean;
  title: string;
  cameras: string[];
  confidence_threshold: number;
  regions: string[];
  save_images: boolean;
  webhook_url?: string;
  retention_days: number;
}

export interface CountingPeoplePanelConfig {
  enabled: boolean;
  title: string;
  cameras: string[];
  areas: Array<{
    id: string;
    name: string;
    max_occupancy: number;
    warning_threshold: number;
    critical_threshold: number;
  }>;
  confidence_threshold: number;
  retention_days: number;
}

export interface CountingVehiclesPanelConfig {
  enabled: boolean;
  title: string;
  cameras: string[];
  zones: Array<{
    camera_name: string;
    zone_in: string;
    zone_out: string;
  }>;
  objects: string[]; // ['car', 'truck', 'motorcycle']
  confidence_threshold: number;
  retention_days: number;
}

type ApplicationSettings = Record<string, string>;

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

    // Tabla de relación usuario-grupo
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS user_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        group_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE,
        UNIQUE(user_id, group_id)
      )
    `);

    // Tabla de configuración de backend
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS backend_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_name TEXT NOT NULL UNIQUE,
        enabled BOOLEAN DEFAULT 0,
        auto_start BOOLEAN DEFAULT 0,
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

    // Tabla de configuración de la aplicación (tema, idioma, etc.)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

    // Tabla de configuración de paneles
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS panel_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        panel_name TEXT NOT NULL UNIQUE CHECK(panel_name IN ('lpr', 'counting_people', 'counting_vehicles')),
        enabled BOOLEAN DEFAULT 0,
        title TEXT NOT NULL,
        cameras TEXT DEFAULT '[]',
        config TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Tablas de configuración inicializadas');

    // Ejecutar migraciones
    this.runMigrations();
  }

  private runMigrations(): void {
    // Importar y ejecutar migraciones
    try {
      const { runAutoStartMigration } = require('./migrations');
      runAutoStartMigration(this);
    } catch (error) {
      console.error('Error ejecutando migraciones:', error);
    }
  }

  private insertDefaultData() {
    // No crear servidores por defecto, dejar la tabla limpia si no existen
    const serverCount = this.db.prepare('SELECT COUNT(*) as count FROM servers').get() as { count: number };
    if (serverCount.count === 0) {
      console.log('🖥️ Tabla de servidores inicializada vacía');
    }

    // Insertar usuario admin por defecto si no existe ninguno
    const userCount = this.db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    
    if (userCount.count === 0) {
      // Hash simple para "admin123" (en producción usar bcrypt)
      const passwordHash = Buffer.from('admin123').toString('base64');
      
      this.db.prepare(`
        INSERT INTO users (username, password_hash, role, enabled)
        VALUES (?, ?, ?, ?)
      `).run('admin', passwordHash, 'admin', 1);
      
      console.log('👤 Usuario admin por defecto creado');
    } else {
      // Actualizar contraseña del admin existente si es necesario
      const existingAdmin = this.db.prepare('SELECT * FROM users WHERE username = ?').get('admin') as User | undefined;
      if (existingAdmin && existingAdmin.password_hash === Buffer.from('admin').toString('base64')) {
        const newPasswordHash = Buffer.from('admin123').toString('base64');
        this.db.prepare('UPDATE users SET password_hash = ? WHERE username = ?').run(newPasswordHash, 'admin');
        console.log('🔐 Contraseña de admin actualizada a admin123');
      }
    }

    // Insertar grupos por defecto si no existen
    const groupCount = this.db.prepare('SELECT COUNT(*) as count FROM groups').get() as { count: number };
    
    if (groupCount.count === 0) {
      const defaultGroups = [
        {
          name: 'admins',
          description: 'Administradores con acceso completo a todas las funciones del sistema',
          saved_views: '[]'
        },
        {
          name: 'usuarios',
          description: 'Usuarios con acceso a todas las funciones excepto configuración',
          saved_views: '[]'
        },
        {
          name: 'viewers',
          description: 'Visualizadores con acceso únicamente a las vistas en vivo',
          saved_views: '[]'
        }
      ];

      const insertGroup = this.db.prepare(`
        INSERT INTO groups (name, description, saved_views)
        VALUES (?, ?, ?)
      `);

      for (const group of defaultGroups) {
        insertGroup.run(group.name, group.description, group.saved_views);
      }
      
      console.log('👥 Grupos por defecto creados (admins, usuarios, viewers)');
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

    // Insertar configuraciones de paneles por defecto
    const panelCount = this.db.prepare('SELECT COUNT(*) as count FROM panel_config').get() as { count: number };
    
    if (panelCount.count === 0) {
      const defaultPanels = [
        {
          panel_name: 'lpr',
          enabled: false,
          title: 'Reconocimiento de Matrículas',
          cameras: '[]',
          config: JSON.stringify({
            confidence_threshold: 0.8,
            regions: [],
            save_images: true,
            webhook_url: '',
            retention_days: 60
          })
        },
        {
          panel_name: 'counting_people',
          enabled: false,
          title: 'Conteo de Personas',
          cameras: '[]',
          config: JSON.stringify({
            areas: [],
            confidence_threshold: 0.7,
            retention_days: 30
          })
        },
        {
          panel_name: 'counting_vehicles',
          enabled: false,
          title: 'Conteo Vehicular',
          cameras: '[]',
          config: JSON.stringify({
            zones: [],
            objects: ['car', 'truck', 'motorcycle'],
            confidence_threshold: 0.7,
            retention_days: 30
          })
        }
      ];

      const insertPanel = this.db.prepare(`
        INSERT INTO panel_config (panel_name, enabled, title, cameras, config)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const panel of defaultPanels) {
        insertPanel.run(panel.panel_name, panel.enabled ? 1 : 0, panel.title, panel.cameras, panel.config);
      }
      
      console.log('📊 Configuraciones de paneles por defecto creadas');
    }

    // Insertar configuraciones de aplicación por defecto
    const settingsCount = this.db.prepare('SELECT COUNT(*) as count FROM app_settings').get() as { count: number };
    if (settingsCount.count === 0) {
      const stmt = this.db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)`);
      stmt.run('theme', 'system');
      stmt.run('language', 'es');
      console.log('🔧 Configuraciones de aplicación por defecto creadas');
    }

  }

  /**
   * Obtiene todas las preferencias globales de la aplicación.
   */
  get_application_settings(): ApplicationSettings {
    const rows = this.db.prepare('SELECT key, value FROM app_settings').all() as { key: string; value: string }[];

    return rows.reduce((accumulator, row) => {
      accumulator[row.key] = row.value;
      return accumulator;
    }, {} as ApplicationSettings);
  }

  /**
   * Actualiza o crea una preferencia global.
   */
  set_application_setting(setting_key: string, setting_value: string): void {
    this.db.prepare(`
      INSERT INTO app_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(setting_key, setting_value);
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
    const users = this.db.prepare('SELECT * FROM users ORDER BY username').all() as any[];
    return users.map(user => ({
      ...user,
      enabled: Boolean(user.enabled)
    })) as User[];
  }

  getUserById(id: number): User | undefined {
    const user = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!user) return undefined;
    return {
      ...user,
      enabled: Boolean(user.enabled)
    } as User;
  }

  getUserByUsername(username: string): User | undefined {
    const user = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    if (!user) return undefined;
    return {
      ...user,
      enabled: Boolean(user.enabled)
    } as User;
  }

  createUser(data: Omit<User, 'id' | 'created_at' | 'updated_at'>): number {
    const result = this.db.prepare(`
      INSERT INTO users (username, password_hash, role, enabled)
      VALUES (?, ?, ?, ?)
    `).run(data.username, data.password_hash, data.role, data.enabled ? 1 : 0);
    
    return result.lastInsertRowid as number;
  }

  updateUser(id: number, data: Partial<User>): boolean {
    // Construir la consulta dinámicamente según los campos proporcionados
    const fields: string[] = [];
    const values: any[] = [];
    
    if (data.username !== undefined) {
      fields.push('username = ?');
      values.push(data.username);
    }
    
    if (data.password_hash !== undefined) {
      fields.push('password_hash = ?');
      values.push(data.password_hash);
    }
    
    if (data.role !== undefined) {
      fields.push('role = ?');
      values.push(data.role);
    }
    
    if (data.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(data.enabled ? 1 : 0);
    }
    
    if (fields.length === 0) {
      return false; // No hay campos para actualizar
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id); // ID va al final
    
    const query = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    const result = this.db.prepare(query).run(...values);
    
    return result.changes > 0;
  }

  deleteUser(id: number): boolean {
    const result = this.db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return result.changes > 0;
  }

  // === MÉTODOS PARA GRUPOS ===
  
  getAllGroups(): Group[] {
    const groups = this.db.prepare('SELECT * FROM groups ORDER BY name').all() as Group[];
    
    // Ordenar para que los grupos predefinidos aparezcan primero
    const predefinedOrder = ['admins', 'usuarios', 'viewers'];
    const predefinedGroups = groups.filter(g => predefinedOrder.includes(g.name));
    const customGroups = groups.filter(g => !predefinedOrder.includes(g.name));
    
    // Ordenar grupos predefinidos según el orden especificado
    predefinedGroups.sort((a, b) => {
      const aIndex = predefinedOrder.indexOf(a.name);
      const bIndex = predefinedOrder.indexOf(b.name);
      return aIndex - bIndex;
    });
    
    return [...predefinedGroups, ...customGroups];
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

  // === MÉTODOS PARA PERMISOS ===

  /**
   * Obtiene los permisos completos para un rol específico
   * @param role - Rol del usuario: 'admin', 'operator' o 'viewer'
   * @returns Objeto con el rol y array de permisos
   */
  get_role_permissions(role: 'admin' | 'operator' | 'viewer'): RolePermissions {
    const basePermissions: Permission[] = [
      // Módulo Live (Vista en vivo)
      { module: 'live', action: 'view', allowed: true },

      // Módulo Events (Eventos)
      { module: 'events', action: 'view', allowed: role !== 'viewer' },
      { module: 'events', action: 'create', allowed: role === 'admin' },
      { module: 'events', action: 'edit', allowed: role === 'admin' },
      { module: 'events', action: 'delete', allowed: role === 'admin' },

      // Módulo Recordings (Grabaciones)
      { module: 'recordings', action: 'view', allowed: role !== 'viewer' },
      { module: 'recordings', action: 'create', allowed: role === 'admin' },
      { module: 'recordings', action: 'edit', allowed: role === 'admin' },
      { module: 'recordings', action: 'delete', allowed: role === 'admin' },

      // Módulo Settings (Configuración general)
      { module: 'settings', action: 'view', allowed: role === 'admin' },
      { module: 'settings', action: 'edit', allowed: role === 'admin' },
      { module: 'settings', action: 'manage', allowed: role === 'admin' },

      // Módulo Users (Gestión de usuarios)
      { module: 'users', action: 'view', allowed: role === 'admin' },
      { module: 'users', action: 'create', allowed: role === 'admin' },
      { module: 'users', action: 'edit', allowed: role === 'admin' },
      { module: 'users', action: 'delete', allowed: role === 'admin' },
      { module: 'users', action: 'manage', allowed: role === 'admin' },

      // Módulo Servers (Gestión de servidores)
      { module: 'servers', action: 'view', allowed: role === 'admin' },
      { module: 'servers', action: 'create', allowed: role === 'admin' },
      { module: 'servers', action: 'edit', allowed: role === 'admin' },
      { module: 'servers', action: 'delete', allowed: role === 'admin' },
      { module: 'servers', action: 'manage', allowed: role === 'admin' },

      // Módulo Statistics (Estadísticas)
      { module: 'statistics', action: 'view', allowed: role !== 'viewer' }
    ];

    return {
      role,
      permissions: basePermissions
    };
  }

  /**
   * Verifica si un usuario tiene un permiso específico
   * @param user_id - ID del usuario a verificar
   * @param module - Módulo del sistema a verificar
   * @param action - Acción específica dentro del módulo
   * @returns true si el usuario tiene el permiso, false en caso contrario
   */
  check_user_permission(user_id: number, module: Permission['module'], action: Permission['action']): boolean {
    const user = this.getUserById(user_id);
    if (!user || !user.enabled) {
      return false;
    }

    const rolePermissions = this.get_role_permissions(user.role);
    const permission = rolePermissions.permissions.find(p => p.module === module && p.action === action);
    
    return permission?.allowed || false;
  }

  /**
   * Verifica si un usuario por nombre de usuario tiene un permiso específico
   * @param username - Nombre de usuario a verificar
   * @param module - Módulo del sistema a verificar
   * @param action - Acción específica dentro del módulo
   * @returns true si el usuario tiene el permiso, false en caso contrario
   */
  check_user_permission_by_username(username: string, module: Permission['module'], action: Permission['action']): boolean {
    const user = this.getUserByUsername(username);
    if (!user || !user.enabled) {
      return false;
    }

    return this.check_user_permission(user.id, module, action);
  }

  /**
   * Obtiene todos los módulos a los que un usuario tiene acceso
   * @param user_id - ID del usuario
   * @returns Array con los nombres de los módulos accesibles
   */
  get_user_accessible_modules(user_id: number): string[] {
    const user = this.getUserById(user_id);
    if (!user || !user.enabled) {
      return [];
    }

    const rolePermissions = this.get_role_permissions(user.role);
    const accessibleModules = new Set<string>();

    rolePermissions.permissions.forEach(permission => {
      if (permission.allowed && permission.action === 'view') {
        accessibleModules.add(permission.module);
      }
    });

    return Array.from(accessibleModules);
  }

  // === MÉTODOS PARA CONFIGURACIÓN DE BACKEND ===
  
  getAllBackendConfigs(): BackendConfig[] {
    return this.db.prepare('SELECT * FROM backend_config ORDER BY service_name').all() as BackendConfig[];
  }

  getBackendConfigByService(serviceName: string): BackendConfig | undefined {
    return this.db.prepare('SELECT * FROM backend_config WHERE service_name = ?').get(serviceName) as BackendConfig | undefined;
  }

  updateBackendConfig(serviceName: string, config: string, enabled: boolean, autoStart?: boolean): boolean {
    try {
      // Validar que los parámetros sean del tipo correcto
      if (typeof serviceName !== 'string') {
        throw new Error(`serviceName debe ser string, recibido: ${typeof serviceName}`);
      }
      if (typeof config !== 'string') {
        throw new Error(`config debe ser string, recibido: ${typeof config} - ${config}`);
      }
      if (typeof enabled !== 'boolean') {
        throw new Error(`enabled debe ser boolean, recibido: ${typeof enabled}`);
      }

      console.log('=== UPDATE BACKEND CONFIG NUEVA VERSION ===');
      console.log('Updating backend config:', { serviceName, configLength: config.length, enabled, autoStart });

      // Primero verificar si el registro existe
      const exists = this.db.prepare(`
        SELECT COUNT(*) as count FROM backend_config WHERE service_name = ?
      `).get(serviceName) as { count: number };

      console.log('Registry exists check:', exists);

      if (exists.count === 0) {
        // Insertar nuevo registro
        console.log('Inserting new backend config for:', serviceName);
        const insertResult = this.db.prepare(`
          INSERT INTO backend_config (service_name, config, enabled, auto_start, created_at, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(serviceName, config, enabled ? 1 : 0, (autoStart ?? false) ? 1 : 0);
        
        console.log('Insert result:', insertResult);
        return insertResult.changes > 0;
      } else {
        // Actualizar registro existente
        console.log('Updating existing backend config for:', serviceName);
        const updateFields = ['config = ?', 'enabled = ?'];
        const updateValues = [config, enabled ? 1 : 0];
        
        if (autoStart !== undefined) {
          updateFields.push('auto_start = ?');
          updateValues.push(autoStart ? 1 : 0);
        }
        
        updateValues.push(serviceName); // WHERE clause
        
        const updateResult = this.db.prepare(`
          UPDATE backend_config 
          SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
          WHERE service_name = ?
        `).run(...updateValues);
        
        console.log('Update result:', updateResult);
        return updateResult.changes > 0;
      }
    } catch (error) {
      console.error('Error in updateBackendConfig:', error);
      console.error('Parameters:', { serviceName, config, enabled });
      throw error;
    }
  }

  /**
   * Actualiza solo el estado auto_start de un servicio
   */
  updateBackendAutoStart(serviceName: string, autoStart: boolean): boolean {
    try {
      const result = this.db.prepare(`
        UPDATE backend_config 
        SET auto_start = ?, updated_at = CURRENT_TIMESTAMP
        WHERE service_name = ?
      `).run(autoStart ? 1 : 0, serviceName);
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating auto_start:', error);
      return false;
    }
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
      // Configuración MQTT para LPR
      lpr_mqtt_host: 'localhost',
      lpr_mqtt_port: 1883,
      lpr_mqtt_username: '',
      lpr_mqtt_password: '',
      lpr_mqtt_use_ssl: false,
      lpr_mqtt_topics_prefix: 'frigate',
      // Configuración Frigate para LPR
      lpr_frigate_server_id: '',
      // Configuración de retención para LPR
      lpr_retention_events_days: 60,
      lpr_retention_clips_days: 30,
      lpr_retention_snapshots_days: 60,
      lpr_retention_max_storage_gb: 50,
      lpr_auto_cleanup: true,
      // Configuración de conteo
      counting_enabled: false,
      counting_zones: '',
      counting_reset_interval: 24,
      counting_min_confidence: 0.7,
      counting_webhook_url: '',
      // Configuración de notificaciones
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
      // Configuración de base de datos
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
    console.log('Received config data:', configData);
    console.log('Config data type:', typeof configData);
    
    const serviceMappings = {
      lpr: [
        'lpr_enabled', 'lpr_confidence_threshold', 'lpr_max_processing_time', 'lpr_regions', 'lpr_save_images', 'lpr_webhook_url',
        'lpr_mqtt_host', 'lpr_mqtt_port', 'lpr_mqtt_username', 'lpr_mqtt_password', 'lpr_mqtt_use_ssl', 'lpr_mqtt_topics_prefix',
        'lpr_frigate_server_id', 'lpr_retention_events_days', 'lpr_retention_clips_days', 'lpr_retention_snapshots_days', 
        'lpr_retention_max_storage_gb', 'lpr_auto_cleanup'
      ],
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
        console.log(`Processing service: ${serviceName}`, serviceConfig);
        const configJson = JSON.stringify(serviceConfig);
        console.log(`Config JSON for ${serviceName}:`, configJson);
        this.updateBackendConfig(serviceName, configJson, true);
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

  // === MÉTODOS PARA RELACIONES USUARIO-GRUPO ===
  
  /**
   * Asigna un grupo a un usuario
   */
  assignUserToGroup(userId: number, groupId: number): boolean {
    try {
      const result = this.db.prepare(`
        INSERT INTO user_groups (user_id, group_id)
        VALUES (?, ?)
      `).run(userId, groupId);
      return result.changes > 0;
    } catch (error) {
      // Si ya existe la relación, ignorar
      return false;
    }
  }

  /**
   * Remueve un usuario de un grupo
   */
  removeUserFromGroup(userId: number, groupId: number): boolean {
    const result = this.db.prepare(`
      DELETE FROM user_groups 
      WHERE user_id = ? AND group_id = ?
    `).run(userId, groupId);
    return result.changes > 0;
  }

  /**
   * Obtiene los grupos asignados a un usuario
   */
  getUserGroups(userId: number): Group[] {
    return this.db.prepare(`
      SELECT g.* FROM groups g
      INNER JOIN user_groups ug ON g.id = ug.group_id
      WHERE ug.user_id = ?
      ORDER BY g.name
    `).all(userId) as Group[];
  }

  /**
   * Obtiene los usuarios asignados a un grupo
   */
  getGroupUsers(groupId: number): User[] {
    const users = this.db.prepare(`
      SELECT u.* FROM users u
      INNER JOIN user_groups ug ON u.id = ug.user_id
      WHERE ug.group_id = ?
      ORDER BY u.username
    `).all(groupId) as any[];
    
    return users.map(user => ({
      ...user,
      enabled: Boolean(user.enabled)
    })) as User[];
  }

  /**
   * Actualiza los grupos asignados a un usuario (reemplaza todos)
   */
  updateUserGroups(userId: number, groupIds: number[]): boolean {
    const deleteExisting = this.db.prepare('DELETE FROM user_groups WHERE user_id = ?');
    const insertNew = this.db.prepare('INSERT INTO user_groups (user_id, group_id) VALUES (?, ?)');
    
    const transaction = this.db.transaction((userId: number, groupIds: number[]) => {
      deleteExisting.run(userId);
      for (const groupId of groupIds) {
        insertNew.run(userId, groupId);
      }
    });
    
    try {
      transaction(userId, groupIds);
      return true;
    } catch (error) {
      console.error('Error updating user groups:', error);
      return false;
    }
  }

  /**
   * Obtiene todas las vistas disponibles para un usuario (propias + de grupos)
   */
  getUserAvailableViews(userId: number): string[] {
    const user = this.getUserById(userId);
    if (!user) return [];

    // Admin tiene acceso a todas las vistas
    if (user.role === 'admin') {
      try {
        const viewsDb = getDatabase();
        const allViews = viewsDb.getAllViews();
        return allViews.map(view => view.id.toString());
      } catch (error) {
        console.warn('Error accessing views database:', error);
        return [];
      }
    }

    // Para otros usuarios, obtener vistas de sus grupos
    const userGroups = this.getUserGroups(userId);
    const allViews = new Set<string>();

    for (const group of userGroups) {
      try {
        const groupViews = JSON.parse(group.saved_views);
        if (Array.isArray(groupViews)) {
          groupViews.forEach(viewId => allViews.add(viewId));
        }
      } catch (error) {
        console.warn(`Error parsing views for group ${group.name}:`, error);
      }
    }

    return Array.from(allViews);
  }

  /**
   * Obtiene el conteo de vistas disponibles para un usuario
   */
  getUserAvailableViewsCount(userId: number): number {
    return this.getUserAvailableViews(userId).length;
  }

  /**
   * Obtiene todas las vistas del sistema (desde la base de vistas)
   */
  getAllSystemViews() {
    try {
      const viewsDb = getDatabase();
      return viewsDb.getAllViews();
    } catch (error) {
      console.warn('Error accessing views database:', error);
      return [];
    }
  }

  // ========================================
  // MÉTODOS PARA CONFIGURACIÓN DE PANELES
  // ========================================

  /**
   * Obtiene todas las configuraciones de paneles
   */
  getAllPanelConfigs(): PanelConfig[] {
    return this.db.prepare('SELECT * FROM panel_config ORDER BY panel_name').all() as PanelConfig[];
  }

  /**
   * Obtiene la configuración de un panel específico
   */
  getPanelConfig(panel_name: 'lpr' | 'counting_people' | 'counting_vehicles'): PanelConfig | null {
    return this.db.prepare('SELECT * FROM panel_config WHERE panel_name = ?').get(panel_name) as PanelConfig | null;
  }

  /**
   * Actualiza la configuración de un panel
   */
  updatePanelConfig(panel_name: 'lpr' | 'counting_people' | 'counting_vehicles', enabled: boolean, title: string, cameras: string[], config: object): boolean {
    try {
      this.db.prepare(`
        UPDATE panel_config 
        SET enabled = ?, title = ?, cameras = ?, config = ?, updated_at = CURRENT_TIMESTAMP
        WHERE panel_name = ?
      `).run(enabled ? 1 : 0, title, JSON.stringify(cameras), JSON.stringify(config), panel_name);
      return true;
    } catch (error) {
      console.error('Error updating panel config:', error);
      return false;
    }
  }

  /**
   * Habilita o deshabilita un panel
   */
  setPanelEnabled(panel_name: 'lpr' | 'counting_people' | 'counting_vehicles', enabled: boolean): boolean {
    try {
      this.db.prepare(`
        UPDATE panel_config 
        SET enabled = ?, updated_at = CURRENT_TIMESTAMP
        WHERE panel_name = ?
      `).run(enabled ? 1 : 0, panel_name);
      return true;
    } catch (error) {
      console.error('Error updating panel enabled status:', error);
      return false;
    }
  }

  /**
   * Obtiene únicamente los paneles habilitados
   */
  getEnabledPanels(): PanelConfig[] {
    return this.db.prepare('SELECT * FROM panel_config WHERE enabled = 1 ORDER BY panel_name').all() as PanelConfig[];
  }

  /**
   * Obtiene las cámaras asignadas a un panel específico
   */
  getPanelCameras(panel_name: 'lpr' | 'counting_people' | 'counting_vehicles'): string[] {
    const panel = this.getPanelConfig(panel_name);
    if (!panel) return [];
    
    try {
      const cameras = JSON.parse(panel.cameras);
      return Array.isArray(cameras) ? cameras : [];
    } catch (error) {
      console.error('Error parsing panel cameras:', error);
      return [];
    }
  }

  /**
   * Actualiza las cámaras asignadas a un panel
   */
  updatePanelCameras(panel_name: 'lpr' | 'counting_people' | 'counting_vehicles', cameras: string[]): boolean {
    try {
      this.db.prepare(`
        UPDATE panel_config 
        SET cameras = ?, updated_at = CURRENT_TIMESTAMP
        WHERE panel_name = ?
      `).run(JSON.stringify(cameras), panel_name);
      return true;
    } catch (error) {
      console.error('Error updating panel cameras:', error);
      return false;
    }
  }

  /**
   * Ejecuta una migración SQL directa en la base de datos
   */
  runMigration(sql: string): void {
    try {
      this.db.exec(sql);
    } catch (error) {
      console.error('Error ejecutando migración:', error);
      throw error;
    }
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