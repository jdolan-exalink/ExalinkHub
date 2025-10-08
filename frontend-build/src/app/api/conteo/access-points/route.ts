/**
 * API para gestión de puntos de acceso
 * 
 * Los puntos de acceso conectan zonas de Frigate con áreas de conteo,
 * definiendo si una zona actúa como entrada o salida para un área.
 * 
 * GET /api/conteo/access-points - Lista todos los puntos de acceso
 * POST /api/conteo/access-points - Crea un nuevo punto de acceso
 */

import { NextRequest, NextResponse } from 'next/server';
import { get_counting_database } from '@/lib/counting-database';

/**
 * Obtiene todos los puntos de acceso configurados
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const area_id = searchParams.get('area_id');

    console.log('Conteo Access Points API: Getting access points, area_id:', area_id);

    const counting_db = get_counting_database();
    
    let access_points;
    if (area_id) {
      // Filtrar por área específica
      const parsed_area_id = parseInt(area_id);
      if (isNaN(parsed_area_id)) {
        return NextResponse.json(
          { success: false, error: 'ID de área inválido' },
          { status: 400 }
        );
      }
      access_points = counting_db.get_access_points_by_area(parsed_area_id);
    } else {
      // Obtener todos los puntos de acceso con información del área
      access_points = counting_db.query_all_statement(`
        SELECT 
          ap.*,
          a.nombre as area_nombre,
          a.tipo as area_tipo,
          a.enabled as area_enabled
        FROM access_points ap
        JOIN areas a ON ap.area_id = a.id
        ORDER BY a.nombre, ap.direccion
      `);
    }
    
    console.log('Conteo Access Points API: Access points retrieved:', access_points.length);

    return NextResponse.json({
      success: true,
      data: access_points
    });

  } catch (error) {
    console.error('Conteo Access Points API: Error getting access points:', error);
    
    return NextResponse.json(
      { success: false, error: 'Error al obtener puntos de acceso' },
      { status: 500 }
    );
  }
}

/**
 * Crea un nuevo punto de acceso
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('Conteo Access Points API: Creating access point with data:', body);

    const {
      area_id,
      fuente_id,
      direccion,
      geometry,
      enabled = true
    } = body;

    // Validar campos requeridos
    if (!area_id || !fuente_id || !direccion) {
      return NextResponse.json(
        { success: false, error: 'area_id, fuente_id y direccion son requeridos' },
        { status: 400 }
      );
    }

    // Validar dirección
    if (!['entrada', 'salida'].includes(direccion)) {
      return NextResponse.json(
        { success: false, error: 'Dirección debe ser "entrada" o "salida"' },
        { status: 400 }
      );
    }

    const counting_db = get_counting_database();

    // Verificar que el área existe
    const area = counting_db.get_area_by_id(area_id);
    if (!area) {
      return NextResponse.json(
        { success: false, error: 'Área no encontrada' },
        { status: 404 }
      );
    }

    // Crear punto de acceso
    const access_point_id = counting_db.create_access_point({
      area_id,
      fuente_id,
      direccion,
      geometry: geometry ? JSON.stringify(geometry) : undefined,
      enabled
    });

    if (!access_point_id) {
      return NextResponse.json(
        { success: false, error: 'Error al crear punto de acceso' },
        { status: 500 }
      );
    }

    console.log('Conteo Access Points API: Access point created with ID:', access_point_id);

    return NextResponse.json({
      success: true,
      data: { 
        id: access_point_id, 
        area_id, 
        fuente_id, 
        direccion, 
        enabled,
        area_nombre: area.nombre 
      }
    });

  } catch (error) {
    console.error('Conteo Access Points API: Error creating access point:', error);
    
    return NextResponse.json(
      { success: false, error: 'Error al crear punto de acceso' },
      { status: 500 }
    );
  }
}