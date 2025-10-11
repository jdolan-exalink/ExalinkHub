import { NextRequest, NextResponse } from 'next/server';
import { get_frigate_server_by_id, getFrigateHeaders as get_frigate_headers } from '@/lib/frigate-servers';

/**
 * Proxy para clips de eventos LPR
 * 
 * GET /api/frigate/lpr/clip?server=srv1&event=1700000000.123-abcxyz&download=1
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

    // Construir URL del clip en Frigate
    let clipUrl = `${server.baseUrl}/api/events/${eventId}/clip.mp4`;
    if (download) {
      clipUrl += '?download=1';
    }

    console.log(`[LPR Clip] Proxy: ${serverId}/${eventId} -> ${clipUrl}`);

    // Headers para el request a Frigate
    const headers = get_frigate_headers(server);

    // Fetch del clip desde Frigate
    const response = await fetch(clipUrl, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      console.error(`Error fetching clip: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Error obteniendo clip: ${response.status}` },
        { status: response.status }
      );
    }

    // Obtener el video como stream
    const videoBuffer = await response.arrayBuffer();

    // Headers para la respuesta
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'video/mp4');
    responseHeaders.set('Cache-Control', 'public, max-age=1800'); // Cache por 30 min
    responseHeaders.set('Accept-Ranges', 'bytes');
    
    if (download) {
      responseHeaders.set('Content-Disposition', `attachment; filename="clip_${eventId}.mp4"`);
    }

    // Copiar headers adicionales del response original si existen
    const contentLength = response.headers.get('Content-Length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    return new NextResponse(videoBuffer, {
      status: 200,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('Error en /api/frigate/lpr/clip:', error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}
