import { NextRequest, NextResponse } from 'next/server';
import { create_frigate_api } from '@/lib/frigate-api';
import {
  get_primary_frigate_server,
  get_frigate_server_by_id
} from '@/lib/frigate-servers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ camera: string }> }
) {
  let camera_name = 'unknown';
  try {
    const { camera } = await params;
    camera_name = camera;

    const url_params = request.nextUrl.searchParams;
    const server_id_param = url_params.get('server_id');
    const target_server = server_id_param
      ? get_frigate_server_by_id(server_id_param)
      : get_primary_frigate_server();

    if (!target_server) {
      return NextResponse.json(
        { error: 'No hay servidores Frigate configurados' },
        { status: 503 }
      );
    }

    const frigate_api = create_frigate_api(target_server);
    const snapshot_blob = await frigate_api.getCameraSnapshot(camera_name);
    
    return new NextResponse(snapshot_blob, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error(`Error getting snapshot for camera ${camera_name}:`, error);
    return NextResponse.json(
      { error: 'Failed to get snapshot', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
