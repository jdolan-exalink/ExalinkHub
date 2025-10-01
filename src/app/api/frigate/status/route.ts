import { NextRequest, NextResponse } from 'next/server';
import { frigateAPI } from '@/lib/frigate-api';

export async function GET() {
  try {
    console.log('Testing Frigate connection to http://10.1.1.252:5000...');
    
    const connection = await frigateAPI.testConnection();
    
    console.log('Connection result:', connection);
    
    if (!connection.success) {
      console.error('Frigate connection failed:', connection.error);
      return NextResponse.json(
        { 
          error: 'Failed to connect to Frigate server', 
          details: connection.error,
          serverUrl: 'http://10.1.1.252:5000'
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      version: connection.version,
      server: 'Casa',
      url: 'http://10.1.1.252:5000'
    });
  } catch (error) {
    console.error('Status endpoint error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error',
        serverUrl: 'http://10.1.1.252:5000'
      },
      { status: 500 }
    );
  }
}