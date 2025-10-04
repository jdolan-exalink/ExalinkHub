import { NextRequest, NextResponse } from 'next/server';
import { frigateAPI } from '@/lib/frigate-api';

export async function GET(request: NextRequest) {
  try {
    console.log('=== RECORDINGS DEBUG ENDPOINT ===');
    
    const { searchParams } = new URL(request.url);
    const camera = searchParams.get('camera') || 'Portones';
    
    // Get recordings for today
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    
    const after = Math.floor(startOfDay.getTime() / 1000);
    const before = Math.floor(endOfDay.getTime() / 1000);
    
    console.log('Debugging recordings for camera:', camera);
    console.log('Date range:', {
      after: startOfDay.toISOString(),
      before: endOfDay.toISOString(),
      after_timestamp: after,
      before_timestamp: before
    });
    
    // Test direct Frigate API call
    try {
      const recordings = await frigateAPI.getRecordings({ camera, after, before });
      
      return NextResponse.json({
        success: true,
        camera: camera,
        date_range: {
          start: startOfDay.toISOString(),
          end: endOfDay.toISOString(),
          after_timestamp: after,
          before_timestamp: before
        },
        recordings_found: recordings.length,
        recordings: recordings.map(r => ({
          id: r.id,
          start_time: r.start_time,
          end_time: r.end_time,
          start_iso: new Date(r.start_time * 1000).toISOString(),
          end_iso: new Date(r.end_time * 1000).toISOString(),
          duration: r.duration,
          path: r.path
        })),
        timeline_data: {
          segments: recordings.map(r => ({
            start_time: r.start_time,
            end_time: r.end_time,
            duration: r.duration
          }))
        }
      });
      
    } catch (frigateError) {
      return NextResponse.json({
        success: false,
        error: 'Frigate API error',
        details: frigateError instanceof Error ? frigateError.message : String(frigateError),
        camera: camera
      }, { status: 503 });
    }
    
  } catch (error) {
    console.error('Error in recordings debug endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}