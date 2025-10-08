/**
 * API para configuración de zonas de conteo vehicular
 * GET /api/vehicle-counting/zones - Obtener todas las configuraciones de zonas
 * POST /api/vehicle-counting/zones - Crear nueva configuración de zona
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVehicleCountingDatabase } from '@/lib/vehicle-counting-database';

const db = getVehicleCountingDatabase();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const enabled_only = searchParams.get('enabled') === 'true';

    let zones;
    if (enabled_only) {
      zones = db.get_enabled_zone_configs();
    } else {
      zones = db.get_all_zone_configs();
    }

    return NextResponse.json({
      success: true,
      data: zones
    });
  } catch (error) {
    console.error('Error getting vehicle counting zones:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error obteniendo configuraciones de zonas vehiculares' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { camera_name, zone_in, zone_out, title } = body;

    // Validar datos requeridos
    if (!camera_name || !zone_in || !zone_out || !title) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Campos requeridos: camera_name, zone_in, zone_out, title' 
        },
        { status: 400 }
      );
    }

    const zone_id = db.create_zone_config(camera_name, zone_in, zone_out, title);

    if (zone_id) {
      const created_zone = db.get_zone_config(zone_id);
      return NextResponse.json({
        success: true,
        data: created_zone
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Error creando configuración de zona vehicular' 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error creating vehicle counting zone:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error creando configuración de zona vehicular' 
      },
      { status: 500 }
    );
  }
}