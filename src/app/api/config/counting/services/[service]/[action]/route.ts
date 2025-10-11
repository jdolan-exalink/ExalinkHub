/**
 * API de control de servicios del módulo de conteo
 * 
 * Permite iniciar, detener y reiniciar el servicio de conteo de objetos
 * siguiendo la misma estructura que el módulo LPR.
 * 
 * POST /api/config/counting/services/counting/[action] - Controlar servicio de conteo
 */

import { NextRequest, NextResponse } from 'next/server';
import { get_counting_database } from '@/lib/counting-database';

/**
 * Controla el servicio de conteo (start, stop, restart)
 * @param {NextRequest} request - The incoming request
 * @returns {Promise<NextResponse>} Resultado de la operación
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ service: string; action: string }> }
) {
  try {
    const { service, action } = await context.params;
    
    console.log('Counting service control request:', {
      service,
      action,
      timestamp: new Date().toISOString()
    });

    // Validar servicio
    if (service !== 'counting') {
      return NextResponse.json({
        success: false,
        error: `Servicio no válido: ${service}. Use 'counting'`
      }, { status: 400 });
    }

    // Validar acción
    const valid_actions = ['start', 'stop', 'restart'];
    if (!valid_actions.includes(action)) {
      return NextResponse.json({
        success: false,
        error: `Acción no válida: ${action}. Acciones válidas: ${valid_actions.join(', ')}`
      }, { status: 400 });
    }

    const counting_db = get_counting_database();
    const config = counting_db.get_configuration();

    if (!config) {
      return NextResponse.json({
        success: false,
        error: 'No se encontró configuración del módulo de conteo'
      }, { status: 404 });
    }

    // Simular control del servicio
    let new_status: boolean;
    let message: string;

    switch (action) {
      case 'start':
        if (config.enabled) {
          return NextResponse.json({
            success: false,
            error: 'El servicio de conteo ya está ejecutándose'
          }, { status: 400 });
        }
        new_status = true;
        message = 'Servicio de conteo iniciado correctamente';
        break;

      case 'stop':
        if (!config.enabled) {
          return NextResponse.json({
            success: false,
            error: 'El servicio de conteo ya está detenido'
          }, { status: 400 });
        }
        new_status = false;
        message = 'Servicio de conteo detenido correctamente';
        break;

      case 'restart':
        new_status = true;
        message = 'Servicio de conteo reiniciado correctamente';
        break;

      default:
        throw new Error(`Acción no implementada: ${action}`);
    }

    // Actualizar estado en la base de datos
    const success = counting_db.update_configuration({
      enabled: new_status
    });

    if (!success) {
      throw new Error('No se pudo actualizar el estado del servicio');
    }

    // Obtener configuración actualizada
    const updated_config = counting_db.get_configuration();
    const stats = counting_db.get_stats();

    if (!updated_config) {
      throw new Error('No se pudo obtener configuración actualizada');
    }

    const service_state = {
      enabled: updated_config.enabled,
      status: updated_config.enabled ? "running" : "stopped",
      uptime: updated_config.enabled ? Math.floor((Date.now() - new Date(updated_config.updated_at).getTime()) / 1000) : 0,
      counted: stats.total_events,
      events_today: stats.events_today,
      active_cameras: stats.active_cameras,
      active_objects: Array.isArray(stats.active_objects) ? stats.active_objects.length : 0,
      memory_mb: 0,
      cpu_percent: 0
    };

    console.log('Counting service control completed:', {
      action,
      new_status,
      service_state
    });

    return NextResponse.json({
      success: true,
      message,
      service_state
    });

  } catch (error: any) {
    console.error('Error controlling counting service:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Error interno al controlar servicio de conteo'
    }, { status: 500 });
  }
}