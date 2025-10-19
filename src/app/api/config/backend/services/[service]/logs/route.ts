import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

/**
 * Endpoint: /api/config/backend/services/[service]/logs
 * Obtiene los logs del contenedor Docker correspondiente al servicio
 *
 * Implementación:
 * - Valida que el servicio sea válido (lpr, counting, notifications)
 * - Usa la API HTTP de Docker para obtener logs del contenedor
 * - Limita la cantidad de líneas para evitar respuestas muy grandes
 * - Devuelve los logs en formato JSON
 *
 * Parámetros de query:
 * - lines: número de líneas a obtener (por defecto 100, máximo 1000)
 * - tail: obtener solo las últimas líneas (true/false, por defecto true)
 *
 * Ejemplo de respuesta:
 * {
 *   "service": "lpr",
 *   "container": "exalink-lpr-backend",
 *   "logs": "2025-10-08 14:00:00 INFO Starting LPR service...\n...",
 *   "lines": 100,
 *   "timestamp": "2025-10-08T17:00:00Z"
 * }
 */

const SERVICE_CONTAINER_MAP: Record<string, string> = {
  'lpr': 'exalink-lpr-backend',
  'counting': 'exalink-conteo-backend',
  'notifications': 'exalink-notificaciones-backend'
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ service: string }> }
) {
  try {
    const { service } = await params;

    // Validar servicio
    if (!['lpr', 'counting', 'notifications'].includes(service)) {
      return NextResponse.json(
        { error: 'Servicio no válido' },
        { status: 400 }
      );
    }

    const containerName = SERVICE_CONTAINER_MAP[service];
    if (!containerName) {
      return NextResponse.json(
        { error: 'Contenedor no encontrado para el servicio' },
        { status: 404 }
      );
    }

    // Obtener parámetros de query
    const { searchParams } = new URL(request.url);
    const lines = Math.min(parseInt(searchParams.get('lines') || '100'), 1000); // Máximo 1000 líneas
    const tail = searchParams.get('tail') !== 'false'; // Por defecto true

    console.log(`Obteniendo logs para ${service} (${containerName}): líneas=${lines}, tail=${tail}`);

    try {
      // Verificar si Docker está disponible
      execSync('docker --version', { 
        encoding: 'utf8',
        timeout: 3000,
        stdio: 'pipe',
        windowsHide: true
      });
      console.log('✅ Docker está disponible');

      // Verificar si el contenedor existe
      const inspectCommand = `docker inspect ${containerName}`;
      execSync(inspectCommand, {
        encoding: 'utf8',
        timeout: 3000,
        stdio: 'pipe',
        windowsHide: true
      });
      console.log(`✅ Contenedor ${containerName} existe`);

      // Obtener logs del contenedor
      const command = `docker logs --tail ${lines} ${containerName} 2>&1`;
      console.log(`Ejecutando comando: ${command}`);

      const logsOutput = execSync(command, {
        encoding: 'utf8',
        timeout: 15000,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        stdio: 'pipe',
        windowsHide: true
      });

      // Verificar si la salida contiene errores comunes
      if (logsOutput.includes('docker: command not found') || logsOutput.includes('docker is not recognized')) {
        throw new Error('Docker no está instalado o no está en PATH');
      }

      if (logsOutput.includes('No such container') || logsOutput.includes('container does not exist')) {
        throw new Error(`Contenedor '${containerName}' no existe`);
      }

      return NextResponse.json({
        service,
        container: containerName,
        logs: logsOutput.trim() || 'El contenedor no tiene logs disponibles.',
        lines: lines,
        tail,
        timestamp: new Date().toISOString()
      });

    } catch (execError: any) {
      console.error('Error ejecutando comando docker:', execError);

      // Determinar el tipo de error y dar mensaje específico
      let error_message = 'Error desconocido al obtener logs';
      let status_code = 500;

      if (execError.message?.includes('command not found') || execError.message?.includes('not recognized')) {
        error_message = 'Docker no está instalado o no está disponible en el sistema. Verifica que Docker Desktop esté ejecutándose.';
        status_code = 503;
      } else if (execError.message?.includes('No such container') || execError.message?.includes('does not exist')) {
        error_message = `El contenedor '${containerName}' no existe. El servicio no está desplegado o fue eliminado.`;
        status_code = 404;
      } else if (execError.message?.includes('timeout')) {
        error_message = 'Timeout obteniendo logs del contenedor. El contenedor puede estar ocupado o los logs son muy grandes.';
        status_code = 504;
      } else if (execError.code === 'ENOBUFS' || execError.message?.includes('maxBuffer')) {
        error_message = 'Los logs del contenedor son demasiado grandes. Intenta con menos líneas (lines=50).';
        status_code = 413;
      } else {
        error_message = `Error al obtener logs: ${execError.message || 'Error desconocido'}`;
      }

      return NextResponse.json(
        {
          service,
          container: containerName,
          logs: error_message,
          lines: 0,
          tail: true,
          timestamp: new Date().toISOString(),
          error: execError.code || 'execution_error'
        },
        { status: status_code }
      );
    }

  } catch (error: any) {
    console.error('Error obteniendo logs:', error);

    return NextResponse.json(
      { error: 'Error interno del servidor al obtener logs' },
      { status: 500 }
    );
  }
}