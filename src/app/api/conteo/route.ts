/**
 * API principal del módulo de conteo de objetos
 * 
 * Implementa los endpoints especificados en el documento técnico:
 * - GET /api/conteo/info - Configuración básica para inicialización de UI
 * - GET /api/conteo/state - Estado actual de objetos activos
 * - POST /api/conteo/toggle - Activar/desactivar conteo de objetos
 * - GET /api/conteo/summary - Datos agregados para gráficos
 * 
 * Todos los endpoints siguen las especificaciones exactas del documento técnico.
 */

import { NextRequest, NextResponse } from 'next/server';
import { get_counting_database } from '@/lib/counting-database';

/**
 * GET /api/conteo/info
 * Devuelve la configuración básica necesaria para que la interfaz se inicialice
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const endpoint = url.pathname.split('/').pop();

    const counting_db = get_counting_database();
    const config = counting_db.get_configuration();

    if (!config) {
      return NextResponse.json({
        error: 'No se encontró configuración del módulo de conteo'
      }, { status: 404 });
    }

    switch (endpoint) {
      case 'info':
        return handle_info(config);
      
      case 'state':
        return handle_state(config);
        
      case 'summary':
        return handle_summary(url.searchParams, counting_db);
        
      default:
        return NextResponse.json({
          error: 'Endpoint no encontrado'
        }, { status: 404 });
    }

  } catch (error: any) {
    console.error('Error in counting API:', error);
    
    return NextResponse.json({
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}

/**
 * POST /api/conteo/toggle
 * Activa o desactiva el conteo para un objeto específico
 */
export async function POST(request: NextRequest) {
  try {
    const request_data = await request.json();
    const { label } = request_data;

    if (!label || typeof label !== 'string') {
      return NextResponse.json({
        error: 'Campo "label" requerido'
      }, { status: 400 });
    }

    const counting_db = get_counting_database();
    const active_objects = counting_db.toggle_active_object(label);

    console.log('Object toggle successful:', {
      label,
      new_active_objects: active_objects
    });

    return NextResponse.json({
      activos: active_objects
    });

  } catch (error: any) {
    console.error('Error toggling object:', error);
    
    return NextResponse.json({
      error: error.message || 'Error interno al cambiar estado del objeto'
    }, { status: 500 });
  }
}

/**
 * Maneja el endpoint /info
 */
function handle_info(config: any) {
  const cameras = JSON.parse(config.cameras);
  
  return NextResponse.json({
    mode: config.presentation_mode,
    title: config.presentation_mode === 'dividido' ? 'Conteo por Cámara' : 'Conteo General',
    cameras: cameras
  });
}

/**
 * Maneja el endpoint /state
 */
function handle_state(config: any) {
  const objects = JSON.parse(config.objects);
  const active_objects = JSON.parse(config.active_objects);
  
  return NextResponse.json({
    activos: active_objects,
    objetos: objects
  });
}

/**
 * Maneja el endpoint /summary
 */
function handle_summary(searchParams: URLSearchParams, counting_db: any) {
  const view = searchParams.get('view');
  const date = searchParams.get('date');
  const camera = searchParams.get('camera');

  // Validar parámetros requeridos
  if (!view || !date) {
    return NextResponse.json({
      error: 'Parámetros "view" y "date" son requeridos'
    }, { status: 400 });
  }

  // Validar view
  if (!['day', 'week', 'month'].includes(view)) {
    return NextResponse.json({
      error: 'Parámetro "view" debe ser: day, week, o month'
    }, { status: 400 });
  }

  // Validar formato de fecha
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({
      error: 'Parámetro "date" debe estar en formato YYYY-MM-DD'
    }, { status: 400 });
  }

  try {
    const summary = counting_db.get_summary(view, date, camera || undefined);
    
    console.log('Summary generated:', {
      view,
      date,
      camera: camera || 'all',
      totals_count: summary.totals.length,
      by_hour_rows: summary.by_hour.rows.length,
      by_bucket_rows: summary.by_bucket.rows.length
    });

    return NextResponse.json(summary);

  } catch (error: any) {
    console.error('Error generating summary:', error);
    
    return NextResponse.json({
      error: 'Error al generar resumen de datos'
    }, { status: 500 });
  }
}