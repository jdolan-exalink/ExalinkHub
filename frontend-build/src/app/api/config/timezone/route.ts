import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

/**
 * GET /api/config/timezone
 * Obtiene el offset de timezone configurado
 */
export async function GET() {
  try {
    const db = getConfigDatabase();
    const offset = db.get_timezone_offset();
    
    return NextResponse.json({
      success: true,
      timezone_offset: offset,
      timezone_string: `UTC${offset >= 0 ? '+' : ''}${offset}`,
    });
  } catch (error) {
    console.error('Error obteniendo timezone:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al obtener configuración de timezone',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/config/timezone
 * Actualiza el offset de timezone
 * 
 * Body: {
 *   timezone_offset: number  // Ejemplo: -3 para UTC-3, 0 para UTC, +1 para UTC+1
 * }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { timezone_offset } = body;

    // Validaciones
    if (typeof timezone_offset !== 'number') {
      return NextResponse.json(
        { success: false, message: 'El parámetro "timezone_offset" debe ser un número' },
        { status: 400 }
      );
    }

    if (timezone_offset < -12 || timezone_offset > 14) {
      return NextResponse.json(
        { success: false, message: 'El timezone_offset debe estar entre -12 y +14' },
        { status: 400 }
      );
    }

    const db = getConfigDatabase();
    db.set_timezone_offset(timezone_offset);

    console.log(`🌍 Timezone actualizado a: UTC${timezone_offset >= 0 ? '+' : ''}${timezone_offset}`);

    return NextResponse.json({
      success: true,
      message: 'Timezone actualizado correctamente',
      timezone_offset,
      timezone_string: `UTC${timezone_offset >= 0 ? '+' : ''}${timezone_offset}`,
    });

  } catch (error) {
    console.error('Error actualizando timezone:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Error al actualizar timezone',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
