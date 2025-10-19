/**
 * Servir archivos multimedia del backend LPR
 * GET /api/lpr/media/{event_id}/snapshot.jpg
 * GET /api/lpr/media/{event_id}/clip.mp4
 * GET /api/lpr/media/{event_id}/crop.jpg
 *
 * Este endpoint consulta el backend LPR para obtener la ruta del archivo
 * y luego lo sirve desde el sistema de archivos.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Determina el content-type a partir del tipo de archivo
 */
function get_mime_type(file_type: string): string {
  if (file_type === 'snapshot' || file_type === 'crop') return 'image/jpeg';
  if (file_type === 'clip') return 'video/mp4';
  return 'application/octet-stream';
}

/**
 * GET /api/lpr/media/{event_id}/{file_type}.{ext}
 * Sirve un archivo multimedia específico de un evento
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { event_id: string } }
) {
  try {
    const eventId = parseInt(params.event_id);
    if (isNaN(eventId)) {
      return NextResponse.json({ error: 'ID de evento inválido' }, { status: 400 });
    }

    // Extraer tipo de archivo de la URL
    const url = new URL(request.url);
    const pathname = url.pathname;
    let fileType: string | null = null;

    if (pathname.includes('/snapshot.jpg')) {
      fileType = 'snapshot';
    } else if (pathname.includes('/clip.mp4')) {
      fileType = 'clip';
    } else if (pathname.includes('/crop.jpg')) {
      fileType = 'crop';
    }

    if (!fileType) {
      return NextResponse.json({ error: 'Tipo de archivo no reconocido' }, { status: 400 });
    }

    console.log(`🎬 Solicitando ${fileType} para evento ${eventId}`);

    // Consultar el backend LPR para obtener la información del evento
    const backendUrl = `http://localhost:2221/api/events/${eventId}`;

    // Agregar autenticación Basic Auth
    const authUser = process.env.LPR_API_USER || 'admin';
    const authPass = process.env.LPR_API_PASSWORD || 'exalink2024';
    const authHeader = 'Basic ' + Buffer.from(`${authUser}:${authPass}`).toString('base64');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error(`❌ Error consultando backend LPR para evento ${eventId}:`, response.status);
      return NextResponse.json({ error: 'Evento no encontrado' }, { status: 404 });
    }

    const eventData = await response.json();

    // Determinar el campo de path según el tipo de archivo
    let filePath: string | null = null;
    if (fileType === 'snapshot' && eventData.snapshot_path) {
      filePath = eventData.snapshot_path;
    } else if (fileType === 'clip' && eventData.clip_path) {
      filePath = eventData.clip_path;
    } else if (fileType === 'crop' && eventData.crop_path) {
      filePath = eventData.crop_path;
    }

    if (!filePath) {
      console.log(`⚠️ Archivo ${fileType} no disponible para evento ${eventId}`);
      return NextResponse.json({ error: 'Archivo no disponible' }, { status: 404 });
    }

    console.log(`📁 Path del archivo: ${filePath}`);

    // Determinar la ruta base donde están los archivos
    // El backend LPR guarda los archivos en /app/data/ dentro del contenedor
    // Que se mapea a ./data/ en el host
    let baseDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(baseDir)) {
      // Intentar con la ruta del contenedor
      baseDir = path.join('/app', 'data');
      if (!fs.existsSync(baseDir)) {
        console.error(`❌ Directorio base no encontrado: ${baseDir}`);
        return NextResponse.json({ error: 'Directorio de archivos no encontrado' }, { status: 500 });
      }
    }

    // Normalizar la ruta del archivo
    const normalizedPath = path.normalize(filePath).replace(/^([/\\])+/, '');
    const absolutePath = path.resolve(baseDir, normalizedPath);

    // Validar que la ruta esté dentro del directorio base
    if (!absolutePath.startsWith(path.resolve(baseDir) + path.sep) && path.resolve(baseDir) !== absolutePath) {
      console.error(`🚫 Intento de acceso no autorizado: ${absolutePath}`);
      return NextResponse.json({ error: 'Acceso no autorizado' }, { status: 403 });
    }

    // Verificar que el archivo existe
    if (!fs.existsSync(absolutePath)) {
      console.log(`⚠️ Archivo no encontrado: ${absolutePath}`);
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    // Verificar que es un archivo
    const stat = fs.statSync(absolutePath);
    if (!stat.isFile()) {
      console.error(`❌ No es un archivo: ${absolutePath}`);
      return NextResponse.json({ error: 'No es un archivo válido' }, { status: 404 });
    }

    console.log(`✅ Sirviendo archivo: ${absolutePath} (${stat.size} bytes)`);

    // Leer y servir el archivo
    const mimeType = get_mime_type(fileType);
    const fileData = fs.readFileSync(absolutePath);
    const uint8Array = new Uint8Array(fileData);

    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'public, max-age=3600',
        'Content-Disposition': `inline; filename="${fileType}_${eventId}${fileType === 'clip' ? '.mp4' : '.jpg'}"`
      }
    });

  } catch (error: any) {
    console.error('❌ Error sirviendo archivo multimedia:', error);

    if (error?.name === 'AbortError') {
      return NextResponse.json({ error: 'Timeout consultando backend' }, { status: 504 });
    }

    return NextResponse.json(
      { error: error?.message || 'Error interno del servidor' },
      { status: 500 }
    );
  }
}