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
  console.log('=== /api/config/backend/status called ===');
  console.log('Current timestamp:', new Date().toISOString());

  try {
    // Obtener configuración de servicios desde la base de datos
    let configs = [];
    try {
      const ConfigDatabase = (await import('@/lib/config-database')).default;
      const db = new ConfigDatabase();
      configs = db.getAllBackendConfigs();
      console.log(`[STATUS API] Loaded ${configs.length} service configs from database`);
    } catch (dbError) {
      console.error('[STATUS API] Database access failed:', dbError);
      // Fallback: configuración básica por defecto
      configs = [
        { service_name: 'LPR (Matrículas)', enabled: true, auto_start: true, config: '{}' },
        { service_name: 'Conteo de Personas', enabled: false, auto_start: false, config: '{}' },
        { service_name: 'Notificaciones', enabled: true, auto_start: true, config: '{}' }
      ];
      console.log('[STATUS API] Using fallback configuration');
    }

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

      console.log(`[STATUS API] Processing service: ${service_name}, docker_available: ${docker_available}`);

      if (docker_available) {
        console.log(`[STATUS API] Docker available, trying to get status for ${service_name}`);
        try {
          docker_status = await getDockerContainerStatus(service_name);
          logs = await (await import('@/lib/docker-utils')).get_docker_container_logs(service_name, 50);

          // Formatear métricas si hay docker_status
          if (docker_status) {
            console.log(`[STATUS API] Docker status obtained for ${service_name}:`, docker_status);
            metrics.status = docker_status.status;
            metrics.uptime = docker_status.uptime;
            metrics.uptime_formatted = format_uptime(docker_status.uptime);
            metrics.memory_mb = docker_status.memory_mb;
            metrics.memory_formatted = format_memory(docker_status.memory_mb);
            metrics.cpu_percent = docker_status.cpu_percent;
            metrics.cpu_formatted = `${docker_status.cpu_percent.toFixed(2)}%`;
          } else {
            console.log(`[STATUS API] No docker_status returned for ${service_name}`);
          }
        } catch (dockerErr) {
          console.warn(`[STATUS API] Docker access failed for ${service_name}, trying fallback:`, dockerErr);
          // Fallback: intentar usar métricas del archivo stats.log si es LPR
          if (service_name === 'LPR (Matrículas)') {
            console.log(`[STATUS API] Trying stats.log fallback for ${service_name}`);
            try {
              const stats_snapshot = read_stats_log_snapshot();
              console.log(`[STATUS API] Stats snapshot result:`, stats_snapshot);
              if (stats_snapshot) {
                console.log(`[STATUS API] Applying stats snapshot to ${service_name}`);
                metrics.status = stats_snapshot.running ? 'running' : 'stopped';
                metrics.uptime = stats_snapshot.uptime_seconds || 0;
                metrics.uptime_formatted = format_uptime(metrics.uptime);
                metrics.memory_mb = stats_snapshot.memory || 0;
                metrics.memory_formatted = format_memory(metrics.memory_mb);
                metrics.cpu_percent = stats_snapshot.cpu_percent || 0;
                metrics.cpu_formatted = `${metrics.cpu_percent.toFixed(2)}%`;
                metrics.processed = stats_snapshot.events_processed || 0;
                console.log(`[STATUS API] Applied fallback metrics: status=${metrics.status}, cpu=${metrics.cpu_percent}%, memory=${metrics.memory_mb}MB`);
              } else {
                console.log(`[STATUS API] No stats snapshot available for ${service_name}`);
              }
            } catch (fallbackErr) {
              console.warn(`[STATUS API] Fallback también falló para ${service_name}:`, fallbackErr);
            }
          }
        }
      } else {
        console.log(`[STATUS API] Docker not available, using stats.log for ${service_name}`);
        // Docker no disponible, usar solo stats.log para LPR
        if (service_name === 'LPR (Matrículas)') {
          try {
            const stats_snapshot = read_stats_log_snapshot();
            if (stats_snapshot) {
              metrics.status = stats_snapshot.running ? 'running' : 'stopped';
              metrics.uptime = stats_snapshot.uptime_seconds || 0;
              metrics.uptime_formatted = format_uptime(metrics.uptime);
              metrics.memory_mb = stats_snapshot.memory || 0;
              metrics.memory_formatted = format_memory(metrics.memory_mb);
              metrics.cpu_percent = stats_snapshot.cpu_percent || 0;
              metrics.cpu_formatted = `${metrics.cpu_percent.toFixed(2)}%`;
              metrics.processed = stats_snapshot.events_processed || 0;
            }
          } catch (err) {
            console.warn(`[STATUS API] No se pudo leer stats.log para ${service_name}:`, err);
          }
        }
      }

      // Obtener datos de procesamiento según el servicio
      // Primero intentar leer stats.log para LPR, independientemente de otros errores
      if (service_name === 'LPR (Matrículas)') {
        try {
          console.log(`[STATUS API] Attempting to read stats.log for ${service_name} (independent read)`);
          const early_stats_snapshot = read_stats_log_snapshot();
          console.log(`[STATUS API] Independent stats snapshot result:`, early_stats_snapshot);
          if (early_stats_snapshot) {
            console.log(`[STATUS API] Applying independent stats snapshot to ${service_name}`);
            if (typeof early_stats_snapshot.cpu_percent === 'number') {
              metrics.cpu_percent = early_stats_snapshot.cpu_percent;
              metrics.cpu_formatted = `${early_stats_snapshot.cpu_percent.toFixed(2)}%`;
              console.log(`[STATUS API] Updated CPU: ${metrics.cpu_percent}%`);
            }
            if (typeof early_stats_snapshot.memory === 'number') {
              metrics.memory_mb = early_stats_snapshot.memory;
              metrics.memory_formatted = format_memory(early_stats_snapshot.memory);
              console.log(`[STATUS API] Updated Memory: ${metrics.memory_mb} MB`);
            }
            if (typeof early_stats_snapshot.uptime_seconds === 'number') {
              metrics.uptime = early_stats_snapshot.uptime_seconds;
              metrics.uptime_formatted = format_uptime(early_stats_snapshot.uptime_seconds);
              console.log(`[STATUS API] Updated Uptime: ${metrics.uptime} seconds`);
            }
            if (early_stats_snapshot.running !== undefined) {
              metrics.status = early_stats_snapshot.running ? 'running' : 'stopped';
              console.log(`[STATUS API] Updated Status: ${metrics.status}`);
            }
            if (typeof early_stats_snapshot.events_processed === 'number') {
              metrics.processed = early_stats_snapshot.events_processed;
              console.log(`[STATUS API] Updated Processed: ${metrics.processed}`);
            }
          }
        } catch (statsErr) {
          console.warn(`[STATUS API] Failed to read stats.log for ${service_name}:`, statsErr);
        }

        try {
          const file_logs = read_listener_log_tail(200);
          if (file_logs && file_logs.length > 0) {
            logs = file_logs;
          }
        } catch (logErr) {
          console.warn('No se pudo leer LOG/listener.log para LPR:', logErr);
        }
      }

      try {
        if (service_name === 'LPR (Matrículas)') {
          const lpr_stats = await get_lpr_stats();
          // Override processed count with database count if available
          if (lpr_stats.total_events > metrics.processed) {
            metrics.processed = lpr_stats.total_events;
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
    const fs = require('fs');
    const db_path = path.join(process.cwd(), 'DB', 'matriculas.db');
    
    // Verificar que el archivo existe
    if (!fs.existsSync(db_path)) {
      console.log('LPR database file does not exist:', db_path);
      return { total_events: 0 };
    }
    
    // Abrir en modo solo lectura para evitar conflictos de bloqueo con el backend Python
    const db = Database(db_path, { readonly: true, fileMustExist: true });
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
    const fs = require('fs');
    const db_path = path.join(process.cwd(), 'DB', 'counting.db');
    
    // Verificar que el archivo existe
    if (!fs.existsSync(db_path)) {
      console.log('Counting database file does not exist:', db_path);
      return { total_counts: 0 };
    }
    
    // Abrir en modo solo lectura para evitar conflictos con escritor
    const db = Database(db_path, { readonly: true, fileMustExist: true });
    const result = db.prepare('SELECT COUNT(*) as count FROM counting_events').get();
    db.close();
    return { total_counts: result?.count || 0 };
  } catch (error) {
    console.error('Error getting counting stats:', error);
    return { total_counts: 0 };
  }
}

/**
 * Lee el snapshot de métricas desde `backend/Matriculas/LOG/stats.log`.
 * Devuelve cpu_percent, memory (MB), uptime_seconds y running cuando están disponibles.
 */
function read_stats_log_snapshot(): null | { cpu_percent?: number; memory?: number; uptime_seconds?: number; running?: boolean; status?: string; events_processed?: number; last_event?: string } {
  console.log('[STATS LOG] read_stats_log_snapshot() called');
  try {
    const fs = require('fs');
    const path = require('path');
    const stats_path = path.join(process.cwd(), 'backend', 'Matriculas', 'LOG', 'stats.log');
    console.log(`[STATS LOG] Looking for file at: ${stats_path}`);
    if (!fs.existsSync(stats_path)) {
      console.log(`[STATS LOG] File not found: ${stats_path}`);
      return null;
    }
    const content = fs.readFileSync(stats_path, 'utf8').trim();
    if (!content) {
      console.log('[STATS LOG] File is empty');
      return null;
    }

    console.log(`[STATS LOG] Raw content: ${content}`);
    const data = JSON.parse(content);

    // Handle different formats of stats.log
    const result = {
      cpu_percent: typeof data.cpu_percent === 'number' ? data.cpu_percent : undefined,
      memory: typeof data.memory === 'number' ? data.memory : (typeof data.memory_mb === 'number' ? data.memory_mb : undefined),
      uptime_seconds: typeof data.uptime_seconds === 'number' ? data.uptime_seconds : undefined,
      running: data.running === true || data.status === 'running',
      status: data.status,
      events_processed: typeof data.events_processed === 'number' ? data.events_processed : undefined,
      last_event: data.last_event
    };

    console.log(`[STATS LOG] Parsed data:`, result);
    return result;
  } catch (e) {
    console.error('[STATS LOG] Error reading stats.log:', e);
    return null;
  }
}

/**
 * Devuelve el tail de `backend/Matriculas/LOG/listener.log` con un máximo de N líneas.
 * @param lines cantidad de líneas a leer (default 200)
 */
function read_listener_log_tail(lines: number = 200): string[] {
  try {
    const fs = require('fs');
    const path = require('path');
    const log_path = path.join(process.cwd(), 'backend', 'Matriculas', 'LOG', 'listener.log');
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