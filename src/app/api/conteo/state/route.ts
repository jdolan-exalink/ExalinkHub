/**
 * GET /api/conteo/state
 * Proporciona el estado actual de los objetos configurados y los que están activos
 */

import { NextRequest, NextResponse } from 'next/server';
import { get_counting_database } from '@/lib/counting-database';

export async function GET(request: NextRequest) {
  try {
    const counting_db = get_counting_database();
    const config = counting_db.get_configuration();

    if (!config) {
      return NextResponse.json({
        error: 'No se encontró configuración del módulo de conteo'
      }, { status: 404 });
    }

    const objects = JSON.parse(config.objects);
    const active_objects = JSON.parse(config.active_objects);
    
    return NextResponse.json({
      activos: active_objects,
      objetos: objects
    });

  } catch (error: any) {
    console.error('Error in /api/conteo/state:', error);
    
    return NextResponse.json({
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}