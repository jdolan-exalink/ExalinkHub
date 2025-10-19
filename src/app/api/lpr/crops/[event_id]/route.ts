/**
 * Endpoint para descargar crops de matrículas vía SSH
 * GET /api/lpr/crops/[event_id] - Descarga crop de matrícula desde servidor remoto
 *
 * Este endpoint se conecta vía SSH al servidor Frigate configurado
 * y descarga el archivo de crop correspondiente al evento.
 */

import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';

/**
 * GET /api/lpr/crops/[event_id]
 * Descarga crop de matrícula vía SSH
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ event_id: string }> }
) {
  try {
    const { event_id } = await params;

    if (!event_id) {
      return NextResponse.json(
        { error: 'ID de evento requerido' },
        { status: 400 }
      );
    }

    console.log(`🔍 Solicitando crop para evento: ${event_id}`);

    // Obtener configuración LPR
    const lpr_config = await get_lpr_backend_config();
    if (!lpr_config?.enabled) {
      return NextResponse.json(
        { error: 'Backend LPR no está habilitado' },
        { status: 503 }
      );
    }

    const config = JSON.parse(lpr_config.config);

    // Verificar configuración SSH
    const ssh_host = config.frigate_host || 'localhost';
    const ssh_username = config.ssh_username || 'frigate';
    const ssh_password = config.ssh_password || 'frigate123';
    const ssh_clips_path = config.ssh_clips_path || '/media/frigate/clips';

    if (!ssh_host || !ssh_username || !ssh_password) {
      return NextResponse.json(
        {
          error: 'Configuración SSH incompleta',
          details: 'Verifica la configuración de SSH en Ajustes LPR Avanzados',
          required_fields: ['frigate_host', 'ssh_username', 'ssh_password']
        },
        { status: 400 }
      );
    }

    console.log(`🔗 Conectando SSH: ${ssh_username}@${ssh_host} para crop ${event_id}`);

    // Construir ruta del crop en el servidor remoto
    // Los crops suelen estar en una estructura como: /media/frigate/clips/camera/date/event_id-crop.jpg
    let remote_crop_path = `${ssh_clips_path}/crops/${event_id}-crop.jpg`;

    try {
      // Verificar que el archivo existe en el servidor remoto
      const check_command = `sshpass -p "${ssh_password}" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${ssh_username}@${ssh_host} "test -f '${remote_crop_path}' && echo 'EXISTS' || echo 'NOT_FOUND'"`;

      console.log(`🔍 Verificando existencia del crop: ${remote_crop_path}`);

      const check_result = execSync(check_command, {
        encoding: 'utf8',
        timeout: 15000,
        stdio: 'pipe'
      }).trim();

      if (check_result !== 'EXISTS') {
        console.log(`❌ Crop no encontrado: ${remote_crop_path}`);

        // Intentar rutas alternativas comunes
        const alternative_paths = [
          `${ssh_clips_path}/${event_id}-crop.jpg`,
          `${ssh_clips_path}/crops/${event_id}.jpg`,
          `${ssh_clips_path}/${event_id}.jpg`
        ];

        let found_path = null;
        for (const alt_path of alternative_paths) {
          console.log(`🔍 Probando ruta alternativa: ${alt_path}`);
          const alt_check = `sshpass -p "${ssh_password}" ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 ${ssh_username}@${ssh_host} "test -f '${alt_path}' && echo 'EXISTS' || echo 'NOT_FOUND'"`;

          try {
            const alt_result = execSync(alt_check, {
              encoding: 'utf8',
              timeout: 10000,
              stdio: 'pipe'
            }).trim();

            if (alt_result === 'EXISTS') {
              found_path = alt_path;
              console.log(`✅ Crop encontrado en ruta alternativa: ${alt_path}`);
              break;
            }
          } catch (error) {
            // Continuar con la siguiente ruta
          }
        }

        if (!found_path) {
          return NextResponse.json(
            {
              error: 'Crop no encontrado en el servidor',
              event_id,
              searched_paths: [remote_crop_path, ...alternative_paths],
              suggestion: 'Verifica que el evento tenga un crop disponible y que la configuración SSH sea correcta'
            },
            { status: 404 }
          );
        }

        remote_crop_path = found_path;
      }

      console.log(`📥 Descargando crop: ${remote_crop_path}`);

      // Descargar el archivo vía SCP
      const download_command = `sshpass -p "${ssh_password}" scp -o StrictHostKeyChecking=no -o ConnectTimeout=10 ${ssh_username}@${ssh_host}:"${remote_crop_path}" /tmp/${event_id}-crop.jpg`;

      execSync(download_command, {
        encoding: 'utf8',
        timeout: 30000,
        stdio: 'pipe'
      });

      console.log(`✅ Crop descargado exitosamente: /tmp/${event_id}-crop.jpg`);

      // Leer el archivo y devolverlo
      const fs = require('fs');
      const path = require('path');

      const local_path = path.join('/tmp', `${event_id}-crop.jpg`);

      if (!fs.existsSync(local_path)) {
        throw new Error('Archivo no encontrado después de descarga');
      }

      const file_buffer = fs.readFileSync(local_path);

      // Limpiar archivo temporal
      try {
        fs.unlinkSync(local_path);
      } catch (cleanup_error) {
        console.warn(`⚠️ No se pudo limpiar archivo temporal: ${cleanup_error}`);
      }

      console.log(`📤 Enviando crop de ${file_buffer.length} bytes`);

      // Devolver el archivo con headers apropiados
      return new NextResponse(file_buffer, {
        status: 200,
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Disposition': `inline; filename="${event_id}-crop.jpg"`,
          'Cache-Control': 'public, max-age=3600', // Cache por 1 hora
          'Content-Length': file_buffer.length.toString()
        }
      });

    } catch (ssh_error: any) {
      console.error('❌ Error en conexión SSH:', ssh_error);

      // Generar comandos de ayuda para el usuario
      const setup_commands = [
        `# 1. Instalar sshpass si no está instalado`,
        `sudo apt-get update && sudo apt-get install -y sshpass`,
        ``,
        `# 2. Crear usuario SSH si no existe`,
        `sudo useradd -m -s /bin/bash ${ssh_username}`,
        `sudo usermod -aG docker ${ssh_username}  # Si necesita acceso a Docker`,
        ``,
        `# 3. Configurar permisos para directorio de clips`,
        `sudo mkdir -p ${ssh_clips_path}`,
        `sudo chown -R ${ssh_username}:${ssh_username} ${ssh_clips_path}`,
        `sudo chmod -R 755 ${ssh_clips_path}`,
        ``,
        `# 4. Configurar SSH sin contraseña para el usuario`,
        `sudo -u ${ssh_username} ssh-keygen -t rsa -b 2048 -f /home/${ssh_username}/.ssh/id_rsa -N ""`,
        `sudo -u ${ssh_username} ssh-copy-id ${ssh_username}@localhost`,
        ``,
        `# 5. Probar conexión SSH`,
        `sshpass -p "${ssh_password}" ssh -o StrictHostKeyChecking=no ${ssh_username}@${ssh_host} "echo 'SSH funcionando'"`,
        ``,
        `# 6. Verificar permisos de archivos`,
        `sshpass -p "${ssh_password}" ssh ${ssh_username}@${ssh_host} "ls -la ${ssh_clips_path}/crops/"`
      ];

      return NextResponse.json(
        {
          error: 'Error accediendo al servidor SSH',
          event_id,
          ssh_error: ssh_error.message,
          setup_commands: setup_commands,
          troubleshooting: [
            '1. Verifica que SSH esté habilitado en el servidor Frigate',
            '2. Confirma las credenciales SSH en Ajustes LPR Avanzados',
            '3. Asegúrate de que el usuario tenga permisos de lectura en el directorio de clips',
            '4. Ejecuta los comandos de configuración arriba si es necesario'
          ]
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('❌ Error procesando solicitud de crop:', error);

    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error.message,
        event_id: await params.then(p => p.event_id)
      },
      { status: 500 }
    );
  }
}

/**
 * Obtener configuración del backend LPR
 */
async function get_lpr_backend_config() {
  const config_db = (await import('@/lib/config-database')).default;
  const db = new config_db();
  return db.getBackendConfigByService('LPR (Matrículas)');
}