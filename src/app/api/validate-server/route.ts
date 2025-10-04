import { NextRequest, NextResponse } from 'next/server';
import { validateServerConnection } from '@/lib/frigate-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { baseUrl, username, password } = body;

    if (!baseUrl) {
      return NextResponse.json(
        { success: false, error: 'baseUrl es requerido' },
        { status: 400 }
      );
    }

    console.log(`🔍 API: Validando servidor ${baseUrl}`);
    
    const authData = username && password ? { username, password } : undefined;
    const result = await validateServerConnection(baseUrl, authData);

    console.log(`📡 API: Resultado de validación:`, result);

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ API: Error validando servidor:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error interno del servidor',
        requiresAuth: false
      },
      { status: 500 }
    );
  }
}