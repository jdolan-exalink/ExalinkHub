/**
 * Configuración de servidores Frigate activos
 * Panel de Búsqueda de Patentes (LPR) - Frigate 0.16
 */

export interface FrigateServer {
  id: string;
  name: string;
  baseUrl: string;
  enabled: boolean;
  auth?: {
    type: 'bearer' | 'basic';
    token?: string;
    username?: string;
    password?: string;
  };
}

// Lista de servidores Frigate activos configurados
export const FRIGATE_SERVERS: FrigateServer[] = [
  {
    id: "srv1",
    name: "Servidor Principal",
    baseUrl: "http://10.1.1.252:5000",
    enabled: true
  },
  {
    id: "srv2", 
    name: "Servidor Secundario",
    baseUrl: "http://10.22.26.3:5000",
    enabled: true
  },
  // Agregar más servidores según la configuración del entorno
];

export const getActiveFrigateServers = (): FrigateServer[] => {
  return FRIGATE_SERVERS.filter(server => server.enabled);
};

export const getFrigateServerById = (id: string): FrigateServer | undefined => {
  return FRIGATE_SERVERS.find(server => server.id === id);
};

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
          const credentials = btoa(`${server.auth.username}:${server.auth.password}`);
          headers['Authorization'] = `Basic ${credentials}`;
        }
        break;
    }
  }

  return headers;
};