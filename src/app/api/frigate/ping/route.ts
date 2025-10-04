import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const serverId = searchParams.get('server_id');
    
    if (!serverId) {
      return NextResponse.json(
        { error: 'server_id parameter is required' },
        { status: 400 }
      );
    }

    const db = getConfigDatabase();
    const server = db.getServerById(parseInt(serverId));
    
    if (!server) {
      return NextResponse.json(
        { error: 'Server not found' },
        { status: 404 }
      );
    }

    // Construir URL completa del servidor
    const serverUrl = `${server.protocol}://${server.url}:${server.port}`;
    
    // Hacer ping al servidor con timeout de 10 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    try {
      const response = await fetch(`${serverUrl}/api/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(server.username && server.password && { 
            'Authorization': `Basic ${Buffer.from(`${server.username}:${server.password}`).toString('base64')}` 
          })
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return NextResponse.json({ 
          status: 'online',
          latency: Date.now() - parseInt(searchParams.get('start_time') || '0'),
          timestamp: Date.now(),
          server_name: server.name
        });
      } else {
        return NextResponse.json(
          { status: 'offline', error: `HTTP ${response.status}`, server_name: server.name },
          { status: 200 } // Return 200 but indicate offline status
        );
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      return NextResponse.json(
        { status: 'offline', error: 'Connection timeout or network error', server_name: server.name },
        { status: 200 } // Return 200 but indicate offline status
      );
    }
  } catch (error) {
    console.error('Error pinging server:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}