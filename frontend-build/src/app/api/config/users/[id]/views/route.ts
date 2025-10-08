import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.id);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'ID de usuario inválido' },
        { status: 400 }
      );
    }

    const db = getConfigDatabase();
    const viewsCount = db.getUserAvailableViewsCount(userId);
    const availableViews = db.getUserAvailableViews(userId);

    return NextResponse.json({ 
      count: viewsCount,
      viewIds: availableViews
    });
  } catch (error) {
    console.error('Error obteniendo conteo de vistas del usuario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}