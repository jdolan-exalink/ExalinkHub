import { NextRequest, NextResponse } from 'next/server';
import { frigateAPI } from '@/lib/frigate-api';

export async function GET() {
  try {
    const stats = await frigateAPI.getStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}