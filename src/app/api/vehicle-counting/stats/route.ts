/**
 * API para estadísticas de conteo vehicular
 * GET /api/vehicle-counting/stats - Obtener estadísticas desde el backend de conteo
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * URL del backend de conteo
 */
const CONTEO_BACKEND_URL = process.env.CONTEO_BACKEND_URL || 'http://localhost:2223';

/**
 * Transforma los datos del backend de conteo al formato esperado por el frontend
 */
function transformCountersToStats(counters: any[], period: string) {
  const stats = {
    total_in: 0,
    total_out: 0,
    current_count: 0,
    by_type: {} as Record<string, { in: number; out: number }>
  };

  // Procesar cada contador
  counters.forEach(counter => {
    const totals = counter.totals || {};
    stats.total_in += totals.in || 0;
    stats.total_out += totals.out || 0;
    stats.current_count += totals.occupancy || 0;

    // Procesar por tipo de objeto
    (counter.objects || []).forEach((obj: string) => {
      if (!stats.by_type[obj]) {
        stats.by_type[obj] = { in: 0, out: 0 };
      }
      // Nota: El backend actual no separa por tipo, así que distribuimos proporcionalmente
      // En una implementación completa, el backend debería proporcionar estadísticas por tipo
      const total = (totals.in || 0) + (totals.out || 0);
      if (total > 0) {
        stats.by_type[obj].in += Math.round((totals.in || 0) / counter.objects.length);
        stats.by_type[obj].out += Math.round((totals.out || 0) / counter.objects.length);
      }
    });
  });

  return stats;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const camera_name = searchParams.get('camera');
    const zone_config_id = searchParams.get('zone_id');
    const period = searchParams.get('period') || 'today';

    // Consultar contadores del backend de conteo
    const countersResponse = await fetch(`${CONTEO_BACKEND_URL}/api/counters`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!countersResponse.ok) {
      console.error('Error from conteo backend:', countersResponse.status, countersResponse.statusText);
      return NextResponse.json(
        {
          success: false,
          error: `Error del backend de conteo: ${countersResponse.status} ${countersResponse.statusText}`
        },
        { status: countersResponse.status }
      );
    }

    const countersData = await countersResponse.json();
    const counters = countersData.counters || [];

    // Filtrar por cámara si se especifica
    let filteredCounters = counters;
    if (camera_name) {
      filteredCounters = counters.filter((c: any) => c.source_camera === camera_name);
    }

    // Transformar a estadísticas
    const currentStats = transformCountersToStats(filteredCounters, period);

    // Calcular fechas del período para histórico (aunque por ahora no lo usamos)
    const end_date = new Date();
    const start_date = new Date();

    switch (period) {
      case 'today':
        start_date.setHours(0, 0, 0, 0);
        break;
      case 'yesterday':
        start_date.setDate(start_date.getDate() - 1);
        start_date.setHours(0, 0, 0, 0);
        end_date.setDate(end_date.getDate() - 1);
        end_date.setHours(23, 59, 59, 999);
        break;
      case 'week':
        start_date.setDate(start_date.getDate() - 7);
        break;
      case 'month':
        start_date.setMonth(start_date.getMonth() - 1);
        break;
      default:
        start_date.setHours(0, 0, 0, 0);
    }

    return NextResponse.json({
      success: true,
      data: {
        current: currentStats,
        historical: [], // TODO: Implementar histórico desde /api/counters/{id}/history
        period: {
          start: start_date.toISOString(),
          end: end_date.toISOString(),
          period_name: period
        }
      }
    });
  } catch (error) {
    console.error('Error getting vehicle counting stats from backend:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error conectando con el backend de conteo'
      },
      { status: 500 }
    );
  }
}