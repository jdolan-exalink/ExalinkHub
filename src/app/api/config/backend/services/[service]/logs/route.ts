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
      // Usar comando docker directamente
      const command = tail
        ? `docker logs --tail ${lines} ${containerName} 2>&1`
        : `docker logs ${containerName} 2>&1 | tail -n ${lines}`;

      console.log(`Ejecutando comando: ${command}`);

      const logsOutput = execSync(command, {
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      });

      return NextResponse.json({
        service,
        container: containerName,
        logs: logsOutput.trim(),
        lines: lines,
        tail,
        timestamp: new Date().toISOString()
      });
    } catch (execError: any) {
      console.error('Error ejecutando comando docker:', execError);

      // Si el contenedor no existe
      if (execError.stderr && execError.stderr.includes('No such container')) {
        return NextResponse.json(
          {
            service,
            container: containerName,
            logs: 'Contenedor no encontrado o no está ejecutándose',
            lines: 0,
            tail: true,
            timestamp: new Date().toISOString()
          },
          { status: 404 }
        );
      }

      // Si docker no está disponible, intentar con curl a la API de Docker
      try {
        console.log('Intentando con Docker API via curl...');
        const apiCommand = `curl -s --unix-socket /var/run/docker.sock "http://localhost/containers/${containerName}/logs?stdout=1&stderr=1${tail ? `&tail=${lines}` : ''}&follow=0"`;

        const apiLogsOutput = execSync(apiCommand, {
          encoding: 'utf8',
          timeout: 10000,
          maxBuffer: 1024 * 1024 * 10
        });

        return NextResponse.json({
          service,
          container: containerName,
          logs: apiLogsOutput.trim(),
          lines: lines,
          tail,
          timestamp: new Date().toISOString()
        });
      } catch (apiError: any) {
        console.error('Error con Docker API:', apiError);

        return NextResponse.json(
          {
            service,
            container: containerName,
            logs: 'No se pudieron obtener los logs. Verifique que Docker esté disponible.',
            lines: 0,
            tail: true,
            timestamp: new Date().toISOString()
          },
          { status: 500 }
        );
      }
    }

  } catch (error: any) {
    console.error('Error obteniendo logs:', error);

    return NextResponse.json(
      { error: 'Error interno del servidor al obtener logs' },
      { status: 500 }
    );
  }
}