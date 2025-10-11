import { NextRequest, NextResponse } from 'next/server';
import { create_frigate_api } from '@/lib/frigate-api';
import { resolve_frigate_server } from '@/lib/frigate-servers';

export async function GET(request: NextRequest) {
  try {
    console.log('=== FRIGATE TEST ENDPOINT ===');
    console.log('Testing connection to Frigate server...');
    
    const { searchParams } = new URL(request.url);
    const server_id = searchParams.get('server_id');
    const target_server = resolve_frigate_server(server_id);

    if (!target_server) {
      return NextResponse.json({
        success: false,
        status: 'disconnected',
        error: 'No hay servidores Frigate configurados',
        duration_ms: 0,
        server_url: null,
        timestamp: new Date().toISOString()
      }, { status: 503 });
    }

    const frigate_api = create_frigate_api(target_server);
    const startTime = Date.now();
    const result = await frigate_api.testConnection?.();
    const duration = Date.now() - startTime;
    
    console.log('Connection test result:', result);
    
    if (result?.success) {
      return NextResponse.json({
        success: true,
        status: 'connected',
        version: result.version,
        duration_ms: duration,
        server_url: target_server.baseUrl,
        timestamp: new Date().toISOString()
      });
    } else {
      return NextResponse.json({
        success: false,
        status: 'disconnected',
        error: result?.error || 'Error desconocido',
        duration_ms: duration,
        server_url: target_server.baseUrl,
        timestamp: new Date().toISOString()
      }, { status: 503 });
    }
    
  } catch (error) {
    console.error('Error in test endpoint:', error);
    return NextResponse.json({
      success: false,
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      server_url: null,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
