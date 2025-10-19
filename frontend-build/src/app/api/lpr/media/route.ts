/**
 * Servir archivos de medios de Matriculas desde backend/Matriculas/MEDIA
 * GET /api/lpr/media?path=<relative_path>
 * - path: ruta relativa dentro de MEDIA (por ejemplo: "principal/2025-10-18/cam1/abc_snapshot.jpg")
 *
 * Seguridad:
 * - Valida que la ruta permanezca dentro del directorio MEDIA.
 * - No permite path traversal.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * Determina el content-type a partir de la extensión
 */
function get_mime_type(file_path: string): string {
  const ext = path.extname(file_path).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.mov') return 'video/quicktime';
  if (ext === '.avi') return 'video/x-msvideo';
  return 'application/octet-stream';
}

/**
 * GET /api/lpr/media
 * Sirve un archivo desde MEDIA con validación de ruta
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const relative_path = searchParams.get('path');

    if (!relative_path) {
      return NextResponse.json({ error: 'path es requerido' }, { status: 400 });
    }

    // Base: MEDIA/
    let base_dir = path.join(process.cwd(), 'MEDIA');
    if (!fs.existsSync(base_dir)) {
      const alt = path.join('/app', 'MEDIA');
      if (fs.existsSync(alt)) base_dir = alt;
    }
    const normalized = path.normalize(relative_path).replace(/^([/\\])+/, '');
    const absolute_path = path.resolve(base_dir, normalized);

    // Validar que absolute_path permanezca dentro de base_dir
    if (!absolute_path.startsWith(path.resolve(base_dir) + path.sep) && path.resolve(base_dir) !== absolute_path) {
      return NextResponse.json({ error: 'Ruta inválida' }, { status: 400 });
    }

    try {
      if (!fs.existsSync(absolute_path)) {
        return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
      }
      const stat = fs.statSync(absolute_path);
      if (!stat.isFile()) {
        return NextResponse.json({ error: 'No es un archivo' }, { status: 404 });
      }
      const mime = get_mime_type(absolute_path);
      const data = fs.readFileSync(absolute_path);
      return new NextResponse(data, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Content-Length': stat.size.toString(),
          'Cache-Control': 'public, max-age=3600'
        }
      });
    } catch (e: any) {
      if (e && (e.code === 'ENOENT' || e.code === 'ENOTDIR')) {
        return NextResponse.json({ error: 'Archivo no encontrado' }, { status: 404 });
      }
      console.error('[MEDIA] Error sirviendo archivo:', absolute_path, e?.message || e);
      return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Error interno' }, { status: 500 });
  }
}
