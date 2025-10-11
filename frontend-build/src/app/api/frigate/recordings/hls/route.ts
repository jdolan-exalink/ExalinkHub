import { NextRequest, NextResponse } from 'next/server';
import { create_frigate_api } from '@/lib/frigate-api';
import { resolve_frigate_server } from '@/lib/frigate-servers';

export async function GET(request: NextRequest) {
  console.log('=== HLS STREAM ENDPOINT ===');
  
  try {
    const { searchParams } = new URL(request.url);
    const camera = searchParams.get('camera');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const server_id = searchParams.get('server_id');

    console.log('HLS stream parameters:', { camera, start, end });

    if (!camera || !start || !end) {
      return NextResponse.json(
        { error: 'Missing required parameters: camera, start, end' },
        { status: 400 }
      );
    }

    const startTime = parseInt(start);
    const endTime = parseInt(end);

    console.log('Requesting HLS stream:', {
      camera,
      startTime,
      endTime,
      startISO: new Date(startTime * 1000).toISOString(),
      endISO: new Date(endTime * 1000).toISOString(),
      duration: endTime - startTime
    });

    // Verificar si el stream HLS está disponible
    const target_server = resolve_frigate_server(server_id);

    if (!target_server) {
      return NextResponse.json(
        { error: 'No hay servidores Frigate disponibles', available: false },
        { status: 503 }
      );
    }

    const frigate_api = create_frigate_api(target_server);
    const isAvailable = await frigate_api.checkHLSStream(camera, startTime, endTime);
    
    if (!isAvailable) {
      console.log('HLS stream not available for this time range');
      return NextResponse.json(
        { error: 'No recording available for this time range', available: false },
        { status: 404 }
      );
    }

    // Retornar la URL del stream HLS a través de nuestro proxy
    const proxyUrl = `/api/frigate/recordings/hls/proxy?camera=${encodeURIComponent(camera)}&start=${startTime}&end=${endTime}&file=master.m3u8`;
    const originalUrl = frigate_api.getRecordingStreamUrl(camera, startTime, endTime);
    
    console.log('HLS proxy URL:', proxyUrl);
    console.log('Original Frigate URL:', originalUrl);

    return NextResponse.json({
      success: true,
      streamUrl: proxyUrl,
      originalUrl, // URL original de Frigate para debug
      type: 'hls',
      camera,
      startTime,
      endTime,
      duration: endTime - startTime
    });

  } catch (error) {
    console.error('HLS streaming error:', error);
    return NextResponse.json(
      { error: 'Failed to get HLS stream' },
      { status: 503 }
    );
  }
}
