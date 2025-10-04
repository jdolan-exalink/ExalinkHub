import { NextRequest, NextResponse } from 'next/server';

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
  { params }: { params: { id: string } }
) {
  try {
    const resolvedParams = await params;
    const eventId = resolvedParams.id;
    const { searchParams } = new URL(request.url);
    const download = searchParams.get('download') === '1';

    if (!eventId) {
      return NextResponse.json(
        { error: 'ID del evento requerido' },
        { status: 400 }
      );
    }

    // URL del servidor Frigate principal (puedes hacer esto configurable)
    const frigateBaseUrl = process.env.FRIGATE_BASE_URL || 'http://10.1.1.252:5000';
    const snapshotUrl = `${frigateBaseUrl}/api/events/${eventId}/snapshot.jpg`;

    console.log(`[Event Snapshot] Fetching: ${eventId} -> ${snapshotUrl}`);

    // Headers de autenticación si están configurados
    const headers: HeadersInit = {
      'User-Agent': 'NextJS-Studio/1.0',
    };

    // Agregar autenticación si está configurada
    if (process.env.FRIGATE_API_KEY) {
      headers['Authorization'] = `Bearer ${process.env.FRIGATE_API_KEY}`;
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