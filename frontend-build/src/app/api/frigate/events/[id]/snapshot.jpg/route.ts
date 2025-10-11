import { NextRequest, NextResponse } from 'next/server';
import { get_active_frigate_servers } from '@/lib/frigate-servers';

/**
 * Proxy para snapshots de eventos Frigate
 * 
 * Ruta: GET /api/frigate/events/[id]/snapshot.jpg
 * Parámetros:
 * - id: ID del evento
 * - download: (opcional) 1 para forzar descarga
 */

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: eventId } = await context.params;
    const { searchParams } = new URL(request.url);
    const download = searchParams.get('download') === '1';

    if (!eventId) {
      return NextResponse.json(
        { error: 'ID del evento requerido' },
        { status: 400 }
      );
    }

    // Obtener el servidor Frigate principal desde la base de datos
    const servers = get_active_frigate_servers();
    if (!servers.length) {
      return NextResponse.json(
        { error: 'No hay servidores Frigate configurados/en línea' },
        { status: 500 }
      );
    }
    const main_server = servers[0];
    const snapshotUrl = `${main_server.baseUrl}/api/events/${eventId}/snapshot.jpg`;

    console.log(`[Event Snapshot] Fetching: ${eventId} -> ${snapshotUrl}`);

    // Headers de autenticación si están configurados en la base de datos
    const headers: HeadersInit = {
      'User-Agent': 'NextJS-Studio/1.0',
    };
    if (main_server.auth && main_server.auth.type === 'bearer' && main_server.auth.token) {
      headers['Authorization'] = `Bearer ${main_server.auth.token}`;
    }
    if (main_server.auth && main_server.auth.type === 'basic' && main_server.auth.username && main_server.auth.password) {
      const credentials = Buffer.from(`${main_server.auth.username}:${main_server.auth.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    // Fetch del snapshot desde Frigate
    const response = await fetch(snapshotUrl, {
      method: 'GET',
      headers,
      cache: 'no-store', // No cachear para obtener snapshots actualizados
    });

    if (!response.ok) {
      console.error(`Error fetching event snapshot: ${response.status} ${response.statusText}`);
      return NextResponse.json(
        { error: `Error obteniendo snapshot del evento: ${response.status}` },
        { status: response.status }
      );
    }

    // Obtener el contenido como ArrayBuffer
    const imageBuffer = await response.arrayBuffer();

    // Headers de respuesta
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', 'image/jpeg');
    responseHeaders.set('Cache-Control', 'public, max-age=300'); // Cache por 5 minutos
    
    // Si se solicita descarga, agregar header correspondiente
    if (download) {
      responseHeaders.set('Content-Disposition', `attachment; filename="event_${eventId}_snapshot.jpg"`);
    }

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Error en /api/frigate/events/[id]/snapshot.jpg:', error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor al obtener snapshot del evento',
        details: error instanceof Error ? error.message : 'Error desconocido'
      },
      { status: 500 }
    );
  }
}