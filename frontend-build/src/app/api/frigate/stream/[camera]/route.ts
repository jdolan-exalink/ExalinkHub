import { NextRequest, NextResponse } from 'next/server';
import { frigateAPI } from '@/lib/frigate-api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ camera: string }> }
) {
  try {
    const { camera } = await params;
    const searchParams = request.nextUrl.searchParams;
    const quality = searchParams.get('quality') as 'main' | 'sub' | null;
    
    if (!camera) {
      return NextResponse.json(
        { error: 'Camera name is required' },
        { status: 400 }
      );
    }

    console.log(`Proxying MJPEG stream for camera: ${camera}, quality: ${quality || 'sub'}`);

    // URL del stream MJPEG correcto desde Frigate (usando sub por defecto)
    const streamUrl = quality 
      ? `http://10.1.1.252:5000/api/${camera}?stream=${quality}`
      : `http://10.1.1.252:5000/api/${camera}?stream=sub`;
    
    console.log(`Stream URL: ${streamUrl}`);

    // Hacer la petición al stream de Frigate
    const response = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Security-Studio-Proxy/1.0',
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