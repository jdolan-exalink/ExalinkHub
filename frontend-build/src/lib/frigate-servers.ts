import { getConfigDatabase } from './config-database';

export interface FrigateServer {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  status?: Record<string, unknown>;
  auth?: {
    type: 'bearer' | 'basic';
    token?: string;
    username?: string;
    password?: string;
  };
}

function map_server_to_frigate_server(server: any): FrigateServer {
  let auth;
  if (server.auth_type === 'basic' || server.auth_type === 'bearer') {
    auth = {
      type: server.auth_type,
      username: server.username,
      password: server.password,
      token: server.jwt_token
    };
  }
  return {
    id: String(server.id),
    name: server.name,
    baseUrl: `${server.protocol}://${server.url}:${server.port}`,
    enabled: server.enabled,
    auth
  };
}

export function get_active_frigate_servers(): FrigateServer[] {
  const db_instance = getConfigDatabase();
  return db_instance.getAllServers()
    .filter(server => server.enabled)
    .map(map_server_to_frigate_server);
}

export function get_frigate_server_by_id(server_id: string | number): FrigateServer | undefined {
  const db_instance = getConfigDatabase();
  const server = db_instance.getServerById(Number(server_id));
  if (!server) return undefined;
  return map_server_to_frigate_server(server);
}

export function get_all_frigate_servers(): FrigateServer[] {
  const db_instance = getConfigDatabase();
  return db_instance.getAllServers().map(map_server_to_frigate_server);
}

// Headers de autenticación para requests a Frigate
export const getFrigateHeaders = (server: FrigateServer): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (server.auth) {
    switch (server.auth.type) {
      case 'bearer':
        if (server.auth.token) {
          headers['Authorization'] = `Bearer ${server.auth.token}`;
        }
        break;
      case 'basic':
        if (server.auth.username && server.auth.password) {
          const credentials = Buffer.from(`${server.auth.username}:${server.auth.password}`).toString('base64');
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
    }
  }

  return headers;
};

/**
 * Obtiene el servidor principal activo de Frigate.
 */
export function get_primary_frigate_server(): FrigateServer | undefined {
  const active_servers = get_active_frigate_servers();
  return active_servers.length > 0 ? active_servers[0] : undefined;
}

/**
 * Resuelve un servidor de Frigate a partir del identificador solicitado.
 */
export function resolve_frigate_server(server_id?: string | number | null): FrigateServer | undefined {
  if (typeof server_id === 'string' && server_id.trim() !== '') {
    return get_frigate_server_by_id(server_id);
  }

  if (typeof server_id === 'number') {
    return get_frigate_server_by_id(server_id);
  }

  return get_primary_frigate_server();
}
