/**
 * API de configuración del módulo de conteo de objetos
 * 
 * Proporciona endpoints para gestionar la configuración general del sistema de conteo,
 * con soporte para los nuevos modos de operación y selección de objetos.
 * 
 * GET /api/config/counting - Obtener configuración actual
 * POST /api/config/counting - Guardar configuración
 */

import { NextRequest, NextResponse } from 'next/server';
import { CountingDatabase, type counting_configuration } from '@/lib/counting-database';

/**
 * Obtiene la configuración actual del módulo de conteo
 */
export async function GET(request: NextRequest) {
  try {
    const counting_db = new CountingDatabase();
    const config = counting_db.get_configuration();

    if (!config) {
      // Crear configuración por defecto si no existe
      const default_config = {
        enabled: false,
        operation_mode: 'two_cameras' as const,
        title: 'Sistema de Conteo',
        objects: ['car', 'person'],
        retention_days: 30,
        confidence_threshold: 0.7,
        notifications_enabled: false,
        config_json: '{}'
      };

      return NextResponse.json({
        success: true,
        config: default_config
      });
    }

    // Parsear JSON strings para envío al frontend
    const parsed_config = {
      enabled: !!config.enabled,
      operation_mode: config.operation_mode || 'two_cameras',
      title: 'Sistema de Conteo de Objetos',
      camera_in: config.camera_in || '',
      camera_out: config.camera_out || '',
      camera_zones: config.camera_zones || '',
      zone_in: config.zone_in || '',
      zone_out: config.zone_out || '',
      objects: JSON.parse(config.objects || '["car","person"]'),
      retention_days: config.retention_days || 30,
      confidence_threshold: config.confidence_threshold || 0.7,
      notifications_enabled: !!config.notifications_enabled,
      notification_email: config.notification_email || '',
      config_json: config.config_json || '{}'
    };

    console.log('Counting configuration retrieved:', {
      id: config.id,
      enabled: parsed_config.enabled,
      operation_mode: parsed_config.operation_mode,
      objects_count: parsed_config.objects.length
    });

    return NextResponse.json({
      success: true,
      config: parsed_config
    });

  } catch (error: any) {
    console.error('Error retrieving counting configuration:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error interno al obtener configuración del conteo'
    }, { status: 500 });
  }
}

/**
 * Actualiza la configuración del módulo de conteo
 */
export async function POST(request: NextRequest) {
  try {
    const request_data = await request.json();
    
    console.log('Updating counting configuration:', request_data);

    const counting_db = new CountingDatabase();

    // Preparar datos para actualización usando la nueva estructura
    const update_data: Partial<counting_configuration> = {};

    // Configuración general
    if (request_data.config) {
      const config = request_data.config;
      
      update_data.enabled = !!config.enabled;
      update_data.operation_mode = config.operation_mode || 'two_cameras';
      
      // Configuración por modo de operación
      if (config.operation_mode === 'two_cameras') {
        update_data.camera_in = config.camera_in || undefined;
        update_data.camera_out = config.camera_out || undefined;
        update_data.camera_zones = undefined;
        update_data.zone_in = undefined;
        update_data.zone_out = undefined;
      } else if (config.operation_mode === 'zones') {
        update_data.camera_zones = config.camera_zones || undefined;
        update_data.zone_in = config.zone_in || undefined;
        update_data.zone_out = config.zone_out || undefined;
        update_data.camera_in = undefined;
        update_data.camera_out = undefined;
      }
      
      // Configuración de objetos
      if (Array.isArray(config.objects)) {
        update_data.objects = JSON.stringify(config.objects);
        update_data.active_objects = JSON.stringify(config.objects); // Los mismos objetos están activos
      }
      
      // Configuración de detección
      if (typeof config.confidence_threshold === 'number') {
        update_data.confidence_threshold = config.confidence_threshold;
      }
      
      if (typeof config.retention_days === 'number') {
        update_data.retention_days = config.retention_days;
      }
      
      // Configuración de notificaciones
      update_data.notifications_enabled = !!config.notifications_enabled;
      if (config.notification_email) {
        update_data.notification_email = config.notification_email;
      }
      
      // Configuración JSON adicional
      if (config.config_json) {
        update_data.config_json = config.config_json;
      }
    }

    // Configuración MQTT (backward compatibility)
    if (request_data.counting_mqtt_host !== undefined) {
      update_data.mqtt_host = request_data.counting_mqtt_host;
    }
    if (request_data.counting_mqtt_port !== undefined) {
      update_data.mqtt_port = parseInt(request_data.counting_mqtt_port.toString()) || 1883;
    }

    // Aplicar actualización
    const success = counting_db.update_configuration(update_data);
    
    if (!success) {
      return NextResponse.json({
        success: false,
        error: 'Error al actualizar configuración en la base de datos'
      }, { status: 500 });
    }

    // Obtener configuración actualizada
    const updated_config = counting_db.get_configuration();
    
    console.log('Counting configuration updated successfully');
    
    return NextResponse.json({
      success: true,
      message: 'Configuración de conteo actualizada correctamente',
      config: updated_config
    });

  } catch (error: any) {
    console.error('Error updating counting configuration:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Error interno al actualizar configuración del conteo'
    }, { status: 500 });
  }
}