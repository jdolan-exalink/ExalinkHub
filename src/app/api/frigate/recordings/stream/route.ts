import { NextRequest, NextResponse } from 'next/server';
import { create_frigate_api } from '@/lib/frigate-api';
import { resolve_frigate_server } from '@/lib/frigate-servers';

export async function GET(request: NextRequest) {
  try {
    console.log('=== RECORDINGS STREAM ENDPOINT ===');
    console.log('Stream endpoint called with URL:', request.url);
    
    const { searchParams } = new URL(request.url);
    const camera = searchParams.get('camera');
    const date = searchParams.get('date');
    const time = searchParams.get('time');
    const server_id = searchParams.get('server_id');
    
    console.log('Stream parameters:', { camera, date, time });
    
    if (!camera || !date || !time) {
      console.log('Missing parameters');
      return NextResponse.json(
        { error: 'Missing required parameters: camera, date, time' },
        { status: 400 }
      );
    }

    const timestamp = parseInt(time);
    if (isNaN(timestamp)) {
      console.log('Invalid timestamp:', time);
      return NextResponse.json(
        { error: 'Invalid timestamp' },
        { status: 400 }
      );
    }

    console.log('Fetching recordings for camera:', camera, 'timestamp:', timestamp);

    try {
      // Convert timestamp to proper date for debugging
      const recordingDate = new Date(timestamp * 1000);
      console.log('Looking for recording at:', recordingDate.toISOString());

      // Calculate time range (get a wider range to find the recording)
      const before = timestamp + 3600; // 1 hour after
      const after = timestamp - 3600;  // 1 hour before

      console.log('Time range:', {
        after: new Date(after * 1000).toISOString(),
        before: new Date(before * 1000).toISOString(),
        timestamp: recordingDate.toISOString()
      });

      const target_server = resolve_frigate_server(server_id);
      if (!target_server) {
        return NextResponse.json(
          { 
            error: 'No hay servidores Frigate disponibles',
            camera,
            timestamp
          },
          { status: 503 }
        );
      }

      const frigate_api = create_frigate_api(target_server);
      // Get recordings for the time range
      const recordings = await frigate_api.getRecordings({ camera, before, after });
      
      console.log('Found recordings:', recordings.length);
      console.log('Recording details:', recordings.map(r => ({
        id: r.id,
        start: new Date(r.start_time * 1000).toISOString(),
        end: new Date(r.end_time * 1000).toISOString()
      })));

      // Find the recording segment that contains our timestamp
      const targetRecording = recordings.find((recording: any) => {
        return timestamp >= recording.start_time && timestamp <= recording.end_time;
      });

      if (!targetRecording) {
        console.log('No recording found for timestamp');
        return NextResponse.json(
          { 
            error: 'No recording found for specified time',
            available_recordings: recordings.length,
            searched_time: timestamp,
            camera: camera
          },
          { status: 404 }
        );
      }

      console.log('Found target recording:', targetRecording);

      // Try to get the actual video clip from Frigate
      try {
        const clipStartTime = Math.max(targetRecording.start_time, timestamp - 30); // 30s before
        const clipEndTime = Math.min(targetRecording.end_time, timestamp + 30);   // 30s after
        
        console.log('Requesting clip from Frigate:', {
          camera,
          start: clipStartTime,
          end: clipEndTime,
          startISO: new Date(clipStartTime * 1000).toISOString(),
          endISO: new Date(clipEndTime * 1000).toISOString()
        });

        // Get video clip from Frigate
        const videoBlob = await frigate_api.downloadRecordingClip(camera, clipStartTime, clipEndTime);
        
        // Convert blob to array buffer
        const arrayBuffer = await videoBlob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        console.log('Successfully got video clip, size:', buffer.length, 'bytes');

        // Return the video file with proper headers
        return new NextResponse(buffer as any, {
          status: 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': buffer.length.toString(),
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'public, max-age=3600',
          },
        });

      } catch (videoError) {
        console.error('Failed to get video from Frigate:', videoError);
        
        // Fallback: return recording info as JSON
        return NextResponse.json({
          success: true,
          message: 'Recording found but video streaming failed',
          recording: {
            id: targetRecording.id,
            camera: camera,
            start_time: targetRecording.start_time,
            end_time: targetRecording.end_time,
            duration: targetRecording.duration,
            path: targetRecording.path
          },
          video_url: `/api/frigate/recordings/video?camera=${encodeURIComponent(camera)}&start=${targetRecording.start_time}&end=${targetRecording.end_time}${server_id ? `&server_id=${encodeURIComponent(server_id)}` : ''}`,
          error: 'Video streaming requires direct Frigate server connection',
          details: videoError instanceof Error ? videoError.message : 'Unknown video error'
        }, { 
          status: 200,
          headers: {
            'Content-Type': 'application/json'
          }
        });
      }

    } catch (frigateError) {
      console.error('Frigate API error:', frigateError);
      return NextResponse.json(
        { 
          error: 'Failed to fetch recordings from Frigate',
          details: frigateError instanceof Error ? frigateError.message : 'Unknown Frigate error',
          camera: camera,
          timestamp: timestamp
        },
        { status: 503 }
      );
    }

  } catch (error) {
    console.error('Error in recordings stream endpoint:', error);
    return NextResponse.json(
      { error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
