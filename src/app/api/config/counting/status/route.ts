/**
 * API de estado de servicios del módulo de conteo
 * 
 * Proporciona información sobre el estado operacional del sistema de conteo,
 * similar al módulo LPR.
 * 
 * GET /api/config/counting/status - Estado de servicios de conteo
 */

import { NextRequest, NextResponse } from 'next/server';
import { CountingDatabase } from '@/lib/counting-database';

/**
 * Obtiene el estado operacional del servicio de conteo
 * @param {NextRequest} request - The incoming request
 * @returns {Promise<NextResponse>} Estado del servicio de conteo
 */
export async function GET(request: NextRequest) {
  try {
    const counting_db = new CountingDatabase();
    const config = counting_db.get_configuration();
    const stats = counting_db.get_stats();

    if (!config) {
      return NextResponse.json({
        services: {
          "Conteo de Objetos": {
            enabled: false,
            status: "not_configured",
            uptime: 0,
            counted: 0,
            memory_mb: 0,
            cpu_percent: 0,
            config: "{}"
          }
        }
      });
    }

    // Obtener cámaras configuradas según modo de operación
    let cameras: string[] = [];
    if (config.operation_mode === 'two_cameras') {
      cameras = [config.camera_in, config.camera_out].filter(Boolean) as string[];
    } else if (config.operation_mode === 'zones' && config.camera_zones) {
      cameras = [config.camera_zones];
    }

    // Simular métricas del servicio (en una implementación real, estos vendrían del servicio MQTT)
    const service_status = config.enabled ? "running" : "stopped";
    const uptime = config.enabled ? Math.floor((Date.now() - new Date(config.updated_at).getTime()) / 1000) : 0;

    const service_info = {
      "Conteo de Objetos": {
        enabled: config.enabled,
        status: service_status,
        uptime: uptime,
        counted: stats.total_events,
        events_today: stats.events_today,
        active_cameras: cameras.length,
        active_objects: Array.isArray(stats.active_objects) ? stats.active_objects.length : 0,
        memory_mb: 0, // TODO: Implementar métricas reales
        cpu_percent: 0, // TODO: Implementar métricas reales
        config: JSON.stringify({
          mqtt_host: config.mqtt_host,
          mqtt_port: config.mqtt_port,
          mqtt_topic: config.mqtt_topic,
          operation_mode: config.operation_mode,
          cameras: cameras,
          active_objects: JSON.parse(config.active_objects || '["car","person"]'),
          retention_days: config.retention_days,
          confidence_threshold: config.confidence_threshold
        })
      }
    };

    console.log('Counting service status:', {
      enabled: config.enabled,
      status: service_status,
      total_events: stats.total_events,
      events_today: stats.events_today,
      active_cameras: cameras.length
    });

    return NextResponse.json({
      services: service_info
    });

  } catch (error: any) {
    console.error('Error getting counting service status:', error);
    
    return NextResponse.json({
      services: {
        "Conteo de Objetos": {
          enabled: false,
          status: "error",
          uptime: 0,
          counted: 0,
          memory_mb: 0,
          cpu_percent: 0,
          config: "{}"
        }
      }
    }, { status: 500 });
  }
}