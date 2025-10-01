import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { camera: string } }
) {
  try {
    const cameraName = params.camera;
    const streamUrl = `http://10.1.1.252:5000/api/${cameraName}/stream.mjpeg`;
    
    // Hacer proxy del stream MJPEG
    const response = await fetch(streamUrl, {
      headers: {
        'Accept': 'multipart/x-mixed-replace; boundary=frame',
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
    console.error(`Error streaming camera ${params.camera}:`, error);
    return NextResponse.json(
      { error: 'Stream not available', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 503 }
    );
  }
}