/**
 * API para verificación de permisos
 * GET /api/config/permissions - Obtener permisos de un usuario o rol
 * POST /api/config/permissions/check - Verificar permisos específicos
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

/**
 * GET /api/config/permissions
 * Obtener permisos de un usuario o rol
 * Query params: ?user_id=X o ?username=X o ?role=X
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('user_id');
    const username = searchParams.get('username');
    const role = searchParams.get('role');

    const db = getConfigDatabase();

    if (userId) {
      // Obtener permisos por ID de usuario
      const userIdNum = parseInt(userId);
      if (isNaN(userIdNum)) {
        return NextResponse.json(
          { error: 'ID de usuario inválido' },
          { status: 400 }
        );
      }

      const user = db.getUserById(userIdNum);
      if (!user) {
        return NextResponse.json(
          { error: 'Usuario no encontrado' },
          { status: 404 }
        );
      }

      const permissions = db.get_role_permissions(user.role);
      const accessibleModules = db.get_user_accessible_modules(userIdNum);

      return NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          enabled: user.enabled
        },
        permissions: permissions.permissions,
        accessible_modules: accessibleModules
      });

    } else if (username) {
      // Obtener permisos por nombre de usuario
      const user = db.getUserByUsername(username);
      if (!user) {
        return NextResponse.json(
          { error: 'Usuario no encontrado' },
          { status: 404 }
        );
      }

      const permissions = db.get_role_permissions(user.role);
      const accessibleModules = db.get_user_accessible_modules(user.id);

      return NextResponse.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          enabled: user.enabled
        },
        permissions: permissions.permissions,
        accessible_modules: accessibleModules
      });

    } else if (role) {
      // Obtener permisos por rol
      if (!['admin', 'operator', 'viewer'].includes(role)) {
        return NextResponse.json(
          { error: 'Rol inválido' },
          { status: 400 }
        );
      }

      const permissions = db.get_role_permissions(role as 'admin' | 'operator' | 'viewer');

      return NextResponse.json({
        role,
        permissions: permissions.permissions
      });

    } else {
      return NextResponse.json(
        { error: 'Debe proporcionar user_id, username o role' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Error obteniendo permisos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/config/permissions/check
 * Verificar si un usuario tiene un permiso específico
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Validar datos requeridos
    if (!data.module || !data.action) {
      return NextResponse.json(
        { error: 'Módulo y acción son requeridos' },
        { status: 400 }
      );
    }

    if (!data.user_id && !data.username) {
      return NextResponse.json(
        { error: 'Debe proporcionar user_id o username' },
        { status: 400 }
      );
    }

    const db = getConfigDatabase();
    let hasPermission = false;

    if (data.user_id) {
      const userIdNum = parseInt(data.user_id);
      if (isNaN(userIdNum)) {
        return NextResponse.json(
          { error: 'ID de usuario inválido' },
          { status: 400 }
        );
      }
      hasPermission = db.check_user_permission(userIdNum, data.module, data.action);
    } else if (data.username) {
      hasPermission = db.check_user_permission_by_username(data.username, data.module, data.action);
    }

    return NextResponse.json({
      user_id: data.user_id,
      username: data.username,
      module: data.module,
      action: data.action,
      has_permission: hasPermission
    });

  } catch (error) {
    console.error('Error verificando permisos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}