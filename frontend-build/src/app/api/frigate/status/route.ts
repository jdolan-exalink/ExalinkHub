import { NextRequest, NextResponse } from 'next/server';
import { frigateAPI } from '@/lib/frigate-api';

export async function GET() {
  try {
    console.log('=== FRIGATE STATUS ENDPOINT ===');
    console.log('Testing Frigate connection to http://10.1.1.252:5000...');
    
    // Test basic connectivity first
    try {
      const testResponse = await fetch('http://10.1.1.252:5000', { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      console.log('Basic connectivity test:', testResponse.status);
    } catch (connectError) {
      console.error('Basic connectivity failed:', connectError);
      return NextResponse.json(
        { 
          error: 'Cannot reach Frigate server', 
          details: `Connection failed: ${connectError instanceof Error ? connectError.message : 'Unknown error'}`,
          serverUrl: 'http://10.1.1.252:5000',
          suggestion: 'Check if Frigate server is running and accessible from this network'
        },
        { status: 503 }
      );
    }

    // Test Frigate API connection
    const connection = await frigateAPI.testConnection();
    
    console.log('Frigate API connection result:', connection);
    
    if (!connection.success) {
      console.error('Frigate API connection failed:', connection.error);
      return NextResponse.json(
        { 
          error: 'Failed to connect to Frigate API', 
          details: connection.error,
          serverUrl: 'http://10.1.1.252:5000',
          suggestion: 'Check Frigate API is responding correctly'
        },
        { status: 503 }
      );
    }

    console.log('Connection successful! Version:', connection.version);

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