import * as fs from 'fs';
import * as path from 'path';

export interface LPRServer {
  id: string;
  name: string;
  mqtt_broker: string;
  mqtt_port: number;
  mqtt_user?: string;
  mqtt_pass?: string;
  frigate_url: string;
  frigate_token?: string;
  frigate_auth: 'bearer' | 'basic' | 'header';
  frigate_user?: string;
  frigate_pass?: string;
  frigate_header_name?: string;
  frigate_header_value?: string;
  mqtt_topic: string;
  sftp_host: string;
  sftp_port: number;
  sftp_user: string;
  sftp_pass: string;
  sftp_plate_root: string;
  sftp_plate_path_template: string;
  sftp_clip_mode: 'api' | 'sftp';
  sftp_clip_root: string;
  sftp_clip_path_template: string;
  enabled: boolean;
}

export interface LPRGeneralConfig {
  http_port: number;
  retention_days: number;
}

/**
 * Librería para gestión de configuración de servidores LPR
 * Lee y escribe directamente del archivo matriculas.conf
 */
export class LPRServersManager {
  private configPath: string;
  private cachedConfig: { general: LPRGeneralConfig; servers: Record<string, any> } | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'backend', 'Matriculas', 'matriculas.conf');
  }

  /**
   * Lee el archivo de configuración y lo parsea
   */
  private readConfig(): { general: LPRGeneralConfig; servers: Record<string, any> } {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    try {
      const content = fs.readFileSync(this.configPath, 'utf-8');
      const lines = content.split('\n');

      const general: any = {};
      const servers: Record<string, any> = {};
      let currentSection = '';
      let inServerSection = false;

      for (const line of lines) {
        const trimmed = line.trim();

        // Ignorar comentarios y líneas vacías
        if (!trimmed || trimmed.startsWith('#')) continue;

        // Nueva sección
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          currentSection = trimmed.slice(1, -1);
          inServerSection = currentSection.startsWith('server:');
          if (inServerSection) {
            const serverName = currentSection.split(':', 2)[1];
            servers[serverName] = {};
          }
          continue;
        }

        // Parsear clave=valor
        if (trimmed.includes('=')) {
          const [key, ...valueParts] = trimmed.split('=');
          const value = valueParts.join('=').trim();

          if (currentSection === 'general') {
            general[key.trim()] = value;
          } else if (inServerSection) {
            const serverName = currentSection.split(':', 2)[1];
            servers[serverName][key.trim()] = value;
          }
        }
      }

      this.cachedConfig = { general, servers };
      return this.cachedConfig;
    } catch (error) {
      console.error('Error reading LPR config file:', error);
      // Return default config if file doesn't exist or can't be read
      this.cachedConfig = {
        general: { http_port: 2221, retention_days: 30 },
        servers: {}
      };
      return this.cachedConfig;
    }
  }

  /**
   * Escribe la configuración al archivo
   */
  private writeConfig(general: LPRGeneralConfig, servers: Record<string, any>): void {
    let content = '# Configuración de Matrículas LPR\n';
    content += '# Generado automáticamente - NO EDITAR MANUALMENTE\n\n';

    // Sección general
    content += '[general]\n';
    content += `# Puerto HTTP del servicio (salud, logs, listados). Por defecto 2221\n`;
    content += `http_port = ${general.http_port}\n`;
    content += `# Días de retención de medios (carpetas por fecha). Por defecto 30\n`;
    content += `retention_days = ${general.retention_days}\n\n`;

    // Sección de servidores
    content += '# Definición de servidores (puede haber múltiples secciones server:<nombre>)\n';
    content += '# Parámetros soportados por servidor:\n';
    content += '# mqtt_broker, mqtt_port, mqtt_user, mqtt_pass\n';
    content += '# frigate_url, frigate_token (opcional si Frigate requiere token)\n';
    content += '# mqtt_topic (default: frigate/events)\n';
    content += '# sftp_host, sftp_port, sftp_user, sftp_pass\n';
    content += '# sftp_plate_path_template: ruta remota con placeholders {event_id} y {camera}\n\n';

    for (const [serverName, serverConfig] of Object.entries(servers)) {
      content += `[server:${serverName}]\n`;
      content += `mqtt_broker = ${serverConfig.mqtt_broker || '127.0.0.1'}\n`;
      content += `mqtt_port   = ${serverConfig.mqtt_port || 1883}\n`;
      content += `mqtt_user   = ${serverConfig.mqtt_user || ''}\n`;
      content += `mqtt_pass   = ${serverConfig.mqtt_pass || ''}\n`;
      content += `frigate_url = ${serverConfig.frigate_url || ''}\n`;

      content += '# Autenticación contra Frigate:\n';
      content += '#   frigate_auth = bearer | basic | header\n';
      content += '#   - bearer: usa frigate_token\n';
      content += '#   - basic: usa frigate_user / frigate_pass\n';
      content += '#   - header: envía cabecera personalizada (frigate_header_name / frigate_header_value)\n';
      content += `frigate_auth = ${serverConfig.frigate_auth || 'bearer'}\n`;
      content += `frigate_token = ${serverConfig.frigate_token || ''}\n`;
      content += `frigate_user = ${serverConfig.frigate_user || ''}\n`;
      content += `frigate_pass = ${serverConfig.frigate_pass || ''}\n`;
      content += `frigate_header_name = ${serverConfig.frigate_header_name || ''}\n`;
      content += `frigate_header_value = ${serverConfig.frigate_header_value || ''}\n`;

      content += `mqtt_topic  = ${serverConfig.mqtt_topic || 'frigate/events'}\n`;
      content += `sftp_host   = ${serverConfig.sftp_host || ''}\n`;
      content += `sftp_port   = ${serverConfig.sftp_port || 22}\n`;
      content += `sftp_user   = ${serverConfig.sftp_user || 'frigate'}\n`;
      content += `sftp_pass   = ${serverConfig.sftp_pass || 'frigate123'}\n`;

      content += '# Raíz configurable (por defecto /mnt/cctv/clips/lpr)\n';
      content += `sftp_plate_root = ${serverConfig.sftp_plate_root || '/mnt/cctv/clips/lpr'}\n`;
      content += '# Template admite {event_id}, {camera}, {root}\n';
      content += `sftp_plate_path_template = ${serverConfig.sftp_plate_path_template || '{root}/{camera}/{event_id}.jpg'}\n\n`;

      content += '# Descarga de CLIP (por defecto via API). Para usar SFTP:\n';
      content += '#   sftp_clip_mode = sftp\n';
      content += '#   sftp_clip_root = /mnt/cctv/clips/lpr\n';
      content += '#   sftp_clip_path_template = {root}/{camera}/\n';
      content += '# Si el template resuelve a una carpeta, se elegirá el .mp4 del evento si coincide con {event_id}\n';
      content += '# y si no, el .mp4 más reciente por fecha de modificación.\n';
      content += `sftp_clip_mode = ${serverConfig.sftp_clip_mode || 'api'}\n`;
      content += `sftp_clip_root = ${serverConfig.sftp_clip_root || '/mnt/cctv/clips/lpr'}\n`;
      content += `sftp_clip_path_template = ${serverConfig.sftp_clip_path_template || '{root}/{camera}/'}\n\n`;
    }

    fs.writeFileSync(this.configPath, content, 'utf-8');
    this.cachedConfig = null; // Invalidar cache
  }

  /**
   * Obtiene la configuración general
   */
  getGeneralConfig(): LPRGeneralConfig {
    const { general } = this.readConfig();
    return {
      http_port: parseInt(String(general.http_port || '2221')),
      retention_days: parseInt(String(general.retention_days || '30'))
    };
  }

  /**
   * Actualiza la configuración general
   */
  updateGeneralConfig(config: Partial<LPRGeneralConfig>): void {
    const current = this.readConfig();
    const updated = {
      ...current.general,
      ...config
    };
    this.writeConfig(updated, current.servers);
  }

  /**
   * Obtiene todos los servidores LPR
   */
  getAllServers(): LPRServer[] {
    const { servers } = this.readConfig();
    return Object.entries(servers).map(([name, config]) => this.mapConfigToServer(name, config));
  }

  /**
   * Obtiene un servidor por nombre
   */
  getServerByName(name: string): LPRServer | undefined {
    const servers = this.getAllServers();
    return servers.find(s => s.name === name);
  }

  /**
   * Obtiene servidores activos (habilitados)
   */
  getActiveServers(): LPRServer[] {
    return this.getAllServers().filter(s => s.enabled);
  }

  /**
   * Crea un nuevo servidor
   */
  createServer(serverData: Omit<LPRServer, 'id'>): string {
    const current = this.readConfig();
    const serverName = serverData.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

    // Verificar que no exista
    if (current.servers[serverName]) {
      throw new Error(`Servidor ${serverName} ya existe`);
    }

    current.servers[serverName] = this.mapServerToConfig(serverData);
    this.writeConfig(current.general, current.servers);
    return serverName;
  }

  /**
   * Actualiza un servidor existente
   */
  updateServer(name: string, serverData: Partial<LPRServer>): boolean {
    const current = this.readConfig();

    if (!current.servers[name]) {
      return false;
    }

    current.servers[name] = {
      ...current.servers[name],
      ...this.mapServerToConfig(serverData)
    };

    this.writeConfig(current.general, current.servers);
    return true;
  }

  /**
   * Elimina un servidor
   */
  deleteServer(name: string): boolean {
    const current = this.readConfig();

    if (!current.servers[name]) {
      return false;
    }

    delete current.servers[name];
    this.writeConfig(current.general, current.servers);
    return true;
  }

  /**
   * Mapea configuración del archivo a objeto LPRServer
   */
  private mapConfigToServer(name: string, config: any): LPRServer {
    return {
      id: name,
      name: name,
      mqtt_broker: config.mqtt_broker || '127.0.0.1',
      mqtt_port: parseInt(config.mqtt_port || '1883'),
      mqtt_user: config.mqtt_user || '',
      mqtt_pass: config.mqtt_pass || '',
      frigate_url: config.frigate_url || '',
      frigate_token: config.frigate_token || '',
      frigate_auth: (config.frigate_auth || 'bearer') as 'bearer' | 'basic' | 'header',
      frigate_user: config.frigate_user || '',
      frigate_pass: config.frigate_pass || '',
      frigate_header_name: config.frigate_header_name || '',
      frigate_header_value: config.frigate_header_value || '',
      mqtt_topic: config.mqtt_topic || 'frigate/events',
      sftp_host: config.sftp_host || '',
      sftp_port: parseInt(config.sftp_port || '22'),
      sftp_user: config.sftp_user || 'frigate',
      sftp_pass: config.sftp_pass || 'frigate123',
      sftp_plate_root: config.sftp_plate_root || '/mnt/cctv/clips/lpr',
      sftp_plate_path_template: config.sftp_plate_path_template || '{root}/{camera}/{event_id}.jpg',
      sftp_clip_mode: (config.sftp_clip_mode || 'api') as 'api' | 'sftp',
      sftp_clip_root: config.sftp_clip_root || '/mnt/cctv/clips/lpr',
      sftp_clip_path_template: config.sftp_clip_path_template || '{root}/{camera}/',
      enabled: true // Por ahora todos están habilitados
    };
  }

  /**
   * Mapea objeto LPRServer a configuración del archivo
   */
  private mapServerToConfig(server: Partial<LPRServer>): any {
    return {
      mqtt_broker: server.mqtt_broker,
      mqtt_port: server.mqtt_port?.toString(),
      mqtt_user: server.mqtt_user,
      mqtt_pass: server.mqtt_pass,
      frigate_url: server.frigate_url,
      frigate_token: server.frigate_token,
      frigate_auth: server.frigate_auth,
      frigate_user: server.frigate_user,
      frigate_pass: server.frigate_pass,
      frigate_header_name: server.frigate_header_name,
      frigate_header_value: server.frigate_header_value,
      mqtt_topic: server.mqtt_topic,
      sftp_host: server.sftp_host,
      sftp_port: server.sftp_port?.toString(),
      sftp_user: server.sftp_user,
      sftp_pass: server.sftp_pass,
      sftp_plate_root: server.sftp_plate_root,
      sftp_plate_path_template: server.sftp_plate_path_template,
      sftp_clip_mode: server.sftp_clip_mode,
      sftp_clip_root: server.sftp_clip_root,
      sftp_clip_path_template: server.sftp_clip_path_template
    };
  }
}

// Instancia global
let lprServersManager: LPRServersManager;

export function getLPRServersManager(): LPRServersManager {
  if (!lprServersManager) {
    lprServersManager = new LPRServersManager();
  }
  return lprServersManager;
}

/**
 * Funciones de conveniencia
 */
export function getActiveLPRServers(): LPRServer[] {
  return getLPRServersManager().getActiveServers();
}

export function getAllLPRServers(): LPRServer[] {
  return getLPRServersManager().getAllServers();
}

export function getLPRServerByName(name: string): LPRServer | undefined {
  return getLPRServersManager().getServerByName(name);
}