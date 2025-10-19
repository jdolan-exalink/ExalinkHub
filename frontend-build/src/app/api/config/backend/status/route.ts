import { NextResponse } from 'next/server';
import { getDockerContainerStatus, isDockerAvailable } from '@/lib/docker-utils';
import ConfigDatabase from '@/lib/config-database';

/**
 * Endpoint: /api/config/backend/status
 * Devuelve el estado real y operacional de cada servicio backend con métricas formateadas
 *
 * Implementación:
 * - Lee la configuración real de la base de datos SQLite usando ConfigDatabase
 * - Obtiene métricas reales de Docker containers (CPU, memoria, uptime, estado)
 * - Obtiene estadísticas de procesamiento desde las bases de datos de cada servicio
 * - Formatea las métricas para presentación (uptime_formatted, memory_formatted, cpu_formatted)
 * - Incluye logs recientes de cada contenedor
 *
 * Ejemplo de respuesta:
 * {
 *   "services": {
 *     "LPR (Matrículas)": {
 *       "enabled": true,
 *       "auto_start": true,
 *       "status": "running",
 *       "uptime": 14523,
 *       "uptime_formatted": "4h 2m 3s",
 *       "memory_mb": 141.5,
 *       "memory_formatted": "141.50 MB",
 *       "cpu_percent": 0.77,
 *       "cpu_formatted": "0.77%",
 *       "processed": 150,
 *       "config": "{...}",
 *       "docker_status": {...},
 *       "logs": ["log line 1", "log line 2", ...]
 *     },
 *     "Conteo de Personas": {
 *       "enabled": true,
 *       "auto_start": false,
 *       "status": "running",
 *       "uptime": 14523,
 *       "uptime_formatted": "4h 2m 3s",
 *       "memory_mb": 42.64,
 *       "memory_formatted": "42.64 MB",
 *       "cpu_percent": 0.08,
 *       "cpu_formatted": "0.08%",
 *       "processed": 523,
 *       "config": "{...}",
 *       "docker_status": {...},
 *       "logs": [...]
 *     }
 *   },
 *   "docker_available": true
 * }
 */

export async function GET() {
  console.log('=== /api/config/backend/status called (v3 - formatted metrics FINAL) ===');
  try {
    const ConfigDatabase = (await import('@/lib/config-database')).default;
    const db = new ConfigDatabase();
    const configs = db.getAllBackendConfigs();

    // Mapeo de servicios y obtención de estado Docker + logs
    const services: Record<string, any> = {};
    const docker_available = isDockerAvailable();

    for (const cfg of configs) {
      const service_name = cfg.service_name;
      let docker_status = null;
      let logs: string[] = [];
      let metrics = {
        status: 'unknown',
        uptime: 0,
        uptime_formatted: '0s',
        memory_mb: 0,
        memory_formatted: '0 MB',
        cpu_percent: 0,
        cpu_formatted: '0%',
        processed: 0
      };

      if (docker_available) {
        try {
          docker_status = await getDockerContainerStatus(service_name);
          logs = await (await import('@/lib/docker-utils')).get_docker_container_logs(service_name, 50);
          
          // Formatear métricas si hay docker_status
          if (docker_status) {
            metrics.status = docker_status.status;
            metrics.uptime = docker_status.uptime;
            metrics.uptime_formatted = format_uptime(docker_status.uptime);
            metrics.memory_mb = docker_status.memory_mb;
            metrics.memory_formatted = format_memory(docker_status.memory_mb);
            metrics.cpu_percent = docker_status.cpu_percent;
            metrics.cpu_formatted = `${docker_status.cpu_percent.toFixed(2)}%`;
          }
        } catch (err) {
          console.warn(`No se pudo obtener estado/logs de Docker para ${service_name}:`, err);
        }
      }

      // Obtener datos de procesamiento según el servicio
      try {
        if (service_name === 'LPR (Matrículas)') {
          const lpr_stats = await get_lpr_stats();
          metrics.processed = lpr_stats.total_events;
          // Intentar enriquecer/override métricas desde LOG/stats.log y logs desde LOG/listener.log
          try {
            const stats_snapshot = read_stats_log_snapshot();
            if (stats_snapshot) {
              if (typeof stats_snapshot.cpu_percent === 'number') {
                metrics.cpu_percent = stats_snapshot.cpu_percent;
                metrics.cpu_formatted = `${stats_snapshot.cpu_percent.toFixed(2)}%`;
              }
              if (typeof stats_snapshot.memory === 'number') {
                metrics.memory_mb = stats_snapshot.memory;
                metrics.memory_formatted = format_memory(stats_snapshot.memory);
              }
              if (typeof stats_snapshot.uptime_seconds === 'number') {
                metrics.uptime = stats_snapshot.uptime_seconds;
                metrics.uptime_formatted = format_uptime(stats_snapshot.uptime_seconds);
              }
              metrics.status = stats_snapshot.running ? 'running' : metrics.status;
            }
          } catch (e) {
            console.warn('No se pudo leer LOG/stats.log para LPR:', (e as any)?.message || e);
          }
          try {
            const file_logs = read_listener_log_tail(200);
            if (file_logs && file_logs.length > 0) {
              logs = file_logs;
            }
          } catch (e) {
            console.warn('No se pudo leer LOG/listener.log para LPR:', (e as any)?.message || e);
          }
        } else if (service_name === 'Conteo de Personas') {
          const counting_stats = await get_counting_stats();
          metrics.processed = counting_stats.total_counts;
        } else if (service_name === 'Notificaciones') {
          // TODO: Implementar estadísticas de notificaciones
          metrics.processed = 0;
        }
      } catch (err) {
        console.warn(`No se pudo obtener estadísticas para ${service_name}:`, err);
      }

      services[service_name] = {
        enabled: !!cfg.enabled,
        auto_start: !!cfg.auto_start,
        config: cfg.config,
        ...metrics,
        docker_status,
        logs
      };
    }

    return NextResponse.json({
      services,
      docker_available
    });
  } catch (error) {
    console.error('Error in endpoint:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json({
      error: errorMessage,
      stack: errorStack,
      services: {},
      docker_available: false
    });
  }
}

/**
 * Formatea el uptime en segundos a un formato legible
 */
function format_uptime(seconds: number): string {
  if (seconds === 0) return '0s';
  
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

/**
 * Formatea la memoria en MB a un formato legible
 */
function format_memory(mb: number): string {
  if (mb === 0) return '0 MB';
  if (mb < 1024) return `${mb.toFixed(2)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

/**
 * Obtiene estadísticas del servicio LPR
 */
async function get_lpr_stats(): Promise<{ total_events: number }> {
  try {
    const Database = require('better-sqlite3');
    const path = require('path');
    const db_path = path.join(process.cwd(), 'DB', 'matriculas.db');
    // Abrir en modo solo lectura para evitar conflictos de bloqueo con el backend Python
    const db = new Database(db_path, { readonly: true, fileMustExist: true });
    const result = db.prepare('SELECT COUNT(*) as count FROM plate_events').get();
    db.close();
    return { total_events: result?.count || 0 };
  } catch (error) {
    console.error('Error getting LPR stats:', error);
    return { total_events: 0 };
  }
}

/**
 * Obtiene estadísticas del servicio de conteo
 */
async function get_counting_stats(): Promise<{ total_counts: number }> {
  try {
    const Database = require('better-sqlite3');
    const path = require('path');
    const db_path = path.join(process.cwd(), 'DB', 'counting.db');
    // Abrir en modo solo lectura para evitar conflictos con escritor
    const db = new Database(db_path, { readonly: true, fileMustExist: true });
    const result = db.prepare('SELECT COUNT(*) as count FROM counting_events').get();
    db.close();
    return { total_counts: result?.count || 0 };
  } catch (error) {
    console.error('Error getting counting stats:', error);
    return { total_counts: 0 };
  }
}

/**
 * Lee el snapshot de métricas desde `LOG/stats.log`.
 * Devuelve cpu_percent, memory (MB), uptime_seconds y running cuando están disponibles.
 */
function read_stats_log_snapshot(): null | { cpu_percent?: number; memory?: number; uptime_seconds?: number; running?: boolean } {
  try {
    const fs = require('fs');
    const path = require('path');
    const stats_path = path.join(process.cwd(), 'LOG', 'stats.log');
    if (!fs.existsSync(stats_path)) return null;
    const content = fs.readFileSync(stats_path, 'utf8');
    if (!content || !content.trim()) return null;
    const data = JSON.parse(content);
    const cpu_percent = typeof data.cpu_percent === 'number' ? data.cpu_percent : undefined;
    let memory: number | undefined = undefined;
    if (typeof data.memory === 'number') memory = data.memory;
    else if (typeof data.memory_mb === 'number') memory = data.memory_mb;
    const uptime_seconds = typeof data.uptime_seconds === 'number' ? data.uptime_seconds : undefined;
    const running = data.running === true || data.status === 'running';
    return { cpu_percent, memory, uptime_seconds, running };
  } catch (e) {
    return null;
  }
}

/**
 * Devuelve el tail de `LOG/listener.log` con un máximo de N líneas.
 * @param lines cantidad de líneas a leer (default 200)
 */
function read_listener_log_tail(lines: number = 200): string[] {
  try {
    const fs = require('fs');
    const path = require('path');
    const log_path = path.join(process.cwd(), 'LOG', 'listener.log');
    if (!fs.existsSync(log_path)) return [];
    const content = fs.readFileSync(log_path, 'utf8');
    if (!content) return [];
    const all_lines = content.split('\n');
    const start = Math.max(0, all_lines.length - lines);
    return all_lines.slice(start).filter(Boolean);
  } catch (e) {
    return [];
  }
}