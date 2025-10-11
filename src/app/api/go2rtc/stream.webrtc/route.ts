import { NextRequest, NextResponse } from 'next/server';
import { resolve_frigate_server } from '@/lib/frigate-servers';

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const src = searchParams.get('src');

    if (!src) {
      return NextResponse.json(
        { error: 'Source parameter is required' },
        { status: 400 }
      );
    }

    console.log(`WebRTC: Proxying SDP offer for source: ${src}`);

    const server_id = searchParams.get('server_id');
    const target_server = resolve_frigate_server(server_id);
    if (!target_server) {
      return NextResponse.json(
        { error: 'No hay servidores Frigate configurados' },
        { status: 503 }
      );
    }

    // Get the SDP offer from the request body
    const offerSDP = await request.text();

    if (!offerSDP) {
      return NextResponse.json(
        { error: 'SDP offer is required in request body' },
        { status: 400 }
      );
    }

    // Forward the SDP offer to go2rtc (assuming it's running on the same server as Frigate)
    const base_url = new URL(target_server.baseUrl);
    const go2rtc_origin = `${base_url.protocol}//${base_url.hostname}:1984`;
    const go2rtcUrl = `${go2rtc_origin}/api/go2rtc/webrtc?src=${encodeURIComponent(src)}`;

    console.log(`WebRTC: Forwarding to go2rtc at ${go2rtcUrl}`);

    const response = await fetch(go2rtcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
      },
      body: offerSDP,
    });

    if (!response.ok) {
      console.error(`WebRTC: go2rtc error for ${src}:`, response.status, response.statusText);
      return NextResponse.json(
        {
          error: `go2rtc WebRTC endpoint error: ${response.status} ${response.statusText}`,
          details: await response.text().catch(() => 'Unknown error')
        },
        { status: response.status }
      );
    }

    const answerSDP = await response.text();
    console.log(`WebRTC: Received SDP answer from go2rtc for ${src}`);

    // Return the SDP answer
    return new NextResponse(answerSDP, {
      status: 200,
      headers: {
        'Content-Type': 'application/sdp',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });

  } catch (error) {
    console.error('WebRTC proxy error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
