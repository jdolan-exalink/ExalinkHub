import { NextRequest, NextResponse } from 'next/server';
import { frigateAPI } from '@/lib/frigate-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const after = searchParams.get('after');
    const before = searchParams.get('before');
    const camera = searchParams.get('camera');
    const label = searchParams.get('label');
    const limit = searchParams.get('limit');

    console.log('Events API called with params:', { after, before, camera, label, limit });

    const params: any = {};
    
    if (after) params.after = parseInt(after);
    if (before) params.before = parseInt(before);
    if (camera) params.camera = camera;
    if (label) params.label = label;
    if (limit) params.limit = parseInt(limit);

    console.log('Calling frigateAPI.getEvents with:', params);

    // Get events from Frigate API
    const events = await frigateAPI.getEvents(params);

    console.log('Events received from Frigate API:', events?.length || 0, 'events');

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error in events API route:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Full error details:', { error, stack: error instanceof Error ? error.stack : 'No stack' });
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch events', 
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}