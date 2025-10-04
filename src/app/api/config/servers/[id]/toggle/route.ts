/**
 * API para toggle de servidor
 * POST /api/config/servers/[id]/toggle - Activar/desactivar servidor
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

interface Params {
  params: Promise<{
    id: string;
  }>;
}

/**
 * POST /api/config/servers/[id]/toggle
 * Activar/desactivar servidor
 */
export async function POST(request: NextRequest, { params }: Params) {
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
    const server = db.getServerById(serverId);

    if (!server) {
      return NextResponse.json(
        { error: 'Servidor no encontrado' },
        { status: 404 }
      );
    }

    const toggled = db.toggleServer(serverId);

    if (!toggled) {
      return NextResponse.json(
        { error: 'Error al cambiar estado del servidor' },
        { status: 500 }
      );
    }

    const updatedServer = db.getServerById(serverId);

    return NextResponse.json({ 
      message: `Servidor ${updatedServer?.enabled ? 'activado' : 'desactivado'} exitosamente`,
      server: updatedServer 
    });
  } catch (error) {
    console.error('Error toggling servidor:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}