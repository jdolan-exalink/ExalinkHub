import { NextRequest, NextResponse } from 'next/server';
import {
  get_active_frigate_servers,
  getFrigateHeaders as get_frigate_headers,
  get_primary_frigate_server
} from '@/lib/frigate-servers';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const eventId = id;
  try {
    
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Obtener el servidor Frigate principal desde la base de datos
    const servers = get_active_frigate_servers();
    if (!servers.length) {
      return NextResponse.json({ error: 'No hay servidores Frigate configurados/en línea' }, { status: 500 });
    }
    const main_server = get_primary_frigate_server() ?? servers[0];
    const clip_url = `${main_server.baseUrl}/api/events/${eventId}/clip.mp4`;

    const request_headers = get_frigate_headers(main_server);
    delete request_headers['Content-Type'];

    const response = await fetch(clip_url, {
      headers: request_headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch clip: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="event_${eventId}.mp4"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error fetching event clip:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event clip' }, 
      { status: 500 }
    );
  }
}
