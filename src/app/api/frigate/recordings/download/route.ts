import { NextRequest, NextResponse } from 'next/server';
import { frigateAPI } from '@/lib/frigate-api';

export async function GET(request: NextRequest) {
  try {
    console.log('=== RECORDINGS DOWNLOAD ENDPOINT ===');
    
    const { searchParams } = new URL(request.url);
    const camera = searchParams.get('camera');
    const startTime = searchParams.get('start_time');
    const endTime = searchParams.get('end_time');
    
    console.log('Download parameters:', { camera, startTime, endTime });
    
    if (!camera || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Camera, start_time, and end_time parameters are required' }, 
        { status: 400 }
      );
    }

    const startTimeNum = parseInt(startTime);
    const endTimeNum = parseInt(endTime);

    if (isNaN(startTimeNum) || isNaN(endTimeNum)) {
      return NextResponse.json({ 
        error: 'start_time and end_time must be valid Unix timestamps' 
      }, { status: 400 });
    }

    console.log('Downloading clip:', {
      camera,
      startTimeNum,
      endTimeNum,
      startISO: new Date(startTimeNum * 1000).toISOString(),
      endISO: new Date(endTimeNum * 1000).toISOString(),
      duration: endTimeNum - startTimeNum
    });

    try {
      // Download the clip from Frigate
      const clipBlob = await frigateAPI.downloadRecordingClip(camera, startTimeNum, endTimeNum);
      
      // Convert blob to buffer for response
      const arrayBuffer = await clipBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

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
            startTime: startTimeNum,
            endTime: endTimeNum
          },
          { status: 404 }
        );
      }

      // Set appropriate headers for MP4 download
      const startDate = new Date(startTimeNum * 1000);
      const endDate = new Date(endTimeNum * 1000);
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
          startTime: startTimeNum,
          endTime: endTimeNum,
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