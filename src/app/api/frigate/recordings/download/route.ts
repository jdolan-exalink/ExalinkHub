import { NextRequest, NextResponse } from 'next/server';
import { create_frigate_api } from '@/lib/frigate-api';
import { resolve_frigate_server } from '@/lib/frigate-servers';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

export async function GET(request: NextRequest) {
  try {
    console.log('=== RECORDINGS DOWNLOAD ENDPOINT ===');
    
    const { searchParams } = new URL(request.url);
    const camera = searchParams.get('camera');
    const start_time_param = searchParams.get('start_time');
    const end_time_param = searchParams.get('end_time');
    const server_id = searchParams.get('server_id');
    
    console.log('Download parameters:', { camera, start_time_param, end_time_param });
    
    if (!camera || !start_time_param || !end_time_param) {
      return NextResponse.json(
        { error: 'Camera, start_time, and end_time parameters are required' }, 
        { status: 400 }
      );
    }

    const start_time_num = parseInt(start_time_param);
    const end_time_num = parseInt(end_time_param);

    if (isNaN(start_time_num) || isNaN(end_time_num)) {
      return NextResponse.json({ 
        error: 'start_time and end_time must be valid Unix timestamps' 
      }, { status: 400 });
    }

    console.log('Downloading clip:', {
      camera,
      start_time_num,
      end_time_num,
      startISO: new Date(start_time_num * 1000).toISOString(),
      endISO: new Date(end_time_num * 1000).toISOString(),
      duration: end_time_num - start_time_num
    });

    try {
      const target_server = resolve_frigate_server(server_id);

      if (!target_server) {
        console.error('No Frigate servers available for download');
        return NextResponse.json(
          {
            error: 'No hay servidores Frigate configurados o disponibles',
            details: 'Verifica que tengas al menos un servidor Frigate configurado y habilitado en la sección de ajustes',
            camera,
            startTime: start_time_num,
            endTime: end_time_num,
            suggestion: 'Configura un servidor Frigate en Ajustes > Servidores Frigate'
          },
          { status: 503 }
        );
      }

      console.log('Using Frigate server for download:', {
        serverId: target_server.id,
        serverName: target_server.name,
        baseUrl: target_server.baseUrl
      });

      const frigate_api = create_frigate_api(target_server);

      // Verificar conectividad del servidor antes de intentar la descarga
      try {
        console.log('Verifying Frigate server connectivity...');
        const cameras = await frigate_api.getCameras();
        if (!cameras || cameras.length === 0) {
          throw new Error('Servidor Frigate no tiene cámaras configuradas');
        }
        console.log(`Frigate server connectivity OK - found ${cameras.length} cameras`);
      } catch (connectivityError) {
        console.error('Frigate server connectivity check failed:', connectivityError);
        return NextResponse.json(
          {
            error: 'Servidor Frigate no está accesible',
            details: `No se pudo conectar al servidor ${target_server.name} (${target_server.baseUrl}). ${connectivityError instanceof Error ? connectivityError.message : 'Error desconocido'}`,
            camera,
            startTime: start_time_num,
            endTime: end_time_num,
            suggestion: 'Verifica que el servidor Frigate esté ejecutándose y sea accesible desde esta aplicación'
          },
          { status: 503 }
        );
      }

      console.log('Checking for recordings in Frigate for requested range...');
      try {
        const recordings = await frigate_api.getRecordings({ camera, after: start_time_num, before: end_time_num });
        console.log('Frigate recordings found for range:', recordings.length);

        if (!recordings || recordings.length === 0) {
          console.warn('No recordings found in Frigate for the requested time range');
          return NextResponse.json(
            {
              error: 'No se encontraron grabaciones para el período seleccionado',
              details: 'Frigate indicó que no hay grabaciones para el período solicitado',
              camera,
              startTime: start_time_num,
              endTime: end_time_num,
              suggestion: 'Selecciona un período diferente o verifica que la cámara esté configurada para grabar'
            },
            { status: 404 }
          );
        }
      } catch (recError) {
        console.warn('Error checking recordings summary:', recError);
        // Continue to attempt export; the export will fail if Frigate truly has no recordings
      }

      // If caller only wants to create the export and get the link, support create_only and name params
      const create_only = searchParams.get('create_only') === 'true';
      const export_name = searchParams.get('name') || undefined;

      if (create_only) {
        console.log('create_only requested - creating export and returning links', { camera, start_time_num, end_time_num, export_name });
        try {
          const export_id = await frigate_api.startRecordingExport(camera, start_time_num, end_time_num, { name: export_name });
          const status_url = `${target_server.baseUrl.replace(/\/$/, '')}/api/export/${export_id}`;
          const download_url = `${target_server.baseUrl.replace(/\/$/, '')}/api/export/${export_id}/download`;

          return NextResponse.json({ success: true, export_id, status_url, download_url });
        } catch (createErr) {
          console.error('Failed to create export:', createErr);
          return NextResponse.json({ success: false, error: createErr instanceof Error ? createErr.message : String(createErr) }, { status: 500 });
        }
      }

      console.log('Downloading clip from Frigate...');
      let clip_blob: any;
      let clip_buffer: Buffer | undefined;
      try {
        clip_blob = await frigate_api.downloadRecordingClip(camera, start_time_num, end_time_num);
        // Normalize to Buffer if possible
        if (clip_blob && typeof clip_blob.arrayBuffer === 'function') {
          const ab = await clip_blob.arrayBuffer();
          clip_buffer = Buffer.from(ab);
        } else if (Buffer.isBuffer(clip_blob)) {
          clip_buffer = clip_blob as Buffer;
        }
      } catch (exportErr) {
        console.warn('Direct export failed, will attempt chunked export fallback:', exportErr instanceof Error ? exportErr.message : String(exportErr));

        // If Frigate reported 'No recordings found' or export failed, try chunked export
        const chunk_seconds = 300; // 5 minutes
        const temp_dir = path.join(os.tmpdir(), `frigate_export_${Date.now()}_${Math.random().toString(36).slice(2,8)}`);
        fs.mkdirSync(temp_dir, { recursive: true });
        const chunk_files: string[] = [];

        try {
          for (let s = start_time_num; s < end_time_num; s += chunk_seconds) {
            const e = Math.min(s + chunk_seconds, end_time_num);
            console.log(`Attempting chunk export ${s} -> ${e}`);
            try {
              const chunk_blob = await frigate_api.downloadRecordingClip(camera, s, e);
              const ab = await chunk_blob.arrayBuffer();
              const buf = Buffer.from(ab);
              if (buf.length > 2000) { // ensure not an error response
                const fname = path.join(temp_dir, `chunk_${s}_${e}.mp4`);
                fs.writeFileSync(fname, buf);
                chunk_files.push(fname);
                console.log('Wrote chunk file:', fname, 'size', buf.length);
              } else {
                console.log('Chunk too small, skipping:', s, e, 'size', buf.length);
              }
            } catch (chunkErr) {
              console.warn('Chunk export failed:', chunkErr instanceof Error ? chunkErr.message : String(chunkErr));
              // continue trying other chunks
            }
          }

          if (chunk_files.length === 0) {
            console.warn('No chunk files produced, aborting');
            return NextResponse.json(
              {
                error: 'No se encontraron grabaciones para el período seleccionado (intento por chunks fallido)',
                details: exportErr instanceof Error ? exportErr.message : String(exportErr),
                camera,
                startTime: start_time_num,
                endTime: end_time_num,
                suggestion: 'Selecciona un período diferente o verifica las grabaciones en Frigate'
              },
              { status: 404 }
            );
          }

          if (chunk_files.length === 1) {
            const singleBuf = fs.readFileSync(chunk_files[0]);
            clip_buffer = singleBuf;
          } else {
            // Try to concatenate using ffmpeg concat demuxer
            const list_file = path.join(temp_dir, 'inputs.txt');
            const out_file = path.join(temp_dir, 'output_concat.mp4');
            const list_content = chunk_files.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
            fs.writeFileSync(list_file, list_content);

            try {
              console.log('Running ffmpeg concat to produce', out_file);
              execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', list_file, '-c', 'copy', out_file], { stdio: 'inherit', timeout: 120000 });
              const outBuf = fs.readFileSync(out_file);
              clip_buffer = outBuf;
            } catch (ffErr) {
              console.error('FFmpeg concat failed:', ffErr instanceof Error ? ffErr.message : String(ffErr));
              // If ffmpeg failed, fall back to returning first chunk
              const firstBuf = fs.readFileSync(chunk_files[0]);
              clip_buffer = firstBuf;
            }
          }

        } finally {
          // Cleanup temp files asynchronously (best effort)
          try {
            chunk_files.forEach(f => { try { fs.unlinkSync(f); } catch(e) {} });
            try { fs.unlinkSync(path.join(temp_dir, 'inputs.txt')); } catch(e) {}
            try { fs.unlinkSync(path.join(temp_dir, 'output_concat.mp4')); } catch(e) {}
            try { fs.rmdirSync(temp_dir); } catch(e) {}
          } catch(e) {
            console.warn('Temp cleanup failed:', e instanceof Error ? e.message : String(e));
          }
        }
      }
      
      // Ensure we have a Buffer to send
      let buffer: Buffer;
      if (clip_buffer) {
        buffer = clip_buffer;
      } else if (clip_blob && typeof clip_blob.arrayBuffer === 'function') {
        const array_buffer = await clip_blob.arrayBuffer();
        buffer = Buffer.from(array_buffer);
      } else if (Buffer.isBuffer(clip_blob)) {
        buffer = clip_blob as Buffer;
      } else {
        throw new Error('Unable to normalize downloaded clip to a buffer');
      }

      console.log('Download successful:', {
        size: buffer.length,
        sizeKB: Math.round(buffer.length / 1024),
        sizeMB: Math.round(buffer.length / (1024 * 1024))
      });

      // Check if we got actual video data
      if (buffer.length < 100) {
        console.warn('Downloaded file is extremely small:', buffer.length, 'bytes - likely no recordings');
        return NextResponse.json(
          {
            error: 'No se encontraron grabaciones para el período seleccionado',
            details: `El archivo descargado es demasiado pequeño (${buffer.length} bytes), lo que indica que no hay grabaciones disponibles para este período`,
            size: buffer.length,
            camera,
            startTime: start_time_num,
            endTime: end_time_num,
            suggestion: 'Verifica que la cámara haya estado grabando durante el período seleccionado. Las grabaciones pueden haber sido eliminadas por política de retención.'
          },
          { status: 404 }
        );
      }

      // Para archivos pequeños (100-1000 bytes), asumir que son errores de Frigate pero intentar procesarlos
      if (buffer.length < 1000) {
        console.warn('Downloaded file is small:', buffer.length, 'bytes - might be an error response from Frigate');
        // No devolver error, continuar con el procesamiento
      }

      // Verificar que el contenido sea realmente un archivo MP4 válido (solo para archivos grandes)
      // Los archivos MP4 comienzan con una box 'ftyp' (file type box)
      if (buffer.length > 5000) { // Solo validar MP4 en archivos razonablemente grandes
        const firstBytes = buffer.slice(0, 8);
        const isMp4 = firstBytes.length >= 8 &&
          firstBytes[4] === 0x66 && firstBytes[5] === 0x74 && firstBytes[6] === 0x79 && firstBytes[7] === 0x70; // 'ftyp'

        if (!isMp4) {
          console.warn('Downloaded file does not appear to be a valid MP4');
          return NextResponse.json(
            {
              error: 'El archivo descargado no es un video válido',
              details: 'Frigate devolvió contenido que no corresponde a un archivo de video MP4',
              camera,
              startTime: start_time_num,
              endTime: end_time_num,
              suggestion: 'Verifica la configuración del servidor Frigate y la disponibilidad de grabaciones.'
            },
            { status: 404 }
          );
        }
      }

      // Set appropriate headers for MP4 download
      const startDate = new Date(start_time_num * 1000);
      const endDate = new Date(end_time_num * 1000);
      const filename = `${camera}_${startDate.toISOString().slice(0, 19).replace(/:/g, '-')}_to_${endDate.toISOString().slice(0, 19).replace(/:/g, '-')}.mp4`;

      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'no-cache',
        },
      });
      
    } catch (frigateError) {
      console.error('Frigate download error:', frigateError);

      // Detectar errores específicos de Frigate
      let errorMessage = 'Failed to download clip from Frigate server';
      let statusCode = 503;
      let suggestion = 'Check if Frigate server is accessible and recordings exist for this time range';

      if (frigateError instanceof Error) {
        const errorMsg = frigateError.message.toLowerCase();

        if (errorMsg.includes('failed to start export') && errorMsg.includes('400')) {
          errorMessage = 'Frigate rechazó la solicitud de exportación';
          statusCode = 400;
          suggestion = 'El período solicitado puede ser demasiado largo o Frigate tiene restricciones de exportación. Intenta con un período más corto (máximo 30 minutos).';
        } else if (errorMsg.includes('export failed') || errorMsg.includes('no recordings') || errorMsg.includes('empty')) {
          errorMessage = 'No se encontraron grabaciones para el período seleccionado';
          statusCode = 404;
          suggestion = 'Verifica que la cámara haya estado grabando durante el período seleccionado. Las grabaciones pueden haber sido eliminadas por política de retención.';
        } else if (errorMsg.includes('timeout') || errorMsg.includes('took too long')) {
          errorMessage = 'La exportación de grabaciones tardó demasiado tiempo';
          suggestion = 'Intenta con un período más corto o verifica el estado del servidor Frigate.';
        } else if (errorMsg.includes('failed to get export id')) {
          errorMessage = 'No se pudieron iniciar las grabaciones para exportación';
          statusCode = 404;
          suggestion = 'Es posible que no haya grabaciones disponibles para este período. Verifica la configuración de grabación de la cámara.';
        }
      }

      return NextResponse.json(
        {
          error: errorMessage,
          details: frigateError instanceof Error ? frigateError.message : 'Unknown Frigate error',
          camera,
          startTime: start_time_num,
          endTime: end_time_num,
          suggestion
        },
        { status: statusCode }
      );
    }
    
  } catch (error) {
    console.error('Error downloading clip:', error);
    return NextResponse.json(
      { error: `Failed to download recording clip: ${error instanceof Error ? error.message : 'Unknown error'}` }, 
      { status: 500 }
    );
  }
}
