import { NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';
import { FRIGATE_SERVERS } from '@/lib/frigate-servers';
/**
 * Obtiene el estado de conectividad de MQTT
 * @returns Promise<'online'|'offline'|'not_configured'>
 */
async function get_mqtt_status(): Promise<'online'|'offline'|'not_configured'> {
  try {
    const config_db = getConfigDatabase();
    const backend_config = config_db.getConsolidatedBackendConfig();
    if (!backend_config.lpr_mqtt_host || !backend_config.lpr_mqtt_port) {
      return 'not_configured';
    }
    const mqtt = require('mqtt');
    return await new Promise((resolve) => {
      const client = mqtt.connect({
        host: backend_config.lpr_mqtt_host,
        port: backend_config.lpr_mqtt_port,
        connectTimeout: 3000
      });
      client.on('connect', () => {
        client.end();
        resolve('online');
      });
      client.on('error', () => {
        client.end();
        resolve('offline');
      });
    });
  } catch {
    return 'offline';
  }
}

/**
 * Verifica el estado de conectividad de Frigate
 * @returns Promise<'online'|'offline'|'not_configured'|'disabled'|'invalid'>
 */
async function get_frigate_status(): Promise<'online'|'offline'|'not_configured'|'disabled'|'invalid'> {
  try {
    const config_db = getConfigDatabase();
    const backend_config = config_db.getConsolidatedBackendConfig();
    if (!backend_config.lpr_frigate_server_id) {
      return 'not_configured';
    }
    const server = FRIGATE_SERVERS.find(s => s.id === backend_config.lpr_frigate_server_id);
    if (!server) return 'invalid';
    if (!server.enabled) return 'disabled';
    try {
      const response = await fetch(`${server.baseUrl}/version`, { method: 'GET', signal: AbortSignal.timeout(3000) });
      if (response.ok) return 'online';
      return 'offline';
    } catch {
      return 'offline';
    }
  } catch {
    return 'offline';
  }
}

export async function GET() {
  /**
   * Endpoint GET /api/config/backend/status
   * 
   * Devuelve el estado operacional completo de todos los servicios backend.
   * Incluye estado enabled desde base de datos y métricas operacionales cacheadas.
   * 
   * Implementación:
   * 1. Consulta configuración de servicios desde base de datos SQLite
   * 2. Obtiene métricas operacionales cacheadas desde /api/config/backend/metrics
   * 3. Mapea respuesta con campos operacionales por servicio
   * 4. Retorna JSON con estructura { services: { [service_name]: status_data } }
   * 
   * Campos por servicio:
   * - enabled: boolean (desde DB)
   * - status: 'running'|'stopped'|'error'
   * - uptime: number (segundos)
   * - processed: number (eventos procesados)
   * - memory_mb: number
   * - cpu_percent: number
   * - config: string (JSON de configuración)
   * 
   * Servicios soportados: LPR, Conteo, Notificaciones
   * 
   * @returns NextResponse con estado de servicios o error 500
   */
  try {
    // Consulta real del estado de los servicios desde la base de datos
    const ConfigDatabase = (await import('@/lib/config-database')).default;
    const db = new ConfigDatabase();
    const configs = db.getAllBackendConfigs();

    // Obtener métricas operacionales cacheadas
    let dockerMetrics: {
      counting: {
        status: 'running' | 'stopped' | 'error';
        uptime: number;
        memory_mb: number;
        cpu_percent: number;
      };
      lpr: {
        status: 'running' | 'stopped' | 'error';
        uptime: number;
        memory_mb: number;
        cpu_percent: number;
      };
    } = {
      counting: { status: 'stopped' as const, uptime: 0, memory_mb: 0, cpu_percent: 0 },
      lpr: { status: 'stopped' as const, uptime: 0, memory_mb: 0, cpu_percent: 0 }
    };

    try {
      const metricsResponse = await fetch(`http://localhost:9002/api/config/backend/metrics`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        dockerMetrics = metricsData.metrics;
      }
    } catch (metricsError) {
      console.warn('Error obteniendo métricas cacheadas, usando valores por defecto:', metricsError);
    }

    // Obtener estado de MQTT y Frigate
    const mqtt_status = await get_mqtt_status();
    const frigate_status = await get_frigate_status();

    // Mapear estado de cada servicio con campos operacionales
    const services: Record<string, any> = {};
    // Servicios por defecto que siempre deben existir
    const defaultServices = [
      { service_name: 'LPR (Matrículas)', enabled: true, config: '{}', id: 0, created_at: '', updated_at: '' },
      { service_name: 'Conteo de Personas', enabled: false, config: '{}', id: 0, created_at: '', updated_at: '' },
      { service_name: 'Notificaciones', enabled: false, config: '{}', id: 0, created_at: '', updated_at: '' }
    ];
    // Combinar servicios de DB con servicios por defecto
    const allServices = [...configs];
    defaultServices.forEach(defaultService => {
      if (!configs.find(c => c.service_name === defaultService.service_name)) {
        allServices.push(defaultService);
      }
    });
    allServices.forEach((cfg: any) => {
      const status = !!cfg.enabled ? 'running' : 'stopped';
      let extra: Record<string, any> = {};
      if (cfg.service_name === 'LPR (Matrículas)') {
        extra = { processed: 0, memory_mb: 0, cpu_percent: 0, mqtt_status, frigate_status };
      } else if (cfg.service_name === 'Conteo de Personas' || cfg.service_name === 'Conteo') {
        extra = { processed: 0, memory_mb: 0, cpu_percent: 0 };
      } else if (cfg.service_name === 'Notificaciones') {
        extra = { sent: 0, memory_mb: 0, cpu_percent: 0 };
      }
      const service_key = cfg.service_name === 'Conteo de Personas' ? 'Conteo' : cfg.service_name;
      services[service_key] = {
        enabled: !!cfg.enabled,
        config: cfg.config || '{}',
        status,
        uptime: status === 'running' ? 3600 : 0,
        ...extra
      };
    });

    // Agregar el servicio de conteo de objetos con estado real del Docker
    // Obtener métricas de DB de conteo
    try {
      const { get_counting_database } = await import('@/lib/counting-database');
      const cdb = get_counting_database();
      const stats = cdb.get_stats();
      services['Conteo'] = {
        enabled: dockerMetrics.counting.status === 'running',
        config: '{}',
        status: dockerMetrics.counting.status,
        uptime: dockerMetrics.counting.uptime,
        processed: stats.total_events || 0,
        memory_mb: dockerMetrics.counting.memory_mb,
        cpu_percent: dockerMetrics.counting.cpu_percent,
        active_cameras: stats.active_cameras,
        active_objects: stats.active_objects
      };
    } catch (e) {
      services['Conteo'] = {
        enabled: dockerMetrics.counting.status === 'running',
        config: '{}',
        status: dockerMetrics.counting.status,
        uptime: dockerMetrics.counting.uptime,
        processed: 0,
        memory_mb: dockerMetrics.counting.memory_mb,
        cpu_percent: dockerMetrics.counting.cpu_percent
      };
    }

    // Actualizar el servicio LPR con estado real del Docker y estadísticas de DB
    try {
      const { getLPRDatabase } = await import('@/lib/lpr-database');
      const lpr_db = getLPRDatabase();
      const lpr_stats = lpr_db.getStats();
      services['LPR (Matrículas)'] = {
        enabled: dockerMetrics.lpr.status === 'running',
        config: services['LPR (Matrículas)']?.config || '{}',
        status: dockerMetrics.lpr.status,
        uptime: dockerMetrics.lpr.uptime,
        processed: lpr_stats.total_readings || 0,
        memory_mb: dockerMetrics.lpr.memory_mb,
        cpu_percent: dockerMetrics.lpr.cpu_percent,
        cameras_active: lpr_stats.cameras_active,
        unique_plates: lpr_stats.unique_plates
      };
    } catch (e) {
      services['LPR (Matrículas)'] = {
        enabled: dockerMetrics.lpr.status === 'running',
        config: services['LPR (Matrículas)']?.config || '{}',
        status: dockerMetrics.lpr.status,
        uptime: dockerMetrics.lpr.uptime,
        processed: 0,
        memory_mb: dockerMetrics.lpr.memory_mb,
        cpu_percent: dockerMetrics.lpr.cpu_percent
      };
    }

    return NextResponse.json({ services });
  } catch (error) {
    console.error('Error obteniendo estado de servicios:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}