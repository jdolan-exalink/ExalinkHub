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
// Prefer public override (useful for Docker/hosting): NEXT_PUBLIC_CONTEO_BASE_URL
const CONTEO_BACKEND_URL = process.env.NEXT_PUBLIC_CONTEO_BASE_URL || process.env.CONTEO_BACKEND_URL ||
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

    // Intentar consultar el backend de conteo real
    try {
      const response = await fetch(`${CONTEO_BACKEND_URL}/api/counters`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(5000), // Timeout de 5 segundos
      });

      if (response.ok) {
        const data = await response.json();
        const zones = transformCountersToZones(data.counters || []);
        const filteredZones = enabled_only ? zones.filter(zone => zone.enabled) : zones;

        return NextResponse.json({
          success: true,
          data: filteredZones
        });
      }
    } catch (backendError) {
      console.warn('Backend de conteo no disponible, usando datos de prueba:', backendError instanceof Error ? backendError.message : String(backendError));
    }

    // Fallback: datos de prueba cuando el backend no está disponible
    console.log('🔧 Usando datos de prueba para zonas de conteo vehicular');

    const mockZones = [
      {
        id: 1,
        camera_name: "Portones",
        zone_in: "Entrada",
        zone_out: "Salida",
        enabled: true,
        title: "Portones - Zona Principal",
        objects: ["car", "motorcycle", "truck"],
        type: "zones",
        current_count: 5,
        total_in: 23,
        total_out: 18
      },
      {
        id: 2,
        camera_name: "Estacionamiento",
        zone_in: "Acceso",
        zone_out: "Salida",
        enabled: true,
        title: "Estacionamiento - Zona Secundaria",
        objects: ["car", "motorcycle"],
        type: "zones",
        current_count: 3,
        total_in: 12,
        total_out: 9
      }
    ];

    const filteredZones = enabled_only ? mockZones.filter(zone => zone.enabled) : mockZones;

    return NextResponse.json({
      success: true,
      data: filteredZones,
      note: "Datos de prueba - Backend de conteo no disponible"
    });
  } catch (error) {
    console.error('Error getting vehicle counting zones:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error obteniendo zonas de conteo vehicular'
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