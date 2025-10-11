import { NextRequest, NextResponse } from 'next/server';
import { create_frigate_api } from '@/lib/frigate-api';
import { resolve_frigate_server } from '@/lib/frigate-servers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const camera = searchParams.get('camera');
    const date = searchParams.get('date'); // YYYY-MM-DD format
    const server_id = searchParams.get('server_id');
    
    if (!camera) {
      return NextResponse.json({ error: 'Camera parameter is required' }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
    }

    const target_server = resolve_frigate_server(server_id);
    if (!target_server) {
      return NextResponse.json(
        { error: 'No hay servidores Frigate disponibles' },
        { status: 503 }
      );
    }

    const frigate_api = create_frigate_api(target_server);
    const timeline_data = await frigate_api.getRecordingTimeline(camera, date);

    return NextResponse.json(timeline_data);
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recordings' }, 
      { status: 500 }
    );
  }
}
