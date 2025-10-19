/**
 * Utilidades para controlar servicios Docker
 */

import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Mapeo de servicios a nombres de contenedores Docker
 */
const SERVICE_CONTAINER_MAP: Record<string, string> = {
  'LPR (Matrículas)': 'matriculas-listener',
  'Conteo de Personas': 'exalink-conteo-backend',
  'Notificaciones': 'exalink-notificaciones-backend'
};

/**
 * Estado de un contenedor Docker
 */
export interface DockerContainerStatus {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'exited' | 'unknown';
  uptime: number; // segundos
  memory_mb: number;
  cpu_percent: number;
}

/**
 * Inicia un contenedor Docker
 */
export async function startDockerContainer(serviceName: string): Promise<boolean> {
  try {
    const containerName = SERVICE_CONTAINER_MAP[serviceName];
    if (!containerName) {
      console.error(`No container mapping found for service: ${serviceName}`);
      return false;
    }

    console.log(`Starting Docker container: ${containerName}`);
    execSync(`docker start ${containerName}`, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Error starting container for ${serviceName}:`, error);
    return false;
  }
}

/**
 * Detiene un contenedor Docker
 */
export async function stopDockerContainer(serviceName: string): Promise<boolean> {
  try {
    const containerName = SERVICE_CONTAINER_MAP[serviceName];
    if (!containerName) {
      console.error(`No container mapping found for service: ${serviceName}`);
      return false;
    }

    console.log(`Stopping Docker container: ${containerName}`);
    execSync(`docker stop ${containerName}`, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Error stopping container for ${serviceName}:`, error);
    return false;
  }
}

/**
 * Reinicia un contenedor Docker
 */
export async function restartDockerContainer(serviceName: string): Promise<boolean> {
  try {
    const containerName = SERVICE_CONTAINER_MAP[serviceName];
    if (!containerName) {
      console.error(`No container mapping found for service: ${serviceName}`);
      return false;
    }

    console.log(`Restarting Docker container: ${containerName}`);
    execSync(`docker restart ${containerName}`, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Error restarting container for ${serviceName}:`, error);
    return false;
  }
}

/**
 * Obtiene el estado de un contenedor Docker
 */
export async function getDockerContainerStatus(serviceName: string): Promise<DockerContainerStatus | null> {
  try {
    const containerName = SERVICE_CONTAINER_MAP[serviceName];
    if (!containerName) {
      console.error(`No container mapping found for service: ${serviceName}`);
      return null;
    }

    // Obtener información básica del contenedor
    const inspectOutput = execSync(`docker inspect ${containerName}`, { encoding: 'utf8' });
    const inspectData = JSON.parse(inspectOutput)[0];

    // Obtener métricas de docker stats con formato por defecto
    let statsOutput = '';
    try {
      // Usar formato por defecto que es más confiable
      statsOutput = execSync(`docker stats ${containerName} --no-stream`, { encoding: 'utf8' });
      console.log(`Docker stats output for ${containerName}:`, statsOutput);
    } catch (statsError) {
      console.warn(`Could not get stats for ${containerName}, using defaults:`, statsError);
    }

    // Parsear estado
    const state = inspectData.State;
    let status: 'running' | 'stopped' | 'exited' | 'unknown' = 'unknown';
    let uptime = 0;

    if (state.Running) {
      status = 'running';
      if (state.StartedAt) {
        const startedAt = new Date(state.StartedAt);
        uptime = Math.floor((Date.now() - startedAt.getTime()) / 1000);
      }
    } else if (state.ExitCode === 0) {
      status = 'stopped';
    } else {
      status = 'exited';
    }

    // Parsear métricas de CPU y memoria
    let cpuPercent = 0;
    let memoryMb = 0;

    if (statsOutput && statsOutput.trim()) {
      try {
        // El formato por defecto incluye headers, así que tomamos la segunda línea
        const lines = statsOutput.trim().split('\n');
        if (lines.length >= 2) {
          const dataLine = lines[1]; // Saltar header
          // Formato por defecto: "CONTAINER ID   NAME   CPU %   MEM USAGE / LIMIT   MEM %   NET I/O   BLOCK I/O   PIDS"
          // Usar regex para extraer los valores
          const cpuMatch = dataLine.match(/(\d+\.\d+)%/);
          if (cpuMatch) {
            cpuPercent = parseFloat(cpuMatch[1]);
          }

          // Extraer memoria (formato: "40.61MiB / 7.654GiB")
          const memMatch = dataLine.match(/(\d+\.\d+)MiB/);
          if (memMatch) {
            memoryMb = parseFloat(memMatch[1]);
          } else {
            // Intentar con otros formatos
            const memKbMatch = dataLine.match(/(\d+\.\d+)kB/);
            if (memKbMatch) {
              memoryMb = parseFloat(memKbMatch[1]) / 1024; // Convertir KB a MB
            }
            const memGbMatch = dataLine.match(/(\d+\.\d+)GiB/);
            if (memGbMatch) {
              memoryMb = parseFloat(memGbMatch[1]) * 1024; // Convertir GB a MB
            }
          }
        }
      } catch (parseError) {
        console.warn(`Error parsing docker stats for ${containerName}:`, parseError);
      }
    }

    console.log(`Parsed metrics for ${containerName}: CPU=${cpuPercent}%, Memory=${memoryMb}MB`);

    return {
      id: inspectData.Id,
      name: containerName,
      status,
      uptime,
      memory_mb: memoryMb,
      cpu_percent: cpuPercent
    };
  } catch (error) {
    console.error(`Error getting status for ${serviceName}:`, error);
    return null;
  }
}

/**
 * Verifica si Docker está disponible
 */
export function isDockerAvailable(): boolean {
  try {
    // Primero intentar con el comando docker directamente
    execSync('docker --version', { stdio: 'pipe' });
    return true;
  } catch (error) {
    // Si no funciona, intentar con la API HTTP de Docker
    try {
      const response = execSync('curl -s --max-time 5 http://host.docker.internal:2375/_ping', { encoding: 'utf8' });
      return response === 'OK';
    } catch (httpError) {
      return false;
    }
  }
}


/**
 * Configura el restart policy de un contenedor
 */
export async function setContainerRestartPolicy(serviceName: string, autoStart: boolean): Promise<boolean> {
  try {
    const containerName = SERVICE_CONTAINER_MAP[serviceName];
    if (!containerName) {
      console.error(`No container mapping found for service: ${serviceName}`);
      return false;
    }

    const policy = autoStart ? 'always' : 'no';
    console.log(`Setting restart policy for ${containerName} to: ${policy}`);

    execSync(`docker update --restart=${policy} ${containerName}`, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Error setting restart policy for ${serviceName}:`, error);
    return false;
  }
}

/**
 * Obtiene los últimos logs de un contenedor Docker
 * @param service_name Nombre del servicio (ej: 'LPR (Matrículas)')
 * @param lines Número de líneas de logs a obtener (default: 50)
 * @returns Array de líneas de log
 */
export async function get_docker_container_logs(service_name: string, lines: number = 50): Promise<string[]> {
  try {
    const container_name = SERVICE_CONTAINER_MAP[service_name];
    if (!container_name) {
      console.error(`No container mapping found for service: ${service_name}`);
      return [];
    }
    // Ejecutar comando docker logs
    const logs_output = execSync(`docker logs --tail ${lines} ${container_name}`, { encoding: 'utf8' });
    return logs_output.trim().split('\n');
  } catch (error) {
    console.error(`Error getting logs for ${service_name}:`, error);
    return [];
  }
}