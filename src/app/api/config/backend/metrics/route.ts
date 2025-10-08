import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Cache para métricas Docker
let dockerMetricsCache: {
  data: any;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en milisegundos

/**
 * Obtiene métricas de servicios Docker con cache
 * @returns Promise con métricas cacheadas o frescas
 */
async function getCachedDockerMetrics(): Promise<{
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
}> {
  const now = Date.now();

  // Si tenemos cache válido, devolverlo
  if (dockerMetricsCache && (now - dockerMetricsCache.timestamp) < CACHE_DURATION) {
    return dockerMetricsCache.data;
  }

  // Obtener métricas frescas
  const [countingMetrics, lprMetrics] = await Promise.all([
    get_counting_service_status(),
    get_lpr_service_status()
  ]);

  const freshMetrics = {
    counting: countingMetrics,
    lpr: lprMetrics
  };

  // Actualizar cache
  dockerMetricsCache = {
    data: freshMetrics,
    timestamp: now
  };

  return freshMetrics;
}

/**
 * Obtiene el estado real del servicio Docker de conteo
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
      return {
        status: 'stopped',
        uptime: 0,
        memory_mb: 0,
        cpu_percent: 0
      };
    }

    // Obtener métricas usando docker stats
    const { stdout: stats_output } = await execAsync(
      `docker stats ${container_name} --no-stream --format "{{.Container}}|{{.CPUPerc}}|{{.MemUsage}}"`
    );

    let memory_mb = 0;
    let cpu_percent = 0;

    if (stats_output.trim()) {
      const stats_line = stats_output.trim();
      const parts = stats_line.split('|');

      if (parts.length >= 3) {
        // Parsear CPU
        const cpu_str = parts[1].trim();
        if (cpu_str.endsWith('%')) {
          cpu_percent = parseFloat(cpu_str.slice(0, -1)) || 0;
        }

        // Parsear memoria
        const mem_str = parts[2].trim();
        const mem_parts = mem_str.split('/');
        if (mem_parts.length > 0) {
          const used_mem = mem_parts[0].trim();
          if (used_mem.includes('MiB')) {
            memory_mb = parseFloat(used_mem.replace('MiB', '')) || 0;
          } else if (used_mem.includes('GiB')) {
            memory_mb = (parseFloat(used_mem.replace('GiB', '')) || 0) * 1024;
          }
        }
      }
    }

    // Obtener uptime
    let uptime = 0;
    try {
      const { stdout: inspect_output } = await execAsync(
        `docker inspect ${container_name} --format "{{.State.StartedAt}}"`
      );

      if (inspect_output.trim()) {
        const started_at = new Date(inspect_output.trim());
        const now = new Date();
        uptime = Math.floor((now.getTime() - started_at.getTime()) / 1000);
      }
    } catch (inspect_error) {
      console.warn('Error obteniendo uptime del contenedor:', inspect_error);
    }

    return {
      status: 'running',
      uptime,
      memory_mb: Math.round(memory_mb * 100) / 100,
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
      return {
        status: 'stopped',
        uptime: 0,
        memory_mb: 0,
        cpu_percent: 0
      };
    }

    // Obtener métricas usando docker stats
    const { stdout: stats_output } = await execAsync(
      `docker stats ${container_name} --no-stream --format "{{.Container}}|{{.CPUPerc}}|{{.MemUsage}}"`
    );

    let memory_mb = 0;
    let cpu_percent = 0;

    if (stats_output.trim()) {
      const stats_line = stats_output.trim();
      const parts = stats_line.split('|');

      if (parts.length >= 3) {
        // Parsear CPU
        const cpu_str = parts[1].trim();
        if (cpu_str.endsWith('%')) {
          cpu_percent = parseFloat(cpu_str.slice(0, -1)) || 0;
        }

        // Parsear memoria
        const mem_str = parts[2].trim();
        const mem_parts = mem_str.split('/');
        if (mem_parts.length > 0) {
          const used_mem = mem_parts[0].trim();
          if (used_mem.includes('MiB')) {
            memory_mb = parseFloat(used_mem.replace('MiB', '')) || 0;
          } else if (used_mem.includes('GiB')) {
            memory_mb = (parseFloat(used_mem.replace('GiB', '')) || 0) * 1024;
          }
        }
      }
    }

    // Obtener uptime
    let uptime = 0;
    try {
      const { stdout: inspect_output } = await execAsync(
        `docker inspect ${container_name} --format "{{.State.StartedAt}}"`
      );

      if (inspect_output.trim()) {
        const started_at = new Date(inspect_output.trim());
        const now = new Date();
        uptime = Math.floor((now.getTime() - started_at.getTime()) / 1000);
      }
    } catch (inspect_error) {
      console.warn('Error obteniendo uptime del contenedor LPR:', inspect_error);
    }

    return {
      status: 'running',
      uptime,
      memory_mb: Math.round(memory_mb * 100) / 100,
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
   * Endpoint GET /api/config/backend/metrics
   *
   * Devuelve métricas operacionales de servicios Docker con cache.
   * Las métricas se actualizan cada 5 minutos para reducir carga del sistema.
   *
   * Implementación:
   * 1. Verifica cache de métricas Docker
   * 2. Si cache expirado, obtiene métricas frescas de Docker
   * 3. Retorna métricas con timestamp de última actualización
   *
   * @returns NextResponse con métricas o error 500
   */
  try {
    const metrics = await getCachedDockerMetrics();
    const cacheAge = dockerMetricsCache ? Date.now() - dockerMetricsCache.timestamp : 0;

    return NextResponse.json({
      metrics,
      cache_age_seconds: Math.floor(cacheAge / 1000),
      cache_duration_seconds: CACHE_DURATION / 1000,
      last_updated: dockerMetricsCache?.timestamp || null
    });
  } catch (error) {
    console.error('Error obteniendo métricas de servicios:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}