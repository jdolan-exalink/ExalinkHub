/**
 * API para gestión de servidores
 * GET /api/config/servers - Obtener todos los servidores
 * POST /api/config/servers - Crear nuevo servidor
 * PUT /api/config/servers/[id] - Actualizar servidor
 * DELETE /api/config/servers/[id] - Eliminar servidor
 * POST /api/config/servers/[id]/test - Probar conexión
 * POST /api/config/servers/[id]/toggle - Activar/desactivar servidor
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

/**
 * GET /api/config/servers
 * Obtener todos los servidores con su estado
 */
export async function GET() {
  try {
    const db = getConfigDatabase();
    const servers = db.getAllServers();
    const statuses = db.getAllServerStatuses();
    
    // Combinar servidores con su estado
    const serversWithStatus = servers.map(server => {
      const status = statuses.find(s => s.serverId === server.id);
      return {
        ...server,
        status: status || {
          cpu_usage: 0,
          gpu_usage: 0,
          memory_usage: 0,
          disk_usage: 0,
          api_status: server.enabled ? 'online' : 'offline' as const,
          last_check: new Date().toISOString()
        }
      };
    });

    return NextResponse.json({ servers: serversWithStatus });
  } catch (error) {
    console.error('Error obteniendo servidores:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/config/servers
 * Crear nuevo servidor
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Validar datos requeridos
    if (!data.name || !data.url || !data.port || !data.protocol) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    const db = getConfigDatabase();
    const serverId = db.createServer({
      name: data.name,
      url: data.url,
      port: parseInt(data.port),
      protocol: data.protocol,
      username: data.username || undefined,
      password: data.password || undefined,
      enabled: data.enabled !== false
    });

    const newServer = db.getServerById(serverId);

    return NextResponse.json({ 
      message: 'Servidor creado exitosamente',
      server: newServer 
    });
  } catch (error) {
    console.error('Error creando servidor:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}