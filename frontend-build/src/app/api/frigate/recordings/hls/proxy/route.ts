import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('=== HLS PROXY ENDPOINT ===');
  
  try {
    const { searchParams } = new URL(request.url);
    const camera = searchParams.get('camera');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    const file = searchParams.get('file') || 'master.m3u8';

    console.log('HLS Proxy parameters:', { camera, start, end, file });

    if (!camera || !start || !end) {
      return NextResponse.json(
        { error: 'Missing required parameters: camera, start, end' },
        { status: 400 }
      );
    }

    // Construct Frigate VOD URL
    const frigateUrl = `http://10.1.1.252:5000/vod/${camera}/start/${start}/end/${end}/${file}`;
    console.log('Proxying to Frigate URL:', frigateUrl);

    // Fetch from Frigate
    const response = await fetch(frigateUrl);
    
    if (!response.ok) {
      console.error('Frigate VOD error:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Frigate VOD error: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get content type
    const contentType = response.headers.get('content-type') || 'application/vnd.apple.mpegurl';
    console.log('Frigate response content-type:', contentType);

    // For .m3u8 files, we need to modify the content to point to our proxy
    if (file.endsWith('.m3u8')) {
      const text = await response.text();
      console.log('Original m3u8 content:', text.slice(0, 200) + '...');
      
      // Replace relative URLs with proxy URLs
      let modifiedContent = text.replace(
        /^(?!#)(.+)$/gm, // Match non-comment lines
        (match) => {
          const trimmed = match.trim();
          if (trimmed === '') return match;
          // If it's already a full URL, leave it as is
          if (trimmed.startsWith('http')) return match;
          // Skip lines that don't look like file references
          if (trimmed.includes(':') && !trimmed.includes('.')) return match;
          
          // Extract just the filename from any path
          let filename = trimmed;
          if (trimmed.includes('/')) {
            filename = trimmed.split('/').pop() || trimmed;
          }
          
          // Replace with proxy URL
          return `/api/frigate/recordings/hls/proxy?camera=${camera}&start=${start}&end=${end}&file=${encodeURIComponent(filename)}`;
        }
      );
      
      // Also handle URI="filename" patterns in EXT-X-MAP and other directives
      modifiedContent = modifiedContent.replace(
        /URI="([^"]+)"/g,
        (match, filename) => {
          // Extract just the filename from any path
          const cleanFilename = filename.includes('/') ? filename.split('/').pop() : filename;
          return `URI="/api/frigate/recordings/hls/proxy?camera=${camera}&start=${start}&end=${end}&file=${encodeURIComponent(cleanFilename)}"`;
        }
      );
      
      console.log('Modified m3u8 content:', modifiedContent.slice(0, 200) + '...');
      
      return new NextResponse(modifiedContent, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cache-Control': 'no-cache',
        },
      });
    } else {
      // For video segments, stream through directly
      const arrayBuffer = await response.arrayBuffer();
      
      return new NextResponse(arrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

  } catch (error) {
    console.error('HLS Proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy HLS stream' },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}