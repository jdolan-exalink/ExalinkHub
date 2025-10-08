/**
 * API para estadísticas de conteo vehicular
 * GET /api/vehicle-counting/stats - Obtener estadísticas actuales y históricas
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVehicleCountingDatabase } from '@/lib/vehicle-counting-database';

const db = getVehicleCountingDatabase();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const camera_name = searchParams.get('camera');
    const zone_config_id = searchParams.get('zone_id');
    const period = searchParams.get('period') || 'today';
    const group_by = searchParams.get('group_by') as 'hour' | 'day' | 'week' | 'month' || 'day';

    // Calcular fechas basadas en el período
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
      case 'year':
        start_date.setFullYear(start_date.getFullYear() - 1);
        break;
      default:
        start_date.setHours(0, 0, 0, 0);
    }

    // Obtener estadísticas actuales
    let current_stats = {};
    if (camera_name) {
      const zone_id = zone_config_id ? parseInt(zone_config_id) : undefined;
      current_stats = db.get_current_count(camera_name, zone_id);
    }

    // Obtener estadísticas históricas
    const historical_stats = db.get_historical_stats(
      start_date.toISOString(),
      end_date.toISOString(),
      camera_name || undefined,
      group_by
    );

    // Obtener configuraciones de zonas para contexto
    const zones = db.get_enabled_zone_configs();

    return NextResponse.json({
      success: true,
      data: {
        current: current_stats,
        historical: historical_stats,
        zones: zones,
        period: {
          start: start_date.toISOString(),
          end: end_date.toISOString(),
          period_name: period,
          group_by: group_by
        }
      }
    });
  } catch (error) {
    console.error('Error getting vehicle counting stats:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error obteniendo estadísticas de conteo vehicular' 
      },
      { status: 500 }
    );
  }
}