import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET() {
  try {
    const db = getDatabase();
    const views = db.getAllViews();
    
    // Parsear el JSON de cameras para cada vista
    const viewsWithParsedCameras = views.map(view => ({
      ...view,
      cameras: JSON.parse(view.cameras)
    }));
    
    return NextResponse.json(viewsWithParsedCameras);
  } catch (error) {
    console.error('Error fetching views:', error);
    return NextResponse.json(
      { error: 'Failed to fetch views', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, layout, cameras } = body;
    
    if (!name || !layout || !Array.isArray(cameras)) {
      return NextResponse.json(
        { error: 'Missing required fields: name, layout, cameras' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    const savedView = db.saveView(name, layout, cameras);
    
    return NextResponse.json({
      ...savedView,
      cameras: JSON.parse(savedView.cameras)
    });
  } catch (error) {
    console.error('Error saving view:', error);
    return NextResponse.json(
      { error: 'Failed to save view', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}