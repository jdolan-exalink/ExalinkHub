/**
 * API proxy para archivos multimedia del backend LPR
 * GET /api/lpr/files/media/[...path]
 * 
 * Este endpoint hace proxy a http://localhost:2221/media/[...path]
 * permitiendo acceder a snapshots, clips y crops desde el frontend.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: filePath } = await context.params;
    
    // Construir URL del backend LPR
    const backend_path = filePath.join('/');
    const backend_url = `http://matriculas-listener:2221/media/${backend_path}`;
    
    console.log(`📡 Proxy LPR media: ${backend_url}`);

    // Hacer petición al backend LPR
    const response = await fetch(backend_url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from('admin:exalink2024').toString('base64')}`
      },
      signal: AbortSignal.timeout(30000) // 30 segundos timeout
    });

    if (!response.ok) {
      console.error(`❌ Backend LPR media error: ${response.status}`);
      return NextResponse.json(
        { error: 'Archivo no encontrado en backend LPR' },
        { status: response.status }
      );
    }

    // Obtener el buffer del archivo
    const buffer = await response.arrayBuffer();
    
    // Determinar content type desde la respuesta del backend o por extensión
    let content_type = response.headers.get('content-type') || 'application/octet-stream';
    
    // Si no hay content-type, inferir de la extensión
    if (content_type === 'application/octet-stream') {
      const extension = backend_path.split('.').pop()?.toLowerCase();
      switch (extension) {
        case 'jpg':
        case 'jpeg':
          content_type = 'image/jpeg';
          break;
        case 'png':
          content_type = 'image/png';
          break;
        case 'mp4':
          content_type = 'video/mp4';
          break;
        case 'webm':
          content_type = 'video/webm';
          break;
      }
    }

    // Preparar headers de respuesta
    const headers = new Headers({
      'Content-Type': content_type,
      'Content-Length': buffer.byteLength.toString(),
      'Cache-Control': 'public, max-age=3600', // Cache por 1 hora
    });

    // Si es un video, agregar soporte para range requests
    if (content_type.startsWith('video/')) {
      headers.set('Accept-Ranges', 'bytes');
    }

    console.log(`✅ Archivo servido: ${backend_path} (${content_type}, ${buffer.byteLength} bytes)`);

    return new NextResponse(buffer, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error('❌ Error en proxy LPR media:', error);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Timeout al obtener archivo del backend LPR' },
          { status: 504 }
        );
      }

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
