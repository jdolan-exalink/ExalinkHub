import { NextRequest, NextResponse } from 'next/server';
import { create_frigate_api } from '@/lib/frigate-api';
import { resolve_frigate_server } from '@/lib/frigate-servers';

export async function GET(request: NextRequest) {
  try {
    console.log('=== RECORDINGS DOWNLOAD ENDPOINT ===');
    
    const { searchParams } = new URL(request.url);
    const camera = searchParams.get('camera');
    const start_time_param = searchParams.get('start_time');
    const end_time_param = searchParams.get('end_time');
    const server_id = searchParams.get('server_id');
    
    console.log('Download parameters:', { camera, start_time_param, end_time_param });
    
    if (!camera || !start_time_param || !end_time_param) {
      return NextResponse.json(
        { error: 'Camera, start_time, and end_time parameters are required' }, 
        { status: 400 }
      );
    }

    const start_time_num = parseInt(start_time_param);
    const end_time_num = parseInt(end_time_param);

    if (isNaN(start_time_num) || isNaN(end_time_num)) {
      return NextResponse.json({ 
        error: 'start_time and end_time must be valid Unix timestamps' 
      }, { status: 400 });
    }

    console.log('Downloading clip:', {
      camera,
      start_time_num,
      end_time_num,
      startISO: new Date(start_time_num * 1000).toISOString(),
      endISO: new Date(end_time_num * 1000).toISOString(),
      duration: end_time_num - start_time_num
    });

    try {
      const target_server = resolve_frigate_server(server_id);

      if (!target_server) {
        return NextResponse.json(
          { 
            error: 'No hay servidores Frigate disponibles',
            camera,
            startTime: start_time_num,
            endTime: end_time_num
          },
          { status: 503 }
        );
      }

      const frigate_api = create_frigate_api(target_server);
      // Download the clip from Frigate
      const clip_blob = await frigate_api.downloadRecordingClip(camera, start_time_num, end_time_num);
      
      // Convert blob to buffer for response
      const array_buffer = await clip_blob.arrayBuffer();
      const buffer = Buffer.from(array_buffer);

      console.log('Download successful:', {
        size: buffer.length,
        sizeKB: Math.round(buffer.length / 1024),
        sizeMB: Math.round(buffer.length / (1024 * 1024))
      });

      // Check if we got actual video data
      if (buffer.length < 1000) {
        console.warn('Downloaded file seems too small:', buffer.length, 'bytes');
        return NextResponse.json(
          { 
            error: 'Downloaded clip is too small or empty',
            size: buffer.length,
            camera,
            startTime: start_time_num,
            endTime: end_time_num
          },
          { status: 404 }
        );
      }

      // Set appropriate headers for MP4 download
      const startDate = new Date(start_time_num * 1000);
      const endDate = new Date(end_time_num * 1000);
      const filename = `${camera}_${startDate.toISOString().slice(0, 19).replace(/:/g, '-')}_to_${endDate.toISOString().slice(0, 19).replace(/:/g, '-')}.mp4`;

      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'no-cache',
        },
      });
      
    } catch (frigateError) {
      console.error('Frigate download error:', frigateError);
      return NextResponse.json(
        { 
          error: 'Failed to download clip from Frigate server',
          details: frigateError instanceof Error ? frigateError.message : 'Unknown Frigate error',
          camera,
          startTime: start_time_num,
          endTime: end_time_num,
          suggestion: 'Check if Frigate server is accessible and recordings exist for this time range'
        },
        { status: 503 }
      );
    }
    
  } catch (error) {
    console.error('Error downloading clip:', error);
    return NextResponse.json(
      { error: `Failed to download recording clip: ${error instanceof Error ? error.message : 'Unknown error'}` }, 
      { status: 500 }
    );
  }
}
