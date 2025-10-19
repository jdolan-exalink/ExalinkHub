import { NextRequest, NextResponse } from 'next/server';
import { create_frigate_api } from '@/lib/frigate-api';
import { resolve_frigate_server } from '@/lib/frigate-servers';

export async function GET(request: NextRequest) {
  try {
    console.log('=== VIDEO STREAM ENDPOINT ===');
    
    const { searchParams } = new URL(request.url);
    const camera = searchParams.get('camera');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const server_id = searchParams.get('server_id');
    
    console.log('Video stream parameters:', { camera, start, end });
    
    if (!camera || !start || !end) {
      return NextResponse.json(
        { error: 'Missing required parameters: camera, start, end' },
        { status: 400 }
      );
    }

    const startTime = parseInt(start);
    const endTime = parseInt(end);

    if (isNaN(startTime) || isNaN(endTime)) {
      return NextResponse.json(
        { error: 'start and end must be valid Unix timestamps' },
        { status: 400 }
      );
    }

    console.log('Requesting video clip:', {
      camera,
      startTime,
      endTime,
      startISO: new Date(startTime * 1000).toISOString(),
      endISO: new Date(endTime * 1000).toISOString(),
      duration: endTime - startTime
    });

    try {
      const target_server = resolve_frigate_server(server_id);

      if (!target_server) {
        return NextResponse.json(
          {
            error: 'No hay servidores Frigate disponibles',
            camera,
            startTime,
            endTime
          },
          { status: 503 }
        );
      }

      const frigate_api = create_frigate_api(target_server);

      console.log('Fetching recording segments summary before download...');
      const recording_segments = await frigate_api.getRecordings({
        camera,
        after: startTime,
        before: endTime,
      }).catch((segment_error: unknown) => {
        console.warn('Failed to fetch recording segments summary:', segment_error);
        return [];
      });

      if (!Array.isArray(recording_segments) || recording_segments.length === 0) {
        console.warn('No recording segments found for requested range', {
          camera,
          startTime,
          endTime,
        });
        return NextResponse.json(
          {
            error: 'Frigate no reporta grabaciones para el rango solicitado.',
            camera,
            startTime,
            endTime,
            suggestion: 'Selecciona un rango diferente o verifica que la camara haya estado grabando en ese periodo.',
          },
          { status: 404 }
        );
      }

      const normalized_start = Math.max(
        startTime,
        Math.min(...recording_segments.map((segment: any) => segment.start_time ?? startTime))
      );
      const normalized_end = Math.min(
        endTime,
        Math.max(...recording_segments.map((segment: any) => segment.end_time ?? endTime))
      );

      if (normalized_end <= normalized_start) {
        console.warn('Recording segments summary produced invalid normalized range', {
          camera,
          startTime,
          endTime,
          normalized_start,
          normalized_end,
        });
        return NextResponse.json(
          {
            error: 'No se encontraron segmentos validos dentro del rango solicitado.',
            camera,
            startTime,
            endTime,
            suggestion: 'Intenta con un rango mas corto o revisa las grabaciones disponibles en la linea de tiempo.',
          },
          { status: 404 }
        );
      }

      console.log('Downloading clip via direct start/end endpoint...', {
        requested_range: { startTime, endTime },
        normalized_range: { normalized_start, normalized_end },
      });
      const clip_blob = await frigate_api.downloadRecordingClip(camera, normalized_start, normalized_end);

      const array_buffer = await clip_blob.arrayBuffer();
      const buffer = Buffer.from(array_buffer);

      console.log('Successfully downloaded video clip:', {
        size: buffer.length,
        sizeKB: Math.round(buffer.length / 1024),
        sizeMB: Math.round(buffer.length / (1024 * 1024))
      });

      if (buffer.length < 1000) {
        console.warn('Video file seems too small:', buffer.length, 'bytes');
        return NextResponse.json(
          { 
            error: 'Video clip too small or empty',
            size: buffer.length,
            camera,
            startTime: normalized_start,
            endTime: normalized_end
          },
          { status: 404 }
        );
      }

      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': buffer.length.toString(),
          'Content-Disposition': `attachment; filename="${camera}_${new Date(normalized_start * 1000).toISOString().slice(0, 19).replace(/[:.]/g, '-')}_to_${new Date(normalized_end * 1000).toISOString().slice(11, 19).replace(/:/g, '-')}.mp4"`,
          'Cache-Control': 'public, max-age=3600',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Range, Content-Type',
        },
      });

    } catch (frigateError) {
      console.error('Frigate video download error:', frigateError);

      if (frigateError instanceof Error && frigateError.message === 'frigate_clip_empty') {
        return NextResponse.json(
          {
            error: 'Frigate devolvió un clip vacío para el rango solicitado',
            camera,
            startTime,
            endTime,
            suggestion: 'Intenta reproducir el segmento mediante HLS (/api/frigate/recordings/hls) o verifica si existen grabaciones en ese rango.',
          },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to download video clip from Frigate server',
          details: frigateError instanceof Error ? frigateError.message : 'Unknown Frigate error',
          camera,
          startTime,
          endTime,
          suggestion: 'Check connectivity with Frigate and confirm recordings exist for this range'
        },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('Error in video stream endpoint:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
    },
  });
}
