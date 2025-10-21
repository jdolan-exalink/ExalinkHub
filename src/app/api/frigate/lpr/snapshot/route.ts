import { NextRequest, NextResponse } from 'next/server';
import { get_frigate_server_by_id, getFrigateHeaders } from '@/lib/frigate-servers';

/**
 * Proxy para snapshots de eventos LPR
 * 
 * GET /api/frigate/lpr/snapshot?server=srv1&event=1700000000.123-abcxyz&download=1
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('server');
    const eventId = searchParams.get('event');
    const download = searchParams.get('download') === '1';

    if (!serverId || !eventId) {
      return NextResponse.json(
        { error: 'Parámetros requeridos: server, event' },
        { status: 400 }
      );
    }

    // Obtener configuración del servidor
    const server = get_frigate_server_by_id(serverId);
    if (!server) {
      return NextResponse.json(
        { error: `Servidor no encontrado: ${serverId}` },
        { status: 404 }
      );
    }

    // Construir URL del snapshot en Frigate
    const snapshotUrl = `${server.baseUrl}/api/events/${eventId}/snapshot.jpg`;
    if (download) {
      snapshotUrl.concat('?download=1');
    }

    console.log(`[LPR Snapshot] Proxy: ${serverId}/${eventId} -> ${snapshotUrl}`);

    // Headers para el request a Frigate
    const headers = getFrigateHeaders(server);

    // Fetch del snapshot desde Frigate
    const response = await fetch(snapshotUrl, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      console.error(`Error fetching snapshot: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Error obteniendo snapshot: ${response.status}` },
        { status: response.status }
      );
    }

    // Obtener el blob de la imagen
    const imageBuffer = await response.arrayBuffer();

    // Headers para la respuesta
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'image/jpeg');
    responseHeaders.set('Cache-Control', 'public, max-age=3600'); // Cache por 1 hora
    
    if (download) {
      responseHeaders.set('Content-Disposition', `attachment; filename="snapshot_${eventId}.jpg"`);
    }

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('Error en /api/frigate/lpr/snapshot:', error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
