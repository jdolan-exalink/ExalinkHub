import { NextRequest, NextResponse } from 'next/server';
import { frigateAPI } from '@/lib/frigate-api';

export async function GET(request: NextRequest) {
  try {
    console.log('=== FRIGATE TEST ENDPOINT ===');
    console.log('Testing connection to Frigate server...');
    
    const startTime = Date.now();
    const result = await frigateAPI.testConnection();
    const duration = Date.now() - startTime;
    
    console.log('Connection test result:', result);
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        status: 'connected',
        version: result.version,
        duration_ms: duration,
        server_url: 'http://10.1.1.252:5000',
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        status: 'disconnected',
        error: result.error,
        duration_ms: duration,
        server_url: 'http://10.1.1.252:5000',
        timestamp: new Date().toISOString()
      }, { status: 503 });
    }
    
  } catch (error) {
    console.error('Error in test endpoint:', error);
    return NextResponse.json({
      success: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      server_url: 'http://10.1.1.252:5000',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}