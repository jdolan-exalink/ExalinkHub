import { NextResponse } from 'next/server';
import { create_frigate_api } from '@/lib/frigate-api';
import { get_primary_frigate_server } from '@/lib/frigate-servers';

export async function GET() {
  try {
    const primary_server = get_primary_frigate_server();
    if (!primary_server) {
      return NextResponse.json(
        { error: 'No hay servidores Frigate disponibles' },
        { status: 503 }
      );
    }

    const frigate_api = create_frigate_api(primary_server);
    const stats = await frigate_api.getStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
