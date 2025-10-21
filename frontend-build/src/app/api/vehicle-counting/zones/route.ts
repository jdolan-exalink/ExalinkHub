/**
 * API para configuración de zonas de conteo vehicular
 * GET /api/vehicle-counting/zones - Obtener todas las configuraciones de zonas desde el backend de conteo
 * POST /api/vehicle-counting/zones - Crear nueva configuración de zona (legacy - ahora usa backend de conteo)
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * URL del backend de conteo
 * En Docker usa el nombre del servicio, localmente usa localhost
 */
const CONTEO_BACKEND_URL = process.env.CONTEO_BACKEND_URL || 
  (process.env.NODE_ENV === 'production' ? 'http://conteo-backend:8000' : 'http://localhost:2223');

/**
 * Transforma la respuesta del backend de conteo al formato esperado por el frontend
 */
function transformCountersToZones(counters: any[]): any[] {
  return counters.map(counter => {
    // Buscar la configuración de cámara correspondiente
    const cameraConfig = counter.config || {};

    return {
      id: counter.id,
      camera_name: counter.source_camera,
      zone_in: cameraConfig.zone_in || 'IN',
      zone_out: cameraConfig.zone_out || 'OUT',
      enabled: true, // Los contadores activos se consideran habilitados
      title: `${counter.source_camera} - ${counter.id}`,
      objects: counter.objects || [],
      type: counter.type || 'zones',
      current_count: counter.totals?.occupancy || 0,
      total_in: counter.totals?.in || 0,
      total_out: counter.totals?.out || 0
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const enabled_only = searchParams.get('enabled') === 'true';

    // Consultar el backend de conteo
    const response = await fetch(`${CONTEO_BACKEND_URL}/api/counters`, {
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

    // Transformar la respuesta al formato esperado por el frontend
    const zones = transformCountersToZones(data.counters || []);

    // Si se solicita solo habilitadas, filtrar (por ahora todos están habilitados)
    const filteredZones = enabled_only ? zones.filter(zone => zone.enabled) : zones;

    return NextResponse.json({
      success: true,
      data: filteredZones
    });
  } catch (error) {
    console.error('Error getting vehicle counting zones from backend:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error conectando con el backend de conteo'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Este endpoint ahora es legacy - las zonas se configuran en el backend de conteo
  return NextResponse.json(
    {
      success: false,
      error: 'Las configuraciones de zonas ahora se gestionan en el backend de conteo. Use la configuración del servidor de conteo.'
    },
    { status: 410 } // Gone
  );
}