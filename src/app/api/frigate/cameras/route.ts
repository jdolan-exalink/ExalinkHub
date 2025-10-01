import { NextRequest, NextResponse } from 'next/server';
import { frigateAPI } from '@/lib/frigate-api';

export async function GET() {
  try {
    const config = await frigateAPI.getConfig();
    const cameraNames = Object.keys(config.cameras);
    
    const cameras = await Promise.all(
      cameraNames.map(async (name) => {
        const cameraConfig = config.cameras[name];
        return {
          id: name,
          name: name,
          enabled: cameraConfig.enabled,
          recording: cameraConfig.recording?.enabled || false,
          detection: cameraConfig.detect?.enabled || false,
          snapshots: cameraConfig.snapshots?.enabled || false,
          streamUrl: frigateAPI.getCameraStreamUrl(name),
          snapshotUrl: `http://10.1.1.252:5000/api/${name}/latest.jpg`,
          server: 'Casa'
        };
      })
    );

    return NextResponse.json(cameras);
  } catch (error) {
    console.error('Error fetching cameras:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cameras', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}