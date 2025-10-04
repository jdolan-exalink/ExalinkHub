/**
 * API para obtener métricas de servidores
 * GET /api/config/servers/metrics - Obtener solo métricas actualizadas
 */

import { NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';
import { getAuthHeaders } from '@/lib/frigate-auth';
import { createFetchOptions } from '@/lib/secure-fetch';

interface ServerMetrics {
  id: number;
  status: {
    cpu_usage: number;
    gpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    api_status: 'online' | 'offline' | 'error';
    last_check: string;
  };
}

/**
 * GET /api/config/servers/metrics
 * Obtener métricas actualizadas de todos los servidores habilitados
 */
export async function GET() {
  try {
    const db = getConfigDatabase();
    const servers = db.getAllServers();
    
    const serverMetrics: ServerMetrics[] = [];
    
    // Solo obtener métricas para servidores habilitados
    const enabledServers = servers.filter((server: any) => server.enabled);
    
    for (const server of enabledServers) {
      try {
        const baseUrl = `${server.protocol}://${server.url}:${server.port}`;
        
        const headers = getAuthHeaders(server);
        const fetchOptions = createFetchOptions(headers);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // Timeout más corto para métricas

        const statsResponse = await fetch(`${baseUrl}/api/stats`, { 
          ...fetchOptions,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (statsResponse.ok) {
          const stats = await statsResponse.json();
          
          // Extraer métricas del sistema de Frigate
          const frigateFullSystem = stats.cpu_usages?.['frigate.full_system'];
          const cpuUsage = frigateFullSystem ? parseFloat(frigateFullSystem.cpu) : 0;
          const memoryUsage = frigateFullSystem ? parseFloat(frigateFullSystem.mem) : 0;
          
          // Disco: Usar el almacenamiento principal
          const recordingsStorage = stats.service?.storage?.['/media/frigate/recordings'];
          const clipsStorage = stats.service?.storage?.['/media/frigate/clips'];
          const mainStorage = recordingsStorage || clipsStorage;
          
          let diskUsage = 0;
          if (mainStorage && mainStorage.total && mainStorage.used) {
            diskUsage = (mainStorage.used / mainStorage.total) * 100;
          }
          
          // GPU: Extraer de gpu_usages si está disponible
          const gpuData = stats.gpu_usages ? Object.values(stats.gpu_usages)[0] as any : null;
          const gpuUsage = gpuData?.mem ? parseFloat(gpuData.mem.replace('%', '')) : 0;
          
          // Actualizar en base de datos
          db.updateServerStatus(server.id, {
            cpu_usage: cpuUsage,
            gpu_usage: gpuUsage,
            memory_usage: memoryUsage,
            disk_usage: diskUsage,
            api_status: 'online',
            last_check: new Date().toISOString()
          });

          serverMetrics.push({
            id: server.id,
            status: {
              cpu_usage: cpuUsage,
              gpu_usage: gpuUsage,
              memory_usage: memoryUsage,
              disk_usage: diskUsage,
              api_status: 'online',
              last_check: new Date().toISOString()
            }
          });
        } else {
          // Servidor no responde
          db.updateServerStatus(server.id, {
            cpu_usage: 0,
            gpu_usage: 0,
            memory_usage: 0,
            disk_usage: 0,
            api_status: 'offline',
            last_check: new Date().toISOString()
          });

          serverMetrics.push({
            id: server.id,
            status: {
              cpu_usage: 0,
              gpu_usage: 0,
              memory_usage: 0,
              disk_usage: 0,
              api_status: 'offline',
              last_check: new Date().toISOString()
            }
          });
        }
      } catch (error) {
        // Error de conexión
        db.updateServerStatus(server.id, {
          cpu_usage: 0,
          gpu_usage: 0,
          memory_usage: 0,
          disk_usage: 0,
          api_status: 'error',
          last_check: new Date().toISOString()
        });

        serverMetrics.push({
          id: server.id,
          status: {
            cpu_usage: 0,
            gpu_usage: 0,
            memory_usage: 0,
            disk_usage: 0,
            api_status: 'error',
            last_check: new Date().toISOString()
          }
        });
      }
    }

    return NextResponse.json({ 
      servers: serverMetrics,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error obteniendo métricas de servidores:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}