import { NextRequest, NextResponse } from 'next/server';
import { resolve_frigate_server, getFrigateHeaders as get_frigate_headers } from '@/lib/frigate-servers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ camera: string }> }
) {
  try {
    const { camera } = await params;
    const searchParams = request.nextUrl.searchParams;
    const quality = searchParams.get('quality') as 'main' | 'sub' | null;
    const server_id = searchParams.get('server_id');
    
    if (!camera) {
      return NextResponse.json(
        { error: 'Camera name is required' },
        { status: 400 }
      );
    }

    const target_server = resolve_frigate_server(server_id);
    if (!target_server) {
      return NextResponse.json(
        { error: 'No hay servidores Frigate disponibles' },
        { status: 503 }
      );
    }

    console.log(`Proxying MJPEG stream for camera: ${camera}, quality: ${quality || 'sub'}`);

    // URL del stream MJPEG correcto desde Frigate (usando sub por defecto)
    const base_url = target_server.baseUrl;
    const streamUrl = quality 
      ? `${base_url}/api/${camera}?stream=${quality}`
      : `${base_url}/api/${camera}?stream=sub`;
    
    console.log(`Stream URL: ${streamUrl}`);

    // Hacer la petición al stream de Frigate
    const response = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Security-Studio-Proxy/1.0',
        ...(() => {
          const auth_headers = get_frigate_headers(target_server);
          delete auth_headers['Content-Type'];
          return auth_headers;
        })(),
      },
    });

    if (!response.ok) {
      console.error(`Stream failed for ${camera}:`, response.status, response.statusText);
      return NextResponse.json(
        { 
          error: `Failed to get stream for camera '${camera}'`,
          details: `${response.status} ${response.statusText}`,
          streamUrl 
        },
        { status: response.status }
      );
    }

    // Configurar headers para MJPEG streaming
    const headers = new Headers();
    headers.set('Content-Type', 'multipart/x-mixed-replace; boundary=--video-boundary--');
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Pragma', 'no-cache');
    headers.set('Expires', '0');
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Access-Control-Allow-Methods', 'GET');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');

    // Pasar el stream directamente
    return new NextResponse(response.body, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Stream proxy error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
