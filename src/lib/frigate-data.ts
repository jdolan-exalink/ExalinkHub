import { FrigateServer } from './types';

// Servidor por defecto - Casa
export const DEFAULT_SERVER: FrigateServer = {
  id: 'casa',
  name: 'Casa',
  url: 'http://10.1.1.252:5000',
  status: 'online',
  // apiKey: undefined // Sin clave API por defecto
};

export const SERVERS: FrigateServer[] = [DEFAULT_SERVER];

// Hook para obtener datos de Frigate
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