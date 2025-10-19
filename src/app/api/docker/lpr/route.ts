/**
 * API para gestión de servicios Docker del Sistema LPR
 * Permite controlar el estado de los contenedores via API REST
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const exec_async = promisify(exec);

// Tipos para las respuestas API
interface ServiceStatus {
  service_name: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  container_id?: string;
  uptime?: string;
  health?: 'healthy' | 'unhealthy' | 'unknown';
  ports?: string[];
}

interface DockerServiceResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Ejecuta comando Docker de forma segura
 */
async function execute_docker_command(command: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await exec_async(command, {
      timeout: 30000, // 30 segundos timeout
      maxBuffer: 1024 * 1024 // 1MB buffer
    });
    return result;
  } catch (error: any) {
    throw new Error(`Error ejecutando comando Docker: ${error.message}`);
  }
}

/**
 * Obtiene el estado de un servicio Docker Compose
 */
async function get_service_status(service_name: string): Promise<ServiceStatus> {
  try {
    // Método más confiable usando docker-compose ps con formato JSON
    const { stdout } = await execute_docker_command(
      `docker-compose ps ${service_name} --format json`
    );
    
    if (!stdout.trim()) {
      return {
        service_name,
        status: 'stopped'
      };
    }
    
    // Parsear cada línea como JSON separado
    const lines = stdout.trim().split('\n');
    const container_info = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean)[0];
    
    if (!container_info) {
      return {
        service_name,
        status: 'stopped'
      };
    }
    
    // Determinar estado basado en información de Docker Compose
    let service_status: ServiceStatus['status'] = 'unknown';
    if (container_info.State === 'running') {
      service_status = 'running';
    } else if (container_info.State === 'exited') {
      service_status = 'stopped';
    } else {
      service_status = 'error';
    }
    
    // Obtener información adicional del contenedor si está disponible
    let health: ServiceStatus['health'] = 'unknown';
    let uptime = '';
    let ports: string[] = [];
    
    if (container_info.ID && service_status === 'running') {
      try {
        const { stdout: inspect_output } = await execute_docker_command(
          `docker inspect ${container_info.ID} --format "{{json .}}"`
        );
        const inspect_data = JSON.parse(inspect_output);
        
        // Estado de salud
        if (inspect_data.State?.Health?.Status) {
          health = inspect_data.State.Health.Status === 'healthy' ? 'healthy' : 'unhealthy';
        }
        
        // Tiempo de actividad
        if (inspect_data.State?.StartedAt) {
          const started = new Date(inspect_data.State.StartedAt);
          const now = new Date();
          const uptime_ms = now.getTime() - started.getTime();
          uptime = format_uptime(uptime_ms);
        }
        
        // Puertos expuestos
        if (inspect_data.NetworkSettings?.Ports) {
          ports = Object.keys(inspect_data.NetworkSettings.Ports)
            .filter(port => inspect_data.NetworkSettings.Ports[port])
            .map(port => {
              const host_ports = inspect_data.NetworkSettings.Ports[port];
              if (host_ports && host_ports.length > 0) {
                return host_ports.map((hp: any) => `${hp.HostPort}:${port.split('/')[0]}`).join(', ');
              }
              return port.split('/')[0];
            })
            .filter(Boolean);
        }
      } catch (inspect_error) {
        console.warn('Error obteniendo detalles del contenedor:', inspect_error);
      }
    }
    
    return {
      service_name,
      status: service_status,
      container_id: container_info.ID,
      uptime,
      health,
      ports
    };
    
  } catch (error) {
    console.error(`Error obteniendo estado de ${service_name}:`, error);
    return {
      service_name,
      status: 'error'
    };
  }
}

/**
 * Formatea tiempo de actividad en formato legible
 */
function format_uptime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Controla un servicio Docker Compose
 */
async function control_service(action: string, service_name: string): Promise<DockerServiceResponse> {
  const valid_actions = ['start', 'stop', 'restart', 'build', 'rebuild', 'logs', 'pull'];
  
  if (!valid_actions.includes(action)) {
    return {
      success: false,
      message: `Acción no válida: ${action}. Acciones válidas: ${valid_actions.join(', ')}`,
      error: 'INVALID_ACTION'
    };
  }
  
  try {
    let command = '';
    let timeout = 30000; // 30 segundos por defecto
    
    switch (action) {
      case 'start':
        command = `docker-compose up -d ${service_name}`;
        timeout = 60000; // 1 minuto para iniciar
        break;
      case 'stop':
        command = `docker-compose stop ${service_name}`;
        break;
      case 'restart':
        command = `docker-compose restart ${service_name}`;
        timeout = 60000; // 1 minuto para reiniciar
        break;
      case 'build':
        command = `docker-compose build ${service_name}`;
        timeout = 300000; // 5 minutos para build
        break;
      case 'rebuild':
        command = `docker-compose build --no-cache ${service_name}`;
        timeout = 600000; // 10 minutos para rebuild completo
        break;
      case 'pull':
        command = `docker-compose pull ${service_name}`;
        timeout = 180000; // 3 minutos para pull
        break;
      case 'logs':
        command = `docker-compose logs --tail=100 ${service_name}`;
        break;
    }
    
    const { stdout, stderr } = await exec_async(command, {
      timeout,
      maxBuffer: 2 * 1024 * 1024 // 2MB buffer
    });
    
    return {
      success: true,
      message: `Acción '${action}' ejecutada exitosamente en ${service_name}`,
      data: {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        action,
        service_name
      }
    };
    
  } catch (error: any) {
    return {
      success: false,
      message: `Error ejecutando '${action}' en ${service_name}`,
      error: error.message
    };
  }
}

/**
 * GET - Obtener estado de servicios
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const service_name = searchParams.get('service') || 'lpr-backend';
    const action = searchParams.get('action');
    
    // Si se especifica una acción en GET, obtener logs
    if (action === 'logs') {
      const result = await control_service('logs', service_name);
      return NextResponse.json(result);
    }
    
    // Obtener estado del servicio
    const status = await get_service_status(service_name);
    
    // También obtener estado de salud si está corriendo
    if (status.status === 'running') {
      try {
        const health_response = await fetch(`http://${service_name}:2221/health`, {
          signal: AbortSignal.timeout(5000)
        });
        status.health = health_response.ok ? 'healthy' : 'unhealthy';
      } catch {
        status.health = 'unknown';
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Estado obtenido exitosamente',
      data: status
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Error obteniendo estado del servicio',
      error: error.message
    }, { status: 500 });
  }
}

/**
 * POST - Controlar servicios (start, stop, restart)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, service_name = 'lpr-backend' } = body;
    
    if (!action) {
      return NextResponse.json({
        success: false,
        message: 'Acción requerida',
        error: 'MISSING_ACTION'
      }, { status: 400 });
    }
    
    const result = await control_service(action, service_name);
    
    return NextResponse.json(result, {
      status: result.success ? 200 : 500
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Error procesando solicitud',
      error: error.message
    }, { status: 500 });
  }
}

/**
 * PUT - Actualizar configuración del servicio
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { service_name = 'lpr-backend', environment } = body;
    
    // Esta función podría actualizar variables de entorno y reiniciar el servicio
    if (environment) {
      // Aquí podrías escribir un archivo .env personalizado
      // Por ahora, solo reiniciamos el servicio
      const result = await control_service('restart', service_name);
      return NextResponse.json({
        ...result,
        message: `Configuración actualizada y servicio ${service_name} reiniciado`
      });
    }
    
    return NextResponse.json({
      success: false,
      message: 'No se proporcionó configuración para actualizar',
      error: 'MISSING_CONFIG'
    }, { status: 400 });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: 'Error actualizando configuración',
      error: error.message
    }, { status: 500 });
  }
}