import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Simular estado de servicios (en producción esto vendría de servicios reales)
    const services = {
      lpr: {
        status: 'stopped',
        uptime: 0,
        processed: 1250
      },
      counting: {
        status: 'running',
        uptime: 3600,
        counted: 89
      },
      notifications: {
        status: 'running',
        uptime: 7200,
        sent: 45
      }
    };

    return NextResponse.json({ services });
  } catch (error) {
    console.error('Error obteniendo estado de servicios:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}