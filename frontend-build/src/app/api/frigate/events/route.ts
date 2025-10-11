import { NextRequest, NextResponse } from 'next/server';
import { create_frigate_api } from '@/lib/frigate-api';
import {
  get_frigate_server_by_id,
  get_primary_frigate_server
} from '@/lib/frigate-servers';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const after = searchParams.get('after');
    const before = searchParams.get('before');
    const camera = searchParams.get('camera');
    const label = searchParams.get('label');
    const limit = searchParams.get('limit');
    const server_id = searchParams.get('server_id');

    const target_server = server_id
      ? get_frigate_server_by_id(server_id)
      : get_primary_frigate_server();

    if (!target_server) {
      return NextResponse.json(
        { error: 'No hay servidores Frigate disponibles' },
        { status: 503 }
      );
    }

    const event_params: Record<string, number | string> = {};
    
    if (after) event_params.after = parseInt(after);
    if (before) event_params.before = parseInt(before);
    if (camera) event_params.camera = camera;
    if (label) event_params.label = label;
    if (limit) event_params.limit = parseInt(limit);

    const frigate_api = create_frigate_api(target_server);
    const events = await frigate_api.getEvents(event_params);

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
