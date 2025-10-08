/**
 * API para servir archivos LPR almacenados localmente
 * GET /api/lpr/files/[type]/[...path]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLPRFileManager } from '@/lib/lpr-file-manager';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { type: string; path: string[] } }
) {
  try {
    const { type, path: filePath } = await params;
    const fileManager = getLPRFileManager();

    // Validar tipo
    if (!['snapshot', 'clip', 'crop'].includes(type)) {
      return NextResponse.json({ error: 'Tipo de archivo inválido' }, { status: 400 });
    }

    // Construir ruta absoluta
    const relativePath = filePath.join('/');
    const fullUrl = `/api/lpr/files/${type}/${relativePath}`;
    const absolutePath = fileManager.getAbsolutePathFromUrl(fullUrl);

    if (!absolutePath) {
      return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 });
    }

    // Verificar que el archivo existe
    if (!fs.existsSync(absolutePath)) {
      return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
    }

    // Verificar que está dentro del directorio permitido
    const baseDir = path.join(process.cwd(), 'data', 'lpr-files');
    const resolvedPath = path.resolve(absolutePath);
    const resolvedBaseDir = path.resolve(baseDir);

    if (!resolvedPath.startsWith(resolvedBaseDir)) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    // Leer archivo
    const fileBuffer = fs.readFileSync(absolutePath);
    const stats = fs.statSync(absolutePath);

    // Determinar content type
    const extension = path.extname(absolutePath).toLowerCase();
    let contentType = 'application/octet-stream';

    switch (extension) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.mp4':
        contentType = 'video/mp4';
        break;
      case '.webm':
        contentType = 'video/webm';
        break;
    }

    // Headers de respuesta
    const headers = new Headers({
      'Content-Type': contentType,
      'Content-Length': stats.size.toString(),
      'Cache-Control': 'public, max-age=86400', // Cache por 24 horas
      'Last-Modified': stats.mtime.toUTCString(),
    });

    // Soporte para descargas
    const download = request.nextUrl.searchParams.get('download');
    if (download === '1') {
      const fileName = path.basename(absolutePath);
      headers.set('Content-Disposition', `attachment; filename="${fileName}"`);
    }

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('Error sirviendo archivo LPR:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}