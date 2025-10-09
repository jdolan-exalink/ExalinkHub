import { NextRequest, NextResponse } from 'next/server';
import { FrigateAPI } from '@/lib/frigate-api';
import { get_active_frigate_servers } from '@/lib/frigate-servers';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;
    
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Obtener el servidor Frigate principal desde la base de datos
    const servers = get_active_frigate_servers();
    if (!servers.length) {
      return NextResponse.json({ error: 'No hay servidores Frigate configurados/en línea' }, { status: 500 });
    }
    const main_server = servers[0];
    const api = new FrigateAPI({ baseUrl: main_server.baseUrl });
    const clipUrl = `${main_server.baseUrl}/api/events/${eventId}/clip.mp4`;

    const response = await fetch(clipUrl, {
      headers: api['getHeaders'](),
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