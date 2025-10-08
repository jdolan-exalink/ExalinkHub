/**
 * GET /api/conteo/state
 * Proporciona el estado actual del sistema de conteo, incluyendo áreas,
 * objetos configurados, estado de conexiones y métricas generales
 */

import { NextRequest, NextResponse } from 'next/server';
import { get_counting_database } from '@/lib/counting-database';

export async function GET(request: NextRequest) {
  try {
    const counting_db = get_counting_database();
    const config = counting_db.get_configuration();

    if (!config) {
      return NextResponse.json({
        error: 'No se encontró configuración del módulo de conteo'
      }, { status: 404 });
    }

    // Estado de objetos (mantener compatibilidad con UI existente)
    const objects = JSON.parse(config.objects);
    const active_objects = JSON.parse(config.active_objects);
    
    // Estadísticas del sistema
    const stats = counting_db.get_stats();
    
    // Estado de áreas
    const areas_status = counting_db.get_areas_current_status();
    
    // Obtener configuración actual de cámaras según modo de operación
    let cameras: string[] = [];
    if (config.operation_mode === 'two_cameras') {
      cameras = [config.camera_in, config.camera_out].filter(Boolean) as string[];
    } else if (config.operation_mode === 'zones' && config.camera_zones) {
      cameras = [config.camera_zones];
    }
    
    // Complementar con cámaras de puntos de acceso
    const access_point_cameras = counting_db.query_all_statement(`
      SELECT DISTINCT fuente_id 
      FROM access_points ap
      JOIN areas a ON ap.area_id = a.id
      WHERE ap.enabled = 1 AND a.enabled = 1
    `).map((row: any) => row.fuente_id);
    
    // Combinar y deduplicar cámaras
    const all_cameras = [...new Set([...cameras, ...access_point_cameras])];
    
    return NextResponse.json({
      // Compatibilidad con UI existente
      activos: active_objects,
      objetos: objects,
      
      // Nuevos datos del sistema de áreas
      system: {
        enabled: config.enabled,
        operation_mode: config.operation_mode,
        mqtt_host: config.mqtt_host,
        mqtt_port: config.mqtt_port,
        confidence_threshold: config.confidence_threshold,
        retention_days: config.retention_days
      },
      
      // Estadísticas
      stats: {
        total_events: stats.total_events,
        events_today: stats.events_today,
        active_areas: stats.active_areas,
        total_ocupacion: stats.total_ocupacion,
        active_cameras: all_cameras.length
      },
      
      // Estado de áreas
      areas: areas_status,
      
      // Cámaras configuradas
      cameras: all_cameras,
      
      // Metadata
      last_updated: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error in /api/conteo/state:', error);
    
    return NextResponse.json({
      error: 'Error interno del servidor'
    }, { status: 500 });
  }
}