import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint: /api/config/backend/services/[service]/auto-start
 * Actualiza la configuración de auto-start para un servicio
 *
 * Implementación:
 * - Actualiza el campo auto_start en la base de datos
 * - Configura la política de restart del contenedor Docker
 * - Devuelve el nuevo estado de auto_start
 *
 * Ejemplo de respuesta:
 * {
 *   "message": "Auto-start actualizado exitosamente",
 *   "service": "lpr",
 *   "auto_start": true,
 *   "timestamp": "2025-10-08T14:00:00Z"
 * }
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  try {
    const { service } = await params;

    // Validar servicio
    if (!['lpr', 'counting', 'notifications'].includes(service)) {
      return NextResponse.json(
        { error: 'Servicio no válido' },
        { status: 400 }
      );
    }

    // Obtener configuración actual
    const ConfigDatabase = (await import('@/lib/config-database')).default;
    const db = new ConfigDatabase();
    const config = db.getBackendConfigByService(service);

    if (!config) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      service,
      auto_start: !!config.auto_start,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error obteniendo auto-start:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  try {
    const { service } = await params;

    // Validar servicio
    if (!['lpr', 'counting', 'notifications'].includes(service)) {
      return NextResponse.json(
        { error: 'Servicio no válido' },
        { status: 400 }
      );
    }

    // Obtener el valor de auto_start del body
    const body = await request.json();
    const { auto_start } = body;

    if (typeof auto_start !== 'boolean') {
      return NextResponse.json(
        { error: 'auto_start debe ser un boolean' },
        { status: 400 }
      );
    }

    // Actualizar configuración en la base de datos
    const ConfigDatabase = (await import('@/lib/config-database')).default;
    const db = new ConfigDatabase();

    const success = db.updateBackendAutoStart(service, auto_start);

    if (!success) {
      return NextResponse.json(
        { error: 'Error actualizando auto_start' },
        { status: 500 }
      );
    }

    // Configurar política de restart del contenedor Docker
    try {
      const { setContainerRestartPolicy } = await import('@/lib/docker-utils');
      const success = await setContainerRestartPolicy(service, auto_start);
      if (!success) {
        console.warn(`Failed to update Docker restart policy for ${service}`);
      }
    } catch (dockerError) {
      console.warn(`Could not update Docker restart policy for ${service}:`, dockerError);
      // No fallar si Docker no está disponible
    }

    return NextResponse.json({
      message: 'Auto-start actualizado exitosamente',
      service,
      auto_start,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error actualizando auto-start:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}