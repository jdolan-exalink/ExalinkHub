import { NextRequest, NextResponse } from 'next/server';
import { create_frigate_api } from '@/lib/frigate-api';
import { resolve_frigate_server } from '@/lib/frigate-servers';

export async function GET(request: NextRequest) {
  try {
    console.log('=== RECORDING DAYS ENDPOINT ===');
    
    const { searchParams } = new URL(request.url);
    const camera = searchParams.get('camera');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    const server_id = searchParams.get('server_id');
    
    console.log('Request params:', { camera, month, year });
    
    if (!camera) {
      return NextResponse.json({ error: 'Camera parameter is required' }, { status: 400 });
    }

    if (!month || !year) {
      return NextResponse.json({ error: 'Month and year parameters are required' }, { status: 400 });
    }

    const month_num = parseInt(month);
    const year_num = parseInt(year);

    if (isNaN(month_num) || isNaN(year_num)) {
      return NextResponse.json({ error: 'Month and year must be valid numbers' }, { status: 400 });
    }

    console.log('Fetching recording days for:', { camera, month: month_num, year: year_num });
    const target_server = resolve_frigate_server(server_id);

    if (!target_server) {
      return NextResponse.json(
        {
          success: false,
          error: 'No hay servidores Frigate disponibles',
          recordingDays: []
        },
        { status: 503 }
      );
    }

    const frigate_api = create_frigate_api(target_server);

    try {
      // Get days with recordings
      const recording_days = await frigate_api.getRecordingDays(camera, month_num, year_num);
      
      console.log('Found recording days:', recording_days.length);
      console.log('Recording days:', recording_days);

      return NextResponse.json({ 
        success: true,
        camera: camera,
        month: month_num,
        year: year_num,
        recordingDays: recording_days
      });

    } catch (frigateError) {
      console.error('Frigate API error:', frigateError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch recording days from Frigate',
        details: frigateError instanceof Error ? frigateError.message : 'Unknown Frigate error',
        recordingDays: []
      }, { status: 503 });
    }

  } catch (error) {
    console.error('Error in recording days endpoint:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      recordingDays: []
    }, { status: 500 });
  }
}
