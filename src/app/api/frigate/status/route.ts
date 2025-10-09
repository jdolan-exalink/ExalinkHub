import { NextRequest, NextResponse } from 'next/server';
import { get_active_frigate_servers } from '@/lib/frigate-servers';
import { FrigateAPI } from '@/lib/frigate-api';

/**
 * Endpoint de estado Frigate: prueba conectividad con todos los servidores activos
 * Lee la configuración dinámica desde frigate-servers.ts
 * Devuelve el estado de cada servidor (conectividad, versión, errores)
 */
export async function GET() {
  try {
    console.log('=== FRIGATE STATUS ENDPOINT ===');
  const servers = get_active_frigate_servers();
    const results = [];

    for (const server of servers) {
      let connectivity = false;
      let version = null;
      let error = null;
      try {
        // Test basic connectivity
        const testResponse = await fetch(server.baseUrl, {
          method: 'HEAD',
          signal: AbortSignal.timeout(5000)
        });
        connectivity = testResponse.ok;
      } catch (connectError) {
        error = `Conectividad fallida: ${connectError instanceof Error ? connectError.message : 'Error desconocido'}`;
      }

      // Test Frigate API connection
      try {
        const api = new FrigateAPI({ baseUrl: server.baseUrl });
        const conn = await api.testConnection?.();
        if (conn?.success) {
          version = conn.version;
        } else if (conn?.error) {
          error = conn.error;
        }
      } catch (apiError) {
        error = `API error: ${apiError instanceof Error ? apiError.message : 'Error desconocido'}`;
      }

      results.push({
        id: server.id,
        name: server.name,
        url: server.baseUrl,
        connectivity,
        version,
        error
      });
    }

    return NextResponse.json({ servers: results });
  } catch (error) {
    console.error('Status endpoint error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}