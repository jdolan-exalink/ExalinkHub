/**
 * API para gestión de áreas de conteo
 * 
 * Endpoints para CRUD de áreas, gestión de ocupación y consultas de estado.
 * Implementa la especificación técnica del sistema de conteo y aforo.
 * 
 * GET /api/conteo/areas - Lista todas las áreas con estado actual
 * POST /api/conteo/areas - Crea una nueva área
 * PUT /api/conteo/areas/[id] - Actualiza un área existente  
 * DELETE /api/conteo/areas/[id] - Elimina un área
 */

import { NextRequest, NextResponse } from 'next/server';
import { get_counting_database } from '@/lib/counting-database';

/**
 * Obtiene todas las áreas definidas con su estado actual
 */
export async function GET() {
  try {
    console.log('Conteo Areas API: Getting all areas...');

    const counting_db = get_counting_database();
    
    // Obtener áreas con estado completo
    const areas_status = counting_db.get_areas_current_status();
    
    console.log('Conteo Areas API: Areas retrieved:', areas_status.length);

    return NextResponse.json({
      success: true,
      data: areas_status
    });

  } catch (error) {
    console.error('Conteo Areas API: Error getting areas:', error);
    
    return NextResponse.json(
      { success: false, error: 'Error al obtener áreas' },
      { status: 500 }
    );
  }
}

/**
 * Crea una nueva área de conteo
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Conteo Areas API: Creating area with data:', body);

    const {
      nombre,
      tipo,
      max_ocupacion = 50,
      modo_limite = 'soft',
      metadata_mapa,
      enabled = true
    } = body;

    // Validar campos requeridos
    if (!nombre || !tipo) {
      return NextResponse.json(
        { success: false, error: 'Nombre y tipo son requeridos' },
        { status: 400 }
      );
    }

    // Validar tipo
    if (!['personas', 'vehiculos'].includes(tipo)) {
      return NextResponse.json(
        { success: false, error: 'Tipo debe ser "personas" o "vehiculos"' },
        { status: 400 }
      );
    }

    const counting_db = get_counting_database();

    // Crear área
    const area_id = counting_db.create_area({
      nombre,
      tipo,
      max_ocupacion,
      modo_limite,
      estado_actual: 0,
      color_estado: 'green',
      metadata_mapa: metadata_mapa ? JSON.stringify(metadata_mapa) : undefined,
      enabled
    });

    if (!area_id) {
      return NextResponse.json(
        { success: false, error: 'Error al crear área' },
        { status: 500 }
      );
    }

    console.log('Conteo Areas API: Area created with ID:', area_id);

    return NextResponse.json({
      success: true,
      data: { id: area_id, nombre, tipo, max_ocupacion, enabled }
    });

  } catch (error) {
    console.error('Conteo Areas API: Error creating area:', error);
    
    return NextResponse.json(
      { success: false, error: 'Error al crear área' },
      { status: 500 }
    );
  }
}