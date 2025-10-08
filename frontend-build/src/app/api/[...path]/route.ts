import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const path = resolvedParams.path.join('/');
    const searchParams = request.nextUrl.searchParams;
    const queryString = searchParams.toString();
    
    // Solo manejar rutas específicas de streaming
    if (!path.includes('/live/playlist.m3u8') && !path.includes('.ts')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 404 });
    }
    
    // URL base de Frigate
    const frigateUrl = `http://10.1.1.252:5000/api/${path}${queryString ? `?${queryString}` : ''}`;
    
    console.log(`🔄 Frigate Proxy: ${frigateUrl}`);
    
    // Hacer petición a Frigate
    const response = await fetch(frigateUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/vnd.apple.mpegurl,application/x-mpegURL,application/octet-stream',
      },
    });
    
    if (!response.ok) {
      console.warn(`❌ Frigate Proxy error: ${response.status} for ${frigateUrl}`);
      return NextResponse.json(
        { error: 'Stream not available' }, 
        { status: response.status }
      );
    }
    
    const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl';
    const content = await response.arrayBuffer();
    
    console.log(`✅ Frigate Proxy success: ${frigateUrl} (${content.byteLength} bytes)`);
    
    // Retornar con headers CORS apropiados
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
    
  } catch (error) {
    console.error('Frigate Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}