/**
 * POST /api/conteo/toggle
 * Activa o desactiva el conteo para un objeto específico
 */

import { NextRequest, NextResponse } from 'next/server';
import { get_counting_database } from '@/lib/counting-database';

export async function POST(request: NextRequest) {
  try {
    const request_data = await request.json();
    const { label } = request_data;

    if (!label || typeof label !== 'string') {
      return NextResponse.json({
        error: 'Campo "label" requerido'
      }, { status: 400 });
    }

    const counting_db = get_counting_database();
    const active_objects = counting_db.toggle_active_object(label);

    console.log('Object toggle successful:', {
      label,
      new_active_objects: active_objects
    });

    return NextResponse.json({
      activos: active_objects
    });

  } catch (error: any) {
    console.error('Error toggling object:', error);
    
    return NextResponse.json({
      error: error.message || 'Error interno al cambiar estado del objeto'
    }, { status: 500 });
  }
}