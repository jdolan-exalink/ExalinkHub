import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getConfigDatabase } from '@/lib/config-database';
import { FRIGATE_SERVERS } from '@/lib/frigate-servers';

const execAsync = promisify(exec);
/**
 * Verifica el estado de conectividad de MQTT
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

/**
 * Obtiene el estado real del servicio Docker de conteo
 *
 * Esta función consulta el estado del contenedor Docker 'counting-backend'.
 * Obtiene métricas reales de memoria, CPU y uptime usando comandos Docker.
 *
 * Retorna métricas operacionales del servicio incluyendo:
 * - Estado (running/stopped/error)
 * - Tiempo de actividad (uptime en segundos)
 * - Uso de memoria en MB
 * - Uso de CPU en porcentaje
 *
 * @returns Promise con objeto de estado del servicio
 */
async function get_counting_service_status(): Promise<{
  status: 'running' | 'stopped' | 'error';
  uptime: number;
  memory_mb: number;
  cpu_percent: number;
}> {
  try {
    const container_name = 'conteo-backend';

    // Verificar si el contenedor existe y está corriendo
    const { stdout: ps_output } = await execAsync(
      `docker ps --filter "name=${container_name}" --format "{{.Status}}"`
    );

    if (!ps_output.trim()) {
      // Contenedor no está corriendo
      return {
        status: 'stopped',
        uptime: 0,
        memory_mb: 0,
        cpu_percent: 0
      };
    }

    // Obtener métricas usando docker stats (una sola ejecución)
    const { stdout: stats_output } = await execAsync(
      `docker stats ${container_name} --no-stream --format "{{.Container}}|{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}|{{.BlockIO}}"`
    );

    let memory_mb = 0;
    let cpu_percent = 0;

    if (stats_output.trim()) {
      const stats_line = stats_output.trim();
      const parts = stats_line.split('|');

      if (parts.length >= 3) {
        // Parsear CPU (ej: "12.19%")
        const cpu_str = parts[1].trim();
        if (cpu_str.endsWith('%')) {
          cpu_percent = parseFloat(cpu_str.slice(0, -1)) || 0;
        }

        // Parsear memoria (ej: "41.45MiB / 30.18GiB")
        const mem_str = parts[2].trim();
        const mem_parts = mem_str.split('/');
        if (mem_parts.length > 0) {
          const used_mem = mem_parts[0].trim();
          if (used_mem.includes('MiB')) {
            memory_mb = parseFloat(used_mem.replace('MiB', '')) || 0;
          } else if (used_mem.includes('GiB')) {
            memory_mb = (parseFloat(used_mem.replace('GiB', '')) || 0) * 1024;
          } else if (used_mem.includes('B')) {
            memory_mb = (parseFloat(used_mem.replace('B', '')) || 0) / (1024 * 1024);
          }
        }
      }
    }

    // Obtener uptime usando docker inspect
    let uptime = 0;
    try {
      const { stdout: inspect_output } = await execAsync(
        `docker inspect ${container_name} --format "{{.State.StartedAt}}"`
      );

      if (inspect_output.trim()) {
        const started_at = new Date(inspect_output.trim());
        const now = new Date();
        uptime = Math.floor((now.getTime() - started_at.getTime()) / 1000); // en segundos
      }
    } catch (inspect_error) {
      console.warn('Error obteniendo uptime del contenedor:', inspect_error);
    }

    return {
      status: 'running',
      uptime,
      memory_mb: Math.round(memory_mb * 100) / 100, // Redondear a 2 decimales
      cpu_percent: Math.round(cpu_percent * 100) / 100
    };

  } catch (error) {
    console.error('Error checking counting service status:', error);
    return {
      status: 'error',
      uptime: 0,
      memory_mb: 0,
      cpu_percent: 0
    };
  }
}

/**
 * Obtiene el estado real del servicio Docker de LPR
 *
 * Esta función consulta el estado del contenedor Docker 'exalink-lpr-backend'.
 * Obtiene métricas reales de memoria, CPU y uptime usando comandos Docker.
 *
 * Retorna métricas operacionales del servicio incluyendo:
 * - Estado (running/stopped/error)
 * - Tiempo de actividad (uptime en segundos)
 * - Uso de memoria en MB
 * - Uso de CPU en porcentaje
 *
 * @returns Promise con objeto de estado del servicio
 */
async function get_lpr_service_status(): Promise<{
  status: 'running' | 'stopped' | 'error';
  uptime: number;
  memory_mb: number;
  cpu_percent: number;
}> {
  try {
    const container_name = 'exalink-lpr-backend';

    // Verificar si el contenedor existe y está corriendo
    const { stdout: ps_output } = await execAsync(
      `docker ps --filter "name=${container_name}" --format "{{.Status}}"`
    );

    if (!ps_output.trim()) {
      // Contenedor no está corriendo
      return {
        status: 'stopped',
        uptime: 0,
        memory_mb: 0,
        cpu_percent: 0
      };
    }

    // Obtener métricas usando docker stats (una sola ejecución)
    const { stdout: stats_output } = await execAsync(
      `docker stats ${container_name} --no-stream --format "{{.Container}}|{{.CPUPerc}}|{{.MemUsage}}|{{.NetIO}}|{{.BlockIO}}"`
    );

    let memory_mb = 0;
    let cpu_percent = 0;

    if (stats_output.trim()) {
      const stats_line = stats_output.trim();
      const parts = stats_line.split('|');

      if (parts.length >= 3) {
        // Parsear CPU (ej: "12.19%")
        const cpu_str = parts[1].trim();
        if (cpu_str.endsWith('%')) {
          cpu_percent = parseFloat(cpu_str.slice(0, -1)) || 0;
        }

        // Parsear memoria (ej: "41.45MiB / 30.18GiB")
        const mem_str = parts[2].trim();
        const mem_parts = mem_str.split('/');
        if (mem_parts.length > 0) {
          const used_mem = mem_parts[0].trim();
          if (used_mem.includes('MiB')) {
            memory_mb = parseFloat(used_mem.replace('MiB', '')) || 0;
          } else if (used_mem.includes('GiB')) {
            memory_mb = (parseFloat(used_mem.replace('GiB', '')) || 0) * 1024;
          } else if (used_mem.includes('B')) {
            memory_mb = (parseFloat(used_mem.replace('B', '')) || 0) / (1024 * 1024);
          }
        }
      }
    }

    // Obtener uptime usando docker inspect
    let uptime = 0;
    try {
      const { stdout: inspect_output } = await execAsync(
        `docker inspect ${container_name} --format "{{.State.StartedAt}}"`
      );

      if (inspect_output.trim()) {
        const started_at = new Date(inspect_output.trim());
        const now = new Date();
        uptime = Math.floor((now.getTime() - started_at.getTime()) / 1000); // en segundos
      }
    } catch (inspect_error) {
      console.warn('Error obteniendo uptime del contenedor LPR:', inspect_error);
    }

    return {
      status: 'running',
      uptime,
      memory_mb: Math.round(memory_mb * 100) / 100, // Redondear a 2 decimales
      cpu_percent: Math.round(cpu_percent * 100) / 100
    };

  } catch (error) {
    console.error('Error checking LPR service status:', error);
    return {
      status: 'error',
      uptime: 0,
      memory_mb: 0,
      cpu_percent: 0
    };
  }
}

export async function GET() {
  /**
   * Endpoint GET /api/config/backend/status
   * 
   * Devuelve el estado operacional completo de todos los servicios backend.
   * Incluye estado enabled desde base de datos y métricas operacionales.
   * 
   * Implementación:
   * 1. Consulta configuración de servicios desde base de datos SQLite
   * 2. Obtiene métricas reales del servicio Docker de conteo
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

    // Obtener estado real del servicio Docker de conteo
    const counting_docker_status = await get_counting_service_status();

    // Obtener estado real del servicio Docker de LPR
    const lpr_docker_status = await get_lpr_service_status();


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
        enabled: counting_docker_status.status === 'running',
        config: '{}',
        status: counting_docker_status.status,
        uptime: counting_docker_status.uptime,
        processed: stats.total_events || 0,
        memory_mb: counting_docker_status.memory_mb,
        cpu_percent: counting_docker_status.cpu_percent,
        active_cameras: stats.active_cameras,
        active_objects: stats.active_objects
      };
    } catch (e) {
      services['Conteo'] = {
        enabled: counting_docker_status.status === 'running',
        config: '{}',
        status: counting_docker_status.status,
        uptime: counting_docker_status.uptime,
        processed: 0,
        memory_mb: counting_docker_status.memory_mb,
        cpu_percent: counting_docker_status.cpu_percent
      };
    }

    // Actualizar el servicio LPR con estado real del Docker y estadísticas de DB
    try {
      const { getLPRDatabase } = await import('@/lib/lpr-database');
      const lpr_db = getLPRDatabase();
      const lpr_stats = lpr_db.getStats();
      services['LPR (Matrículas)'] = {
        enabled: lpr_docker_status.status === 'running',
        config: services['LPR (Matrículas)']?.config || '{}',
        status: lpr_docker_status.status,
        uptime: lpr_docker_status.uptime,
        processed: lpr_stats.total_readings || 0,
        memory_mb: lpr_docker_status.memory_mb,
        cpu_percent: lpr_docker_status.cpu_percent,
        cameras_active: lpr_stats.cameras_active,
        unique_plates: lpr_stats.unique_plates
      };
    } catch (e) {
      services['LPR (Matrículas)'] = {
        enabled: lpr_docker_status.status === 'running',
        config: services['LPR (Matrículas)']?.config || '{}',
        status: lpr_docker_status.status,
        uptime: lpr_docker_status.uptime,
        processed: 0,
        memory_mb: lpr_docker_status.memory_mb,
        cpu_percent: lpr_docker_status.cpu_percent
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