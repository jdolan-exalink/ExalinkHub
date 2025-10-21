import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { service: string } }
) {
  try {
    const { service } = params;

    // Para el servicio LPR, leer directamente del archivo de logs
    if (service.toLowerCase().includes('lpr') || service.toLowerCase() === 'lpr') {
      try {
        const fs = require('fs');
        const path = require('path');

        // En desarrollo, los logs están montados en el contenedor
        const logFilePath = path.join(process.cwd(), 'backend', 'Matriculas', 'LOG', 'listener.log');

        if (!fs.existsSync(logFilePath)) {
          return NextResponse.json({
            service,
            container: 'file-based',
            logs: `Archivo de logs no encontrado en ${logFilePath}. El servicio puede no haber generado logs aún.`,
            lines: 0,
            tail: true,
            timestamp: new Date().toISOString()
          });
        }

        const content = fs.readFileSync(logFilePath, 'utf8');

        if (!content || !content.trim()) {
          return NextResponse.json({
            service,
            container: 'file-based',
            logs: 'El archivo de logs está vacío.',
            lines: 0,
            tail: true,
            timestamp: new Date().toISOString()
          });
        }

        // Obtener las últimas 100 líneas
        const allLines = content.split('\n').filter((line: string) => line.trim());
        const startIndex = Math.max(0, allLines.length - 100);
        const selectedLines = allLines.slice(startIndex);
        const logsContent = selectedLines.join('\n');

        return NextResponse.json({
          service,
          container: 'file-based',
          logs: logsContent || 'No hay contenido en las líneas solicitadas.',
          lines: selectedLines.length,
          tail: true,
          timestamp: new Date().toISOString()
        });

      } catch (fileError: any) {
        console.error('[LOGS API] Error reading LPR log file:', fileError);
        return NextResponse.json(
          {
            service,
            container: 'file-based',
            logs: `Error al leer el archivo de logs: ${fileError.message}`,
            lines: 0,
            tail: true,
            timestamp: new Date().toISOString(),
            error: 'file_read_error'
          },
          { status: 500 }
        );
      }
    }

    // Para otros servicios, intentar obtener logs de Docker
    try {
      const { get_docker_container_logs } = require('@/lib/docker-utils');
      const logs = await get_docker_container_logs(service, 50);

      if (logs && logs.length > 0) {
        return NextResponse.json({
          service,
          container: 'docker',
          logs: logs.join('\n'),
          lines: logs.length,
          tail: true,
          timestamp: new Date().toISOString()
        });
      } else {
        return NextResponse.json({
          service,
          container: 'docker',
          logs: `No se pudieron obtener logs del contenedor para ${service}. El contenedor puede no estar ejecutándose o no tener logs disponibles.`,
          lines: 0,
          tail: true,
          timestamp: new Date().toISOString()
        });
      }
    } catch (dockerError: any) {
      console.error('[LOGS API] Error getting Docker logs:', dockerError);
      return NextResponse.json({
        service,
        container: 'docker',
        logs: `Error al obtener logs de Docker para ${service}: ${dockerError.message}`,
        lines: 0,
        tail: true,
        timestamp: new Date().toISOString(),
        error: 'docker_error'
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('Error obteniendo logs:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor al obtener logs' },
      { status: 500 }
    );
  }
}