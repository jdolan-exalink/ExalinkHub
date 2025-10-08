/**
 * GET /api/conteo/info
 * Devuelve la configuración básica necesaria para que la interfaz se inicialice
 */

import { NextRequest, NextResponse } from 'next/server';
import { CountingDatabase } from '@/lib/counting-database';

export async function GET(request: NextRequest) {
  try {
    const counting_db = new CountingDatabase();
    const config = counting_db.get_configuration();

    if (!config) {
      return NextResponse.json({
        error: 'No se encontró configuración del módulo de conteo'
      }, { status: 404 });
    }

    // Obtener cámaras configuradas según modo de operación
    let cameras: string[] = [];
    if (config.operation_mode === 'two_cameras') {
      cameras = [config.camera_in, config.camera_out].filter(Boolean) as string[];
    } else if (config.operation_mode === 'zones' && config.camera_zones) {
      cameras = [config.camera_zones];
    }
    
    return NextResponse.json({
      mode: config.operation_mode || 'two_cameras',
      title: config.operation_mode === 'zones' ? 'Conteo por Zonas' : 'Conteo por Cámaras',
      cameras: cameras
    });

  } catch (error: any) {
    console.error('Error in /api/conteo/info:', error);
    
    return NextResponse.json({
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}