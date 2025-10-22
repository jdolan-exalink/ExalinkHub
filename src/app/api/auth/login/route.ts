import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';
import { SignJWT } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'exalinkhub-secret-key-change-in-production'
);

/**
 * Maneja el inicio de sesión de usuarios
 * POST /api/auth/login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    // Validar campos requeridos
    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuario y contraseña son requeridos' },
        { status: 400 }
      );
    }

    const db = getConfigDatabase();
    const user = db.getUserByUsername(username);

    // Verificar si el usuario existe
    if (!user) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    // Verificar si el usuario está habilitado
    if (!user.enabled) {
      return NextResponse.json(
        { error: 'Usuario deshabilitado' },
        { status: 403 }
      );
    }

    // Verificar contraseña (actualmente usa base64, en producción usar bcrypt)
    const password_hash = Buffer.from(password).toString('base64');
    if (user.password_hash !== password_hash) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      );
    }

    // Obtener permisos del usuario
    const role_permissions = db.get_role_permissions(user.role);
    const accessible_modules = db.get_user_accessible_modules(user.id);

    // Crear token JWT
    const token = await new SignJWT({
      user_id: user.id,
      username: user.username,
      role: user.role,
      accessible_modules
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(JWT_SECRET);

    // Crear respuesta con cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        enabled: user.enabled,
        accessible_modules,
        permissions: role_permissions.permissions
      }
    });

    // Establecer cookie con el token
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: false, // Permitir cookies por HTTP en todos los entornos
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 24 horas
    });

    return response;
  } catch (error) {
    console.error('Error en login:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
