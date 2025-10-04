import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

export async function GET() {
  try {
    const db = getConfigDatabase();
    const config = db.getConsolidatedBackendConfig();
    return NextResponse.json({ config });
  } catch (error) {
    console.error('Error obteniendo configuración backend:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const db = getConfigDatabase();
    
    db.updateConsolidatedBackendConfig(data);

    const updatedConfig = db.getConsolidatedBackendConfig();

    return NextResponse.json({ 
      message: 'Configuración backend actualizada exitosamente',
      config: updatedConfig 
    });
  } catch (error) {
    console.error('Error actualizando configuración backend:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}