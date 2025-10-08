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

    const params: any = {};
    
    if (after) params.after = parseInt(after);
    if (before) params.before = parseInt(before);
    if (camera) params.camera = camera;
    if (label) params.label = label;
    if (limit) params.limit = parseInt(limit);

    // Get events from Frigate API
    const events = await frigateAPI.getEvents(params);

    return NextResponse.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}