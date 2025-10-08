import { NextRequest, NextResponse } from 'next/server';

/**
 * Maneja el cierre de sesión de usuarios
 * POST /api/auth/logout
 */
export async function POST(request: NextRequest) {
  try {
    const response = NextResponse.json({
      success: true,
      message: 'Sesión cerrada correctamente'
    });

    // Eliminar cookie de autenticación
    response.cookies.delete('auth_token');

    return response;
  } catch (error) {
    console.error('Error en logout:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
