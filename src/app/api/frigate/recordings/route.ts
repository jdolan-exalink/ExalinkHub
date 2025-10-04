import { NextRequest, NextResponse } from 'next/server';
import { frigateAPI } from '@/lib/frigate-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const camera = searchParams.get('camera');
    const date = searchParams.get('date'); // YYYY-MM-DD format
    
    if (!camera) {
      return NextResponse.json({ error: 'Camera parameter is required' }, { status: 400 });
    }

    if (!date) {
      return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
    }

    // Get timeline data for the specified camera and date
    const timelineData = await frigateAPI.getRecordingTimeline(camera, date);

    return NextResponse.json(timelineData);
  } catch (error) {
    console.error('Error fetching recordings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recordings' }, 
      { status: 500 }
    );
  }
}