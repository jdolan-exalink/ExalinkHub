/**
 * API para eventos de transición vehicular
 * GET /api/vehicle-counting/events - Obtener eventos de transición
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVehicleCountingDatabase } from '@/lib/vehicle-counting-database';

const db = getVehicleCountingDatabase();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters = {
      camera_name: searchParams.get('camera') || undefined,
      zone_config_id: searchParams.get('zone_id') ? parseInt(searchParams.get('zone_id')!) : undefined,
      transition_type: (searchParams.get('type') as 'in' | 'out') || undefined,
      start_date: searchParams.get('start_date') || undefined,
      end_date: searchParams.get('end_date') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 100
    };

    // Si no se especifican fechas, obtener eventos del día actual
    if (!filters.start_date && !filters.end_date) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filters.start_date = today.toISOString();
      
      const end_of_day = new Date();
      end_of_day.setHours(23, 59, 59, 999);
      filters.end_date = end_of_day.toISOString();
    }

    const events = db.get_transition_events(filters);

    return NextResponse.json({
      success: true,
      data: {
        events: events,
        filters: filters,
        total: events.length
      }
    });
  } catch (error) {
    console.error('Error getting vehicle counting events:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error obteniendo eventos de transición vehicular' 
      },
      { status: 500 }
    );
  }
}