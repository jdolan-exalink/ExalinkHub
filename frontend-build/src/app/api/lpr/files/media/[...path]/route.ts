/**
 * API proxy para archivos multimedia del backend LPR
 * GET /api/lpr/files/media/[...path]
 * 
 * Este endpoint hace proxy a la URL configurada del backend LPR /media/[...path]
 * permitiendo acceder a snapshots, clips y crops desde el frontend.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLPRBackendURL } from '@/lib/lpr-backend-config';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: filePath } = await context.params;
    
    // Construir URL del backend LPR usando configuración dinámica
    const backend_path = filePath.join('/');
    const lpr_base_url = await getLPRBackendURL();
    const backend_url = `${lpr_base_url}/media/${backend_path}`;
    
    console.log(`📡 Proxy LPR media: ${backend_url}`);

    // Hacer petición al backend LPR
    // Intentar obtener credenciales desde la configuración de backend si existe
    let auth_header = null;
    try {
      const ConfigDatabase = (await import('@/lib/config-database')).default;
      const cfg_db = new ConfigDatabase();
  const backend_cfg = cfg_db.getBackendConfigByService('LPR (Matrículas)');
      if (backend_cfg && backend_cfg.config) {
        try {
          const parsed = JSON.parse(backend_cfg.config);
          const user = parsed.api_user || process.env.LPR_API_USER || 'admin';
          const pass = parsed.api_password || process.env.LPR_API_PASSWORD || 'exalink2024';
          auth_header = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
        } catch (e) {
          // Si config no es JSON, ignorar y usar env vars
        }
      }
    } catch (cfgErr) {
      // Si falla leer DB de configuración, usar variables de entorno o fallback
      // console.warn('No se pudo leer backend_config, usando env vars', cfgErr);
    }

    if (!auth_header) {
      const user = process.env.LPR_API_USER || 'admin';
      const pass = process.env.LPR_API_PASSWORD || 'exalink2024';
      auth_header = 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
    }

    const response = await fetch(backend_url, {
      method: 'GET',
      headers: {
        'Authorization': auth_header
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
