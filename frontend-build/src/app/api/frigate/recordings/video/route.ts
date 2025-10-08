import { NextRequest, NextResponse } from 'next/server';
import { frigateAPI } from '@/lib/frigate-api';

export async function GET(request: NextRequest) {
  try {
    console.log('=== VIDEO STREAM ENDPOINT ===');
    
    const { searchParams } = new URL(request.url);
    const camera = searchParams.get('camera');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    
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
      // Iniciar exportación
      console.log('Starting export...');
      const exportId = await frigateAPI.startRecordingExport(camera, startTime, endTime);
      console.log('Export started with ID:', exportId);
      
      // Esperar a que se complete con progreso
      const maxAttempts = 60; // 60 segundos máximo
      let attempts = 0;
      
      while (attempts < maxAttempts) {
        const status = await frigateAPI.getExportStatus(exportId);
        console.log(`Export status (attempt ${attempts + 1}):`, status);
        
        if (status.status === 'complete') {
          console.log('Export completed, downloading...');
          // Descargar el archivo completado
          const videoBlob = await frigateAPI.downloadExportedClip(exportId);
          
          // Convert blob to array buffer
          const arrayBuffer = await videoBlob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          console.log('Successfully downloaded video clip:', {
            size: buffer.length,
            sizeKB: Math.round(buffer.length / 1024),
            sizeMB: Math.round(buffer.length / (1024 * 1024))
          });

          // Check if we got actual video data
          if (buffer.length < 1000) {
            console.warn('Video file seems too small:', buffer.length, 'bytes');
            return NextResponse.json(
              { 
                error: 'Video clip too small or empty',
                size: buffer.length,
                camera,
                startTime,
                endTime,
                exportId
              },
              { status: 404 }
            );
          }

          // Return the video file with proper headers for download
          return new NextResponse(buffer as any, {
            status: 200,
            headers: {
              'Content-Type': 'video/mp4',
              'Content-Length': buffer.length.toString(),
              'Content-Disposition': `attachment; filename="${camera}_${new Date(startTime * 1000).toISOString().slice(0, 19).replace(/[:.]/g, '-')}_to_${new Date(endTime * 1000).toISOString().slice(11, 19).replace(/:/g, '-')}.mp4"`,
              'Cache-Control': 'public, max-age=3600',
              // Enable CORS for video download
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET',
              'Access-Control-Allow-Headers': 'Range, Content-Type',
            },
          });
          
        } else if (status.status === 'failed') {
          console.error('Export failed');
          return NextResponse.json(
            { 
              error: 'Export failed',
              camera,
              startTime,
              endTime,
              exportId
            },
            { status: 500 }
          );
        }
        
        // Esperar 1 segundo antes del siguiente intento
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
      }
      
      console.error('Export timeout');
      return NextResponse.json(
        { 
          error: 'Export timeout - took too long to complete',
          camera,
          startTime,
          endTime,
          exportId,
          maxWaitTime: maxAttempts
        },
        { status: 408 }
      );

    } catch (frigateError) {
      console.error('Frigate video export error:', frigateError);
      
      return NextResponse.json(
        { 
          error: 'Failed to export video from Frigate server',
          details: frigateError instanceof Error ? frigateError.message : 'Unknown Frigate error',
          camera,
          startTime,
          endTime,
          suggestion: 'Check if Frigate server is accessible and recordings exist for this time range'
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