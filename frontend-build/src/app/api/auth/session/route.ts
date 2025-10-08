import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getConfigDatabase } from '@/lib/config-database';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'exalinkhub-secret-key-change-in-production'
);

/**
 * Verifica la sesión actual del usuario
 * GET /api/auth/session
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json(
        { authenticated: false, error: 'No hay sesión activa' },
        { status: 401 }
      );
    }

    // Verificar token JWT
    const { payload } = await jwtVerify(token, JWT_SECRET);

    const db = getConfigDatabase();
    const user = db.getUserById(payload.user_id as number);

    // Verificar que el usuario aún existe y está habilitado
    if (!user || !user.enabled) {
      return NextResponse.json(
        { authenticated: false, error: 'Usuario no válido' },
        { status: 401 }
      );
    }

    // Obtener permisos actualizados
    const role_permissions = db.get_role_permissions(user.role);
    const accessible_modules = db.get_user_accessible_modules(user.id);

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        enabled: user.enabled,
        accessible_modules,
        permissions: role_permissions.permissions
      }
    });
  } catch (error) {
    console.error('Error verificando sesión:', error);
    return NextResponse.json(
      { authenticated: false, error: 'Token inválido' },
      { status: 401 }
    );
  }
}
