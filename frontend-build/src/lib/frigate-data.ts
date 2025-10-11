import { FrigateServer, Camera } from './types';

// Timeouts y configuración de conectividad
const CONNECTION_TIMEOUT = 45000; // 45 segundos
const HEARTBEAT_INTERVAL = 30000; // 30 segundos entre pings
const serverLastSeen = new Map<string, number>(); // Tracking de última conexión exitosa (usando string para id)

// Servidor por defecto sin configuración real
export const DEFAULT_SERVER: FrigateServer = {
  id: 'placeholder',
  name: 'Sin configurar',
  url: '',
  status: 'offline'
};

export const SERVERS: FrigateServer[] = [];

/**
 * Verificar si un servidor está conectado basado en el último ping exitoso
 */
export function isServerConnected(serverId: string | number): boolean {
  const id = serverId.toString(); // Convertir a string para consistencia
  const lastSeen = serverLastSeen.get(id);
  if (!lastSeen) return false; // Nunca se ha conectado
  
  const timeSinceLastSeen = Date.now() - lastSeen;
  return timeSinceLastSeen < CONNECTION_TIMEOUT;
}

/**
 * Ping a un servidor para verificar conectividad
 */
export async function pingServer(server: any): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout para ping
    
    // Determinar la URL base
    const baseUrl = typeof window !== 'undefined' 
      ? '' // En el cliente, usar URL relativa
      : 'http://localhost:9002'; // En el servidor, usar URL absoluta
    
    const response = await fetch(`${baseUrl}/api/frigate/ping?server_id=${server.id}`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      serverLastSeen.set(server.id.toString(), Date.now());
      return true;
    }
    return false;
  } catch (error) {
    console.warn(`Ping failed for server ${server.name}:`, error);
    return false;
  }
}

/**
 * Iniciar monitoreo de conectividad para todos los servidores
 */
export function startServerMonitoring(servers: any[]) {
  const monitor = () => {
    servers.forEach(server => {
      pingServer(server).catch(error => {
        console.warn(`Monitoring ping failed for ${server.name}:`, error);
      });
    });
  };

  // Ping inicial
  monitor();
  
  // Programar pings regulares
  const intervalId = setInterval(monitor, HEARTBEAT_INTERVAL);
  
  return () => clearInterval(intervalId); // Cleanup function
}

/**
 * Obtener todos los servidores configurados desde la base de datos
 */
export async function fetchConfiguredServers() {
  try {
    // Determinar la URL base
    const baseUrl = typeof window !== 'undefined' 
      ? '' // En el cliente, usar URL relativa
      : 'http://localhost:9002'; // En el servidor, usar URL absoluta
    
    const url = `${baseUrl}/api/config/servers`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch servers: ${response.status}`);
    }
    
    const data = await response.json();
    return data.servers || [];
  } catch (error) {
    console.error('Error fetching configured servers:', error);
    return [];
  }
}

/**
 * Obtener cámaras de un servidor específico
 */
export async function fetchServerCameras(serverId: number) {
  try {
    console.log(`Fetching cameras for server ${serverId}...`);
    
    // Determinar la URL base
    const baseUrl = typeof window !== 'undefined' 
      ? '' // En el cliente, usar URL relativa
      : 'http://localhost:9002'; // En el servidor, usar URL absoluta
    
    const response = await fetch(`${baseUrl}/api/frigate/cameras?server_id=${serverId}`);
    if (!response.ok) {
      if (response.status === 404) {
        return []; // Servidor no encontrado, devolver array vacío
      }
      throw new Error(`Failed to fetch cameras for server ${serverId}: ${response.status}`);
    }
    
    const cameras = await response.json();
    console.log(`Cameras for server ${serverId}:`, cameras);
    
    // Agregar el server_id a cada cámara para identificación
    return cameras.map((camera: Camera) => ({
      ...camera,
      server_id: serverId,
      server_name: `Server ${serverId}` // Se actualizará con el nombre real
    }));
  } catch (error) {
    console.error(`Error fetching cameras for server ${serverId}:`, error);
    return [];
  }
}

/**
 * Obtener datos de múltiples servidores configurados
 */
export async function fetchMultiServerData() {
  try {
    // Obtener servidores configurados
    const configuredServers = await fetchConfiguredServers();
    
    if (configuredServers.length === 0) {
      return {
        servers: [],
        cameras: [],
        error: 'No hay servidores configurados'
      };
    }

    // Verificar conectividad en tiempo real para cada servidor
    const serversWithRealTimeStatus = await Promise.all(
      configuredServers.map(async (server: any) => {
        // Hacer ping real para obtener estado actual
        const pingSuccess = await pingServer(server);
        const realTimeStatus = pingSuccess ? 'online' : 'offline';
        
        return {
          ...server,
          status: {
            ...server.status,
            api_status: realTimeStatus,
            connection_status: realTimeStatus
          }
        };
      })
    );

    // Filtrar solo servidores habilitados y con estado online
    const onlineServers = serversWithRealTimeStatus.filter((server: any) => 
      server.enabled && server.status?.api_status === 'online'
    );
    
    if (onlineServers.length === 0) {
      return {
        servers: serversWithRealTimeStatus, // Devolver todos los servidores con su estado real
        cameras: [],
        error: 'No hay servidores online disponibles'
      };
    }

    // Obtener cámaras de todos los servidores online
    const serverCamerasPromises = onlineServers.map(async (server: any) => {
      const cameras = await fetchServerCameras(server.id);
      return {
        server,
        cameras: cameras.map((camera: Camera) => ({
          ...camera,
          server_id: server.id,
          server_name: server.name
        }))
      };
    });
    
    const serverCamerasResults = await Promise.all(serverCamerasPromises);
    
    // Combinar todas las cámaras
    const allCameras = serverCamerasResults.flatMap(result => result.cameras);
    
    return {
      servers: serversWithRealTimeStatus, // Devolver todos los servidores con estado real
      cameras: allCameras,
      serverCamerasMap: serverCamerasResults,
      error: null
    };
  } catch (error) {
    console.error('Error fetching multi-server data:', error);
    return {
      servers: [],
      cameras: [],
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
}

// Hook para obtener datos de Frigate (mantener compatibilidad)
export async function fetchFrigateData() {
  try {
    console.log('Fetching Frigate status...'); // Debug log
    
    // Verificar conexión
    const statusResponse = await fetch('/api/frigate/status');
    console.log('Status response:', statusResponse.status); // Debug log
    
    const status = await statusResponse.json();
    console.log('Status data:', status); // Debug log

    console.log('Fetching Frigate cameras...'); // Debug log
    
    // Obtener cámaras
    const camerasResponse = await fetch('/api/frigate/cameras');
    console.log('Cameras response:', camerasResponse.status); // Debug log
    
    if (!camerasResponse.ok) {
      throw new Error(`Failed to fetch cameras: ${camerasResponse.status}`);
    }
    
    const cameras = await camerasResponse.json();
    console.log('Cameras data:', cameras); // Debug log

    return {
      server: status,
      cameras: cameras,
      error: null
    };
  } catch (error) {
    console.error('Error fetching Frigate data:', error);
    return {
      server: null,
      cameras: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Para compatibilidad con código existente, exportamos datos vacíos
// que serán reemplazados por datos reales de la API
export const CAMERAS: any[] = [];
export const EVENTS: any[] = [];
