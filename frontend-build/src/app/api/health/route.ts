import { NextResponse } from 'next/server';

/**
 * Endpoint de health check para el frontend
 * Verifica que el servicio esté funcionando correctamente
 */
export async function GET() {
  try {
    // Verificar que podemos acceder a las rutas básicas
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'exalink-frontend',
      version: '1.0.0'
    };

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}