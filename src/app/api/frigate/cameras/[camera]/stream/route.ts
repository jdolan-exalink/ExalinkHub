import { NextRequest, NextResponse } from 'next/server';
import { resolve_frigate_server, getFrigateHeaders as get_frigate_headers } from '@/lib/frigate-servers';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ camera: string }> }
) {
  const { camera } = await context.params;
  try {
    const server_id = request.nextUrl.searchParams.get('server_id');
    const target_server = resolve_frigate_server(server_id);

    if (!target_server) {
      return NextResponse.json(
        { error: 'No hay servidores Frigate disponibles' },
        { status: 503 }
      );
    }

    const streamUrl = `${target_server.baseUrl}/api/${camera}/stream.mjpeg`;
    
    // Hacer proxy del stream MJPEG
    const auth_headers = get_frigate_headers(target_server);
    delete auth_headers['Content-Type'];
    const response = await fetch(streamUrl, {
      headers: {
        'Accept': 'multipart/x-mixed-replace; boundary=frame',
        ...auth_headers
      },
    });

    if (!response.ok) {
      throw new Error(`Stream not available: ${response.status}`);
    }

    // Crear un stream pass-through
    const stream = new ReadableStream({
      start(controller) {
        const reader = response.body?.getReader();
        
        function pump(): Promise<void> {
          return reader!.read().then(({ done, value }) => {
            if (done) {
              controller.close();
              return;
            }
            controller.enqueue(value);
            return pump();
          });
        }
        
        return pump();
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error(`Error streaming camera ${camera}:`, error);
    return NextResponse.json(
      { error: 'Stream not available', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 503 }
    );
  }
}
