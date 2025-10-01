import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database';

export async function GET() {
  try {
    const db = getDatabase();
    const settings = db.getAllSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;
    
    if (!key || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: key, value' },
        { status: 400 }
      );
    }
    
    const db = getDatabase();
    db.setSetting(key, value);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating setting:', error);
    return NextResponse.json(
      { error: 'Failed to update setting', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}