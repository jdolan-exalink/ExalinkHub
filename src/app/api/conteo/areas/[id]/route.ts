/**
 * API para gestión individual de área por ID
 * 
 * GET /api/conteo/areas/[id] - Obtiene detalles de un área específica
 * PUT /api/conteo/areas/[id] - Actualiza un área existente
 * DELETE /api/conteo/areas/[id] - Elimina un área
 */

import { NextRequest, NextResponse } from 'next/server';
import { get_counting_database } from '@/lib/counting-database';

/**
 * Obtiene detalles de un área específica con histórico reciente
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const area_id = parseInt(params.id);
    
    if (isNaN(area_id)) {
      return NextResponse.json(
        { success: false, error: 'ID de área inválido' },
        { status: 400 }
      );
    }

    console.log('Conteo Area API: Getting area details for ID:', area_id);

    const counting_db = get_counting_database();
    
    // Obtener área
    const area = counting_db.get_area_by_id(area_id);
    if (!area) {
      return NextResponse.json(
        { success: false, error: 'Área no encontrada' },
        { status: 404 }
      );
    }

    // Obtener puntos de acceso
    const access_points = counting_db.get_access_points_by_area(area_id);
    
    // Obtener eventos recientes
    const recent_events = counting_db.get_area_recent_events(area_id, 20);
    
    // Obtener mediciones históricas (última hora)
    const one_hour_ago = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const current_time = new Date().toISOString();
    const measurements = counting_db.get_area_measurements(area_id, one_hour_ago, current_time, 60);

    console.log('Conteo Area API: Area details retrieved for:', area.nombre);

    return NextResponse.json({
      success: true,
      data: {
        area,
        access_points,
        recent_events,
        measurements
      }
    });

  } catch (error) {
    console.error('Conteo Area API: Error getting area details:', error);
    
    return NextResponse.json(
      { success: false, error: 'Error al obtener detalles del área' },
      { status: 500 }
    );
  }
}

/**
 * Actualiza un área existente
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const area_id = parseInt(params.id);
    
    if (isNaN(area_id)) {
      return NextResponse.json(
        { success: false, error: 'ID de área inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    console.log('Conteo Area API: Updating area ID:', area_id, 'with data:', body);

    const counting_db = get_counting_database();
    
    // Verificar que el área existe
    const existing_area = counting_db.get_area_by_id(area_id);
    if (!existing_area) {
      return NextResponse.json(
        { success: false, error: 'Área no encontrada' },
        { status: 404 }
      );
    }

    // Preparar datos de actualización
    const update_data: any = {};
    
    if (body.nombre !== undefined) update_data.nombre = body.nombre;
    if (body.tipo !== undefined) {
      if (!['personas', 'vehiculos'].includes(body.tipo)) {
        return NextResponse.json(
          { success: false, error: 'Tipo debe ser "personas" o "vehiculos"' },
          { status: 400 }
        );
      }
      update_data.tipo = body.tipo;
    }
    if (body.max_ocupacion !== undefined) update_data.max_ocupacion = body.max_ocupacion;
    if (body.modo_limite !== undefined) update_data.modo_limite = body.modo_limite;
    if (body.enabled !== undefined) update_data.enabled = body.enabled;
    if (body.metadata_mapa !== undefined) {
      update_data.metadata_mapa = typeof body.metadata_mapa === 'string' 
        ? body.metadata_mapa 
        : JSON.stringify(body.metadata_mapa);
    }

    // Actualizar área
    const success = counting_db.update_area(area_id, update_data);

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Error al actualizar área' },
        { status: 500 }
      );
    }

    console.log('Conteo Area API: Area updated successfully:', area_id);

    return NextResponse.json({
      success: true,
      data: { id: area_id, ...update_data }
    });

  } catch (error) {
    console.error('Conteo Area API: Error updating area:', error);
    
    return NextResponse.json(
      { success: false, error: 'Error al actualizar área' },
      { status: 500 }
    );
  }
}

/**
 * Elimina un área
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const area_id = parseInt(params.id);
    
    if (isNaN(area_id)) {
      return NextResponse.json(
        { success: false, error: 'ID de área inválido' },
        { status: 400 }
      );
    }

    console.log('Conteo Area API: Deleting area ID:', area_id);

    const counting_db = get_counting_database();
    
    // Verificar que el área existe
    const existing_area = counting_db.get_area_by_id(area_id);
    if (!existing_area) {
      return NextResponse.json(
        { success: false, error: 'Área no encontrada' },
        { status: 404 }
      );
    }

    // En lugar de eliminar, deshabilitar el área
    const success = counting_db.update_area(area_id, { enabled: false });

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Error al eliminar área' },
        { status: 500 }
      );
    }

    console.log('Conteo Area API: Area disabled successfully:', area_id);

    return NextResponse.json({
      success: true,
      data: { id: area_id, enabled: false }
    });

  } catch (error) {
    console.error('Conteo Area API: Error deleting area:', error);
    
    return NextResponse.json(
      { success: false, error: 'Error al eliminar área' },
      { status: 500 }
    );
  }
}