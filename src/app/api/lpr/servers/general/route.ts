import { NextRequest, NextResponse } from 'next/server';
import { getLPRServersManager } from '@/lib/lpr-servers';

/**
 * @api {get} /api/lpr/servers/general Obtener configuración general LPR
 * @apiDescription Devuelve la configuración general del archivo matriculas.conf.
 */
export async function GET() {
  try {
    const manager = getLPRServersManager();
    const general = manager.getGeneralConfig();

    return NextResponse.json({
      general,
      success: true
    });
  } catch (error) {
    console.error('Error al leer configuración general LPR:', error);
    return NextResponse.json({
      error: 'No se pudo leer la configuración general',
      success: false
    }, { status: 500 });
  }
}

/**
 * @api {put} /api/lpr/servers/general Actualizar configuración general LPR
 * @apiDescription Actualiza la configuración general en el archivo matriculas.conf.
 * @apiBody {number} [http_port=2221] - Puerto HTTP del servicio
 * @apiBody {number} [retention_days=30] - Días de retención de medios
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const manager = getLPRServersManager();

    manager.updateGeneralConfig({
      http_port: body.http_port ?? 2221,
      retention_days: body.retention_days ?? 30
    });

    return NextResponse.json({
      success: true,
      message: 'Configuración general actualizada correctamente'
    });
  } catch (error) {
    console.error('Error al actualizar configuración general LPR:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'No se pudo actualizar la configuración',
      success: false
    }, { status: 500 });
  }
}