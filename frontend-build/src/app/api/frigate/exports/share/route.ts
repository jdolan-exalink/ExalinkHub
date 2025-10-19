import { NextRequest, NextResponse } from 'next/server';
import { create_share_token } from '@/lib/export-tokens';
import { resolve_frigate_server } from '@/lib/frigate-servers';
import { create_frigate_api } from '@/lib/frigate-api';

/**
 * POST /api/frigate/exports/share
 * 
 * Genera un token temporal para compartir un export públicamente
 * 
 * Body: {
 *   server_id: string,
 *   export_id: string,
 *   duration_hours?: number,  // Por defecto 24 horas
 *   max_downloads?: number     // Límite de descargas (opcional)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { server_id, export_id, duration_hours = 24, max_downloads } = body;

    // Validaciones
    if (!server_id) {
      return NextResponse.json(
        { success: false, error: 'El parámetro "server_id" es requerido' },
        { status: 400 }
      );
    }

    if (!export_id) {
      return NextResponse.json(
        { success: false, error: 'El parámetro "export_id" es requerido' },
        { status: 400 }
      );
    }

    // Verificar que el servidor existe
    const target_server = resolve_frigate_server(server_id);

    if (!target_server) {
      return NextResponse.json(
        { success: false, error: 'Servidor Frigate no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que el export existe
    try {
      const frigate_api = create_frigate_api(target_server);
      const export_status = await frigate_api.getExportStatus(export_id);
      
      if (!export_status) {
        return NextResponse.json(
          { success: false, error: 'Export no encontrado en el servidor' },
          { status: 404 }
        );
      }
    } catch (error) {
      console.error('Error verificando export:', error);
      return NextResponse.json(
        { success: false, error: 'No se pudo verificar el export en el servidor' },
        { status: 500 }
      );
    }

    // Generar token
    const duration_ms = duration_hours * 60 * 60 * 1000;
    const token = create_share_token(server_id, export_id, duration_ms, max_downloads);

    // Construir URL pública de descarga
    const base_url = request.nextUrl.origin;
    const share_url = `${base_url}/api/frigate/exports/download/${token}`;

    return NextResponse.json({
      success: true,
      token,
      share_url,
      expires_in_hours: duration_hours,
      max_downloads,
      server_id,
      export_id,
    });

  } catch (error) {
    console.error('Error en POST /api/frigate/exports/share:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al generar token de compartir',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
