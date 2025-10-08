import { NextRequest, NextResponse } from 'next/server';
import { frigateAPI } from '@/lib/frigate-api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ camera: string }> }
) {
  let cameraName = 'unknown';
  try {
    const { camera } = await params;
    cameraName = camera;
    const blob = await frigateAPI.getCameraSnapshot(cameraName);
    
    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error(`Error getting snapshot for camera ${cameraName}:`, error);
    return NextResponse.json(
      { error: 'Failed to get snapshot', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}