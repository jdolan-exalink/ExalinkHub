/**
 * GET /api/conteo/summary
 * Es el endpoint principal para obtener los datos agregados para los gráficos
 */

import { NextRequest, NextResponse } from 'next/server';
import { get_counting_database } from '@/lib/counting-database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view');
    const date = searchParams.get('date');
    const camera = searchParams.get('camera');

    // Validar parámetros requeridos
    if (!view || !date) {
      return NextResponse.json({
        error: 'Parámetros "view" y "date" son requeridos'
      }, { status: 400 });
    }

    // Validar view
    if (!['day', 'week', 'month'].includes(view)) {
      return NextResponse.json({
        error: 'Parámetro "view" debe ser: day, week, o month'
      }, { status: 400 });
    }

    // Validar formato de fecha
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({
        error: 'Parámetro "date" debe estar en formato YYYY-MM-DD'
      }, { status: 400 });
    }

    const counting_db = get_counting_database();
    const summary = counting_db.get_summary(view as 'day' | 'week' | 'month', date, camera || undefined);
    
    console.log('Summary generated:', {
      view,
      date,
      camera: camera || 'all',
      totals_count: summary.totals.length,
      by_hour_rows: summary.by_hour.rows.length,
      by_bucket_rows: summary.by_bucket.rows.length
    });

    return NextResponse.json(summary);

  } catch (error: any) {
    console.error('Error generating summary:', error);
    
    return NextResponse.json({
      error: 'Error al generar resumen de datos'
    }, { status: 500 });
  }
}