import { NextRequest, NextResponse } from 'next/server';
import { frigateAPI } from '@/lib/frigate-api';
import { getActiveFrigateServers, getFrigateHeaders } from '@/lib/frigate-servers';
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
    return NextResponse.json(
      { error: 'Failed to fetch cameras', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// Función para obtener cámaras de múltiples servidores (Panel de Matrículas)
async function getLPRCameras() {
  const servers = getActiveFrigateServers();
  const cameras: ServerCamera[] = [];
  const serverStatus: Record<string, string> = {};
  const TIMEOUT_MS = 5000;

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
      const headers = getFrigateHeaders(server);
      
      console.log(`[LPR] Consultando cámaras de ${server.name}: ${configUrl}`);
      
      const response = await fetchWithTimeout(configUrl, {
        method: 'GET',
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const config = await response.json();
      serverStatus[server.id] = 'online';

      if (config.cameras && typeof config.cameras === 'object') {
        const cameraNames = Object.keys(config.cameras);
        
        for (const cameraName of cameraNames) {
          const cameraConfig = config.cameras[cameraName];
          
          cameras.push({
            serverId: server.id,
            serverName: server.name,
            cameraName: cameraName,
            enabled: cameraConfig.enabled !== false
          });
        }
        
        console.log(`✓ ${server.name}: ${cameraNames.length} cámaras encontradas`);
      }

    } catch (error) {
      console.error(`✗ Error consultando ${server.name}:`, error);
      serverStatus[server.id] = error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'offline';
    }
  });

  await Promise.allSettled(serverPromises);

  cameras.sort((a, b) => {
    if (a.serverName !== b.serverName) {
      return a.serverName.localeCompare(b.serverName);
    }
    return a.cameraName.localeCompare(b.cameraName);
  });

  console.log(`📹 [LPR] Total de cámaras encontradas: ${cameras.length}`);

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
  console.log('Fetching cameras from Frigate...');
  
  const config = await frigateAPI.getConfig();
  console.log('Raw Frigate config received');
  
  const cameraNames = Object.keys(config.cameras);
  console.log('Found cameras:', cameraNames);
  
  const cameras = await Promise.all(
    cameraNames.map(async (name) => {
      const cameraConfig = config.cameras[name];
      console.log(`Processing camera ${name}:`, cameraConfig);
      
      return {
        id: name,
        name: name,
        enabled: cameraConfig.enabled,
        recording: cameraConfig.recording?.enabled || false,
        detection: cameraConfig.detect?.enabled || false,
        snapshots: cameraConfig.snapshots?.enabled || false,
        streamUrl: frigateAPI.getCameraStreamUrl(name),
        snapshotUrl: `http://10.1.1.252:5000/api/${name}/latest.jpg`,
        server: 'Casa'
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