/**
 * API para gestión de servidor específico
 * PUT /api/config/servers/[id] - Actualizar servidor
 * DELETE /api/config/servers/[id] - Eliminar servidor
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

interface Params {
  params: Promise<{
    id: string;
  }>;
}

/**
 * PUT /api/config/servers/[id]
 * Actualizar servidor existente
 */
export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const serverId = parseInt(id);
    const data = await request.json();
    
    if (isNaN(serverId)) {
      return NextResponse.json(
        { error: 'ID de servidor inválido' },
        { status: 400 }
      );
    }

    const db = getConfigDatabase();
    const updated = db.updateServer(serverId, {
      name: data.name,
      url: data.url,
      port: parseInt(data.port),
      protocol: data.protocol,
      username: data.username || undefined,
      password: data.password || undefined,
      enabled: data.enabled
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Servidor no encontrado' },
        { status: 404 }
      );
    }

    const updatedServer = db.getServerById(serverId);

    return NextResponse.json({ 
      message: 'Servidor actualizado exitosamente',
      server: updatedServer 
    });
  } catch (error) {
    console.error('Error actualizando servidor:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/config/servers/[id]
 * Eliminar servidor
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const serverId = parseInt(id);
    
    if (isNaN(serverId)) {
      return NextResponse.json(
        { error: 'ID de servidor inválido' },
        { status: 400 }
      );
    }

    const db = getConfigDatabase();
    const deleted = db.deleteServer(serverId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Servidor no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({ 
      message: 'Servidor eliminado exitosamente' 
    });
  } catch (error) {
    console.error('Error eliminando servidor:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}