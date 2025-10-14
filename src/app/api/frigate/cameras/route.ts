import { NextRequest, NextResponse } from 'next/server';
import { create_frigate_api } from '@/lib/frigate-api';
import {
  get_active_frigate_servers,
  getFrigateHeaders as get_frigate_headers,
  get_primary_frigate_server
} from '@/lib/frigate-servers';
import { getConfigDatabase } from '@/lib/config-database';
import { validateServerConnection } from '@/lib/frigate-auth';
import type { ServerCamera } from '@/lib/types';

/**
 * API endpoint para obtener catálogo unificado de cámaras
 * Consulta /api/config de todos los servidores Frigate activos
 * Compatible con panel de Matrículas y funcionamiento existente
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode'); // 'lpr' para panel LPR, default para compatibilidad
    const serverIdParam = searchParams.get('server_id'); // ID específico del servidor

    if (serverIdParam) {
      // Modo servidor específico: obtener cámaras de un servidor configurado
      return await getServerCameras(parseInt(serverIdParam));
    } else if (mode === 'lpr') {
      // Modo LPR: consultar múltiples servidores
      return await getLPRCameras();
    } else {
      // Modo compatibilidad: servidor principal únicamente
      return await getDefaultCameras();
    }
  } catch (error) {
    console.error('Error in cameras endpoint:', error);
    // En caso de error, devolver un array vacío para mantener compatibilidad con el cliente
    // (el frontend espera una lista de cámaras). También se puede inspeccionar los logs
    // para diagnosticar el problema en el servidor.
    return NextResponse.json([], { status: 200 });
  }
}

// Función para obtener cámaras de múltiples servidores (Panel de Matrículas)
async function getLPRCameras() {
  const servers = get_active_frigate_servers();
  const cameras: ServerCamera[] = [];
  const serverStatus: Record<string, string> = {};
  const TIMEOUT_MS = 5000;
  console.log('[Conteo] Iniciando consulta de cámaras en servidores activos:', servers.map(s => s.name));

  const fetchWithTimeout = async (url: string, options: RequestInit): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  };

  const serverPromises = servers.map(async (server) => {
    try {
      const configUrl = `${server.baseUrl}/api/config`;
  const headers = get_frigate_headers(server);
      console.log(`[Conteo] Consultando cámaras de servidor: ${server.name} (${configUrl})`);
      const response = await fetchWithTimeout(configUrl, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        console.error(`[Conteo] Error HTTP al consultar ${server.name}: ${response.status} ${response.statusText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const config = await response.json();
      serverStatus[server.id] = 'online';

      if (config.cameras && typeof config.cameras === 'object') {
        const cameraNames = Object.keys(config.cameras);
        if (cameraNames.length === 0) {
          console.warn(`[Conteo] No se encontraron cámaras en el servidor ${server.name}`);
        }
        for (const cameraName of cameraNames) {
          const cameraConfig = config.cameras[cameraName];
          cameras.push({
            serverId: server.id,
            serverName: server.name,
            cameraName: cameraName,
            name: cameraName,
            display_name: cameraConfig.display_name || cameraName,
            enabled: cameraConfig.enabled !== false,
            zones: cameraConfig.zones ? Object.keys(cameraConfig.zones) : [],
          });
        }
        console.log(`[Conteo] ${server.name}: ${cameraNames.length} cámaras procesadas.`);
      } else {
        console.warn(`[Conteo] El servidor ${server.name} no devolvió el objeto 'cameras'.`);
      }

    } catch (error) {
      console.error(`[Conteo] Error consultando ${server.name}:`, error);
      serverStatus[server.id] = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'offline';
    }
  });

  await Promise.allSettled(serverPromises);

  cameras.sort((a, b) => {
    if (a.serverName !== b.serverName) {
      return a.serverName.localeCompare(b.serverName);
    }
    return (a.name || '').localeCompare(b.name || '');
  });

  if (cameras.length === 0) {
    console.warn('[Conteo] No se encontraron cámaras en ningún servidor activo.');
  } else {
    console.log(`[Conteo] Total de cámaras encontradas: ${cameras.length}`);
  }

  return NextResponse.json({
    cameras,
    serverStatus,
    timestamp: new Date().toISOString(),
    serversChecked: servers.length
  });
}

// Función para compatibilidad con el comportamiento existente
async function getDefaultCameras() {
  console.log('=== CAMERAS ENDPOINT (Default Mode) ===');
  const primary_server = get_primary_frigate_server();

  if (!primary_server) {
    console.warn('No active Frigate servers found in database');
    return NextResponse.json([], { status: 200 });
  }

  console.log(`Fetching cameras from Frigate server ${primary_server.name} (${primary_server.baseUrl})...`);

  const frigate_api = create_frigate_api(primary_server);
  let config: any;
  try {
    config = await frigate_api.getConfig();
    console.log('Raw Frigate config received');
  } catch (err) {
    console.error(`Failed to fetch config from primary server ${primary_server.name}:`, err);
    // Devolver array vacío para mantener compatibilidad con el frontend
    return NextResponse.json([], { status: 200 });
  }

  const camera_names = Object.keys(config.cameras);
  console.log('Found cameras:', camera_names);

  const base_url = primary_server.baseUrl;
  const cameras = await Promise.all(
    camera_names.map(async (camera_name) => {
      const camera_config = config.cameras[camera_name];
      console.log(`Processing camera ${camera_name}:`, camera_config);

      return {
        id: camera_name,
        name: camera_name,
        enabled: camera_config.enabled,
        recording: camera_config.recording?.enabled || false,
        detection: camera_config.detect?.enabled || false,
        snapshots: camera_config.snapshots?.enabled || false,
        streamUrl: frigate_api.getCameraStreamUrl(camera_name),
        snapshotUrl: `${base_url}/api/${camera_name}/latest.jpg`,
        server: primary_server.name
      };
    })
  );

  console.log('Processed cameras:', cameras.length);
  return NextResponse.json(cameras);
}

// Función para obtener cámaras de un servidor específico configurado
async function getServerCameras(serverId: number) {
  try {
    console.log(`=== CAMERAS ENDPOINT (Server ${serverId}) ===`);

    const db = getConfigDatabase();
    const server = db.getServerById(serverId);

    if (!server) {
      return NextResponse.json(
        { error: `Servidor ${serverId} no encontrado` },
        { status: 404 }
      );
    }

    if (!server.enabled) {
      return NextResponse.json(
        { error: `Servidor ${serverId} está deshabilitado` },
        { status: 404 }
      );
    }

    console.log(`Connecting to server: ${server.name} at ${server.protocol}://${server.url}:${server.port}`);

    const baseUrl = `${server.protocol}://${server.url}:${server.port}`;

    // Validar conexión y autenticación
    const validationResult = await validateServerConnection(baseUrl, {
      username: server.username,
      password: server.password
    });

    if (!validationResult.success) {
      console.error(`Failed to connect to server ${serverId}:`, validationResult.error);
      return NextResponse.json([]);
    }

    console.log(`Successfully authenticated with server ${serverId}`);

    // Obtener configuración de cámaras
    const configUrl = `${baseUrl}/api/config`;
    const response = await fetch(configUrl, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Exalink-Hub/1.0',
        ...(validationResult.token && validationResult.token !== 'cookie-based-auth'
          ? { 'Authorization': `Bearer ${validationResult.token}` }
          : {}
        )
      },
      credentials: validationResult.token === 'cookie-based-auth' ? 'include' : 'omit'
    });

    if (!response.ok) {
      console.error(`Failed to fetch config from server ${serverId}: ${response.status} ${response.statusText}`);
      return NextResponse.json([]);
    }

    const config = await response.json();
    console.log(`Config received from server ${serverId}`);

    if (!config.cameras || typeof config.cameras !== 'object') {
      console.log(`No cameras found in server ${serverId} config`);
      return NextResponse.json([]);
    }

    const cameraNames = Object.keys(config.cameras);
    console.log(`Found ${cameraNames.length} cameras in server ${serverId}:`, cameraNames);

    const cameras = cameraNames.map((name) => {
      const cameraConfig = config.cameras[name];

      return {
        id: name,
        name: name,
        enabled: cameraConfig.enabled !== false,
        recording: cameraConfig.recording?.enabled || false,
        detection: cameraConfig.detect?.enabled || false,
        snapshots: cameraConfig.snapshots?.enabled || false,
        zones: cameraConfig.zones ? Object.keys(cameraConfig.zones) : [],
        streamUrl: `${baseUrl}/api/${name}/stream.mjpeg`,
        snapshotUrl: `${baseUrl}/api/${name}/latest.jpg`,
        server: server.name,
        server_id: serverId,
        server_name: server.name
      };
    });

    console.log(`Processed ${cameras.length} cameras from server ${serverId}`);
    return NextResponse.json(cameras);

  } catch (error) {
    console.error(`Error fetching cameras from server ${serverId}:`, error);
    return NextResponse.json([]);
  }
}
