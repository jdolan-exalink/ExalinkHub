import { NextRequest, NextResponse } from 'next/server';
import { frigateAPI } from '@/lib/frigate-api';

export async function GET(request: NextRequest) {
  try {
    console.log('=== RECORDING DAYS ENDPOINT ===');
    
    const { searchParams } = new URL(request.url);
    const camera = searchParams.get('camera');
    const month = searchParams.get('month');
    const year = searchParams.get('year');
    
    console.log('Request params:', { camera, month, year });
    
    if (!camera) {
      return NextResponse.json({ error: 'Camera parameter is required' }, { status: 400 });
    }

    if (!month || !year) {
      return NextResponse.json({ error: 'Month and year parameters are required' }, { status: 400 });
    }

    const monthNum = parseInt(month);
    const yearNum = parseInt(year);

    if (isNaN(monthNum) || isNaN(yearNum)) {
      return NextResponse.json({ error: 'Month and year must be valid numbers' }, { status: 400 });
    }

    console.log('Fetching recording days for:', { camera, month: monthNum, year: yearNum });

    try {
      // Get days with recordings
      const recordingDays = await frigateAPI.getRecordingDays(camera, monthNum, yearNum);
      
      console.log('Found recording days:', recordingDays.length);
      console.log('Recording days:', recordingDays);

      return NextResponse.json({ 
        success: true,
        camera: camera,
        month: monthNum,
        year: yearNum,
        recordingDays: recordingDays
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