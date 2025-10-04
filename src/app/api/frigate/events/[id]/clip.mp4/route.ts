import { NextRequest, NextResponse } from 'next/server';
import { frigateAPI } from '@/lib/frigate-api';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const eventId = params.id;
    
    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // For Frigate, event clips are typically accessed via the event ID
    // This would need to be implemented based on your Frigate setup
    const clipUrl = `${frigateAPI['baseUrl']}/api/events/${eventId}/clip.mp4`;
    
    const response = await fetch(clipUrl, {
      headers: frigateAPI['getHeaders'](),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch clip: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="event_${eventId}.mp4"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error fetching event clip:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event clip' }, 
      { status: 500 }
    );
  }
}