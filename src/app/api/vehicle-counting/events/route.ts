/**
 * API para eventos de transición vehicular
 * GET /api/vehicle-counting/events - Obtener eventos desde el backend de conteo
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Obtiene la URL del backend de conteo vehicular según el entorno.
 * - Si está definida NEXT_PUBLIC_CONTEO_BASE_URL o CONTEO_BACKEND_URL, la usa.
 * - Si está en producción (Docker), usa http://conteo-backend:8000
 * - Si está en desarrollo/local, usa http://localhost:2223
 */
function get_conteo_backend_url() {
  if (process.env.NEXT_PUBLIC_CONTEO_BASE_URL) return process.env.NEXT_PUBLIC_CONTEO_BASE_URL;
  if (process.env.CONTEO_BACKEND_URL) return process.env.CONTEO_BACKEND_URL;
  // Detectar entorno: production = Docker, development = local
  if (process.env.NODE_ENV === 'production') {
    return 'http://conteo-backend:8000';
  }
  return 'http://localhost:2223';
}

/**
 * Transforma los eventos del backend de conteo al formato esperado por el frontend
 */
function transformEventsToTransitions(events: any[]): any[] {
  return events.map(event => ({
    id: event.id,
    camera_name: event.camera,
    object_type: event.label,
    transition_type: event.zone === 'IN' ? 'in' : 'out',
    confidence: 0.95, // El backend no proporciona confidence por ahora
    zone_name: event.zone,
    timestamp: event.end_time || event.start_time,
    // Agregar campos adicionales que espera el frontend
    start_time: event.start_time,
    end_time: event.end_time
  }));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Construir parámetros para el backend de conteo
    const backendParams = new URLSearchParams();

    // Mapeo de parámetros del frontend al backend
    if (searchParams.get('camera')) {
      backendParams.append('camera', searchParams.get('camera')!);
    }

    if (searchParams.get('zone_id')) {
      // El backend usa 'zone', no 'zone_id'
      // Por ahora, asumimos que zone_id corresponde a zona IN/OUT
      // TODO: Mejorar este mapeo cuando tengamos la configuración de zonas
    }

    if (searchParams.get('type')) {
      // El frontend usa 'type' (in/out), el backend usa 'zone' (IN/OUT)
      const transitionType = searchParams.get('type');
      if (transitionType === 'in') {
        backendParams.append('zone', 'IN');
      } else if (transitionType === 'out') {
        backendParams.append('zone', 'OUT');
      }
    }

    if (searchParams.get('start_date')) {
      backendParams.append('start_date', searchParams.get('start_date')!);
    }

    if (searchParams.get('end_date')) {
      backendParams.append('end_date', searchParams.get('end_date')!);
    }

    const limit = searchParams.get('limit') || '50';
    backendParams.append('limit', limit);

    // Si no se especifican fechas, obtener eventos recientes (últimas 24 horas)
    if (!searchParams.get('start_date') && !searchParams.get('end_date')) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      backendParams.append('start_date', yesterday.toISOString().split('T')[0]);
    }

    // Consultar eventos del backend de conteo
    const conteo_backend_url = get_conteo_backend_url();
    const eventsUrl = `${conteo_backend_url}/api/events?${backendParams.toString()}`;  
    console.log('Consultando eventos del backend:', eventsUrl);

    const response = await fetch(eventsUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Error from conteo backend:', response.status, response.statusText);
      return NextResponse.json(
        {
          success: false,
          error: `Error del backend de conteo: ${response.status} ${response.statusText}`
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    const events = data.events || [];

    // Transformar eventos al formato del frontend
    const transitions = transformEventsToTransitions(events);

    return NextResponse.json({
      success: true,
      data: {
        events: transitions,
        total: data.count || transitions.length,
        filters: Object.fromEntries(searchParams.entries())
      }
    });
  } catch (error) {
    console.error('Error getting vehicle counting events from backend:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error conectando con el backend de conteo'
      },
      { status: 500 }
    );
  }
}