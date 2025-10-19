/**
 * Endpoint para servir archivos multimedia desde MEDIA/
 * GET /api/files/[...path] - Sirve archivos desde el directorio MEDIA
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = params.path.join('/');

    // Ruta base del directorio MEDIA
    const mediaDir = path.join(process.cwd(), 'MEDIA');

    // Construir ruta completa del archivo
    const fullPath = path.join(mediaDir, filePath);

    // Verificar que el archivo existe y está dentro del directorio MEDIA
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json(
        { error: 'Archivo no encontrado' },
        { status: 404 }
      );
    }

    // Verificar que la ruta resuelta está dentro del directorio MEDIA (seguridad)
    const resolvedPath = path.resolve(fullPath);
    const resolvedMediaDir = path.resolve(mediaDir);

    if (!resolvedPath.startsWith(resolvedMediaDir)) {
      return NextResponse.json(
        { error: 'Acceso denegado' },
        { status: 403 }
      );
    }

    // Obtener información del archivo
    const stat = fs.statSync(fullPath);

    // Determinar el tipo de contenido basado en la extensión
    const ext = path.extname(fullPath).toLowerCase();
    let contentType = 'application/octet-stream';

    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.gif':
        contentType = 'image/gif';
        break;
      case '.mp4':
        contentType = 'video/mp4';
        break;
      case '.webm':
        contentType = 'video/webm';
        break;
      case '.avi':
        contentType = 'video/x-msvideo';
        break;
    }

    // Leer el archivo
    const fileBuffer = fs.readFileSync(fullPath);
    const uint8Array = new Uint8Array(fileBuffer);

    // Devolver el archivo con los headers apropiados
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': stat.size.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache por 1 hora
      },
    });

  } catch (error) {
    console.error('Error sirviendo archivo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}