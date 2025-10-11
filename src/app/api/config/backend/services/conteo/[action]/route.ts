/**
 * API para controlar el servicio Docker del backend de conteo
 * 
 * Endpoints:
 * POST /api/config/backend/services/conteo/start - Iniciar servicio
 * POST /api/config/backend/services/conteo/stop - Detener servicio  
 * POST /api/config/backend/services/conteo/restart - Reiniciar servicio
 * 
 * Maneja el control del contenedor Docker que ejecuta el backend de conteo.
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface service_control_response {
  success: boolean;
  message: string;
  service: string;
  action: string;
  status?: 'running' | 'stopped' | 'error';
}

/**
 * Controla el servicio Docker del backend de conteo
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> }
): Promise<NextResponse<service_control_response>> {
  const { action } = await context.params;
  try {
    const valid_actions = ['start', 'stop', 'restart'];
    
    if (!valid_actions.includes(action)) {
      return NextResponse.json({
        success: false,
        message: `Acción no válida: ${action}`,
        service: 'conteo',
        action
      }, { status: 400 });
    }

    // Nombre del contenedor/servicio Docker
    const container_name = 'counting-backend';
    const docker_compose_service = 'counting-service';
    
    let command: string;
    let expected_status: 'running' | 'stopped' | 'error';
    
    switch (action) {
      case 'start':
        // Intentar iniciar usando docker-compose primero, luego docker run como fallback
        command = `docker-compose up -d ${docker_compose_service} || docker run -d --name ${container_name} --restart unless-stopped counting-backend:latest`;
        expected_status = 'running';
        break;
        
      case 'stop':
        // Detener el contenedor
        command = `docker-compose stop ${docker_compose_service} || docker stop ${container_name}`;
        expected_status = 'stopped';
        break;
        
      case 'restart':
        // Reiniciar el servicio
        command = `docker-compose restart ${docker_compose_service} || docker restart ${container_name}`;
        expected_status = 'running';
        break;
        
      default:
        throw new Error(`Acción no implementada: ${action}`);
    }

    console.log(`Executing docker command: ${command}`);
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 30000, // 30 segundos timeout
        cwd: process.cwd()
      });
      
      if (stderr && !stderr.includes('Warning')) {
        console.error(`Docker command stderr: ${stderr}`);
      }
      
      console.log(`Docker command stdout: ${stdout}`);
      
      // Verificar el estado del contenedor después del comando
      let actual_status: 'running' | 'stopped' | 'error' = 'error';
      
      try {
        const { stdout: status_output } = await execAsync(
          `docker ps --filter "name=${container_name}" --format "{{.Status}}"`
        );
        
        const lines = status_output.trim().split('\n');
        const first_line = lines[0] || '';
        
        if (first_line && first_line.includes('Up')) {
          actual_status = 'running';
        } else {
          // Verificar si existe pero está detenido
          const { stdout: all_containers } = await execAsync(
            `docker ps -a --filter "name=${container_name}" --format "{{.Status}}"`
          );
          
          const all_lines = all_containers.trim().split('\n');
          const first_all_line = all_lines[0] || '';
          
          if (first_all_line) {
            actual_status = first_all_line.includes('Exited') ? 'stopped' : 'error';
          } else {
            actual_status = 'stopped';
          }
        }
      } catch (status_error) {
        console.error('Error checking container status:', status_error);
        actual_status = 'error';
      }
      
      return NextResponse.json({
        success: true,
        message: `Servicio ${action === 'restart' ? 'reiniciado' : action === 'start' ? 'iniciado' : 'detenido'} correctamente`,
        service: 'conteo',
        action,
        status: actual_status
      });
      
    } catch (exec_error: any) {
      console.error(`Error executing docker command: ${exec_error.message}`);
      
      // Si es un error de "container not found" para stop/restart, considerarlo éxito parcial
      if ((action === 'stop' || action === 'restart') && 
          exec_error.message.includes('No such container')) {
        return NextResponse.json({
          success: true,
          message: 'El contenedor ya estaba detenido',
          service: 'conteo',
          action,
          status: 'stopped'
        });
      }
      
      throw exec_error;
    }
    
  } catch (error: any) {
    console.error(`Error controlling service:`, error);
    
    return NextResponse.json({
      success: false,
      message: `Error al ${action === 'start' ? 'iniciar' : action === 'stop' ? 'detener' : 'reiniciar'} el servicio: ${error.message}`,
      service: 'conteo',
      action,
      status: 'error'
    }, { status: 500 });
  }
}
