import { NextRequest, NextResponse } from 'next/server';

/**
 * Endpoint: /api/config/backend/services/[service]/[action]
 * Controla el backend de conteo (start, stop, restart)
 *
 * Implementación:
 * - Actualiza el campo enabled en la base de datos para el servicio indicado.
 * - Simula el estado (status) y responde con el nuevo estado y timestamp.
 * - En producción, se debe agregar lógica para controlar el proceso real y métricas.
 *
 * Ejemplo de respuesta:
 * {
 *   "message": "Servicio counting started exitosamente",
 *   "service": "counting",
 *   "action": "start",
 *   "status": "running",
 *   "enabled": true,
 *   "timestamp": "2025-10-07T12:00:00Z"
 * }
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ service: string; action: string }> }
) {
  try {
    // Await params para Next.js 15 compatibility
    const { service, action } = await params;

    // Validar servicio
    if (!['lpr', 'counting', 'notifications'].includes(service)) {
      return NextResponse.json(
        { error: 'Servicio no válido' },
        { status: 400 }
      );
    }

    // Validar acción
    if (!['start', 'stop', 'restart'].includes(action)) {
      return NextResponse.json(
        { error: 'Acción no válida' },
        { status: 400 }
      );
    }

    // Control real: actualizar campo enabled en la base de datos
    const ConfigDatabase = (await import('@/lib/config-database')).default;
    const db = new ConfigDatabase();
    const config = db.getBackendConfigByService(service);
    if (!config) {
      return NextResponse.json({ error: 'Servicio no encontrado' }, { status: 404 });
    }

    let enabled = !!config.enabled;
    if (action === 'start') enabled = true;
    if (action === 'stop') enabled = false;
    // restart: simplemente mantener enabled como está y actualizar timestamp

    db.updateBackendConfig(service, config.config, enabled);

    // Simular status (en producción, consultar proceso real)
    const status = enabled ? 'running' : 'stopped';

    // Documentación de implementación:
    // - Este endpoint actualiza el estado 'enabled' en la base de datos para el servicio indicado.
    // - El campo 'status' es simulado, en producción debe reflejar el estado real del proceso.
    // - El frontend puede usar este endpoint para iniciar, detener o reiniciar el backend de conteo.

    return NextResponse.json({
      message: `Servicio ${service} ${action}ed exitosamente`,
      service,
      action,
      status,
      enabled,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error controlando servicio:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}