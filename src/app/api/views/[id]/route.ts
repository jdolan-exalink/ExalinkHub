import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid view ID' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    const view = db.getViewById(id);
    
    if (!view) {
      return NextResponse.json(
        { error: 'View not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      ...view,
      cameras: JSON.parse(view.cameras)
    });
  } catch (error) {
    console.error('Error fetching view:', error);
    return NextResponse.json(
      { error: 'Failed to fetch view', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid view ID' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { name, layout, cameras, icon } = body;
    
    if (!name || !layout || !Array.isArray(cameras)) {
      return NextResponse.json(
        { error: 'Missing required fields: name, layout, cameras' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    const updatedView = db.updateView(id, name, layout, cameras);
    
    if (!updatedView) {
      return NextResponse.json(
        { error: 'View not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      ...updatedView,
      cameras: JSON.parse(updatedView.cameras)
    });
  } catch (error) {
    console.error('Error updating view:', error);
    return NextResponse.json(
      { error: 'Failed to update view', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid view ID' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    const deleted = db.deleteView(id);
    
    if (!deleted) {
      return NextResponse.json(
        { error: 'View not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting view:', error);
    return NextResponse.json(
      { error: 'Failed to delete view', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}