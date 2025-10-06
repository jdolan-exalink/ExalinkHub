/**
 * API para gestión de usuarios
 * GET /api/config/users - Obtener todos los usuarios
 * POST /api/config/users - Crear nuevo usuario
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

/**
 * GET /api/config/users
 * Obtener todos los usuarios (sin passwords)
 */
export async function GET() {
  try {
    const db = getConfigDatabase();
    const users = db.getAllUsers().map(user => ({
      id: user.id,
      username: user.username,
      role: user.role,
      enabled: user.enabled,
      created_at: user.created_at,
      updated_at: user.updated_at
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error obteniendo usuarios:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/config/users
 * Crear nuevo usuario
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Validar datos requeridos
    if (!data.username || !data.password || !data.role) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      );
    }

    // Validar rol
    if (!['admin', 'operator', 'viewer'].includes(data.role)) {
      return NextResponse.json(
        { error: 'Rol inválido' },
        { status: 400 }
      );
    }

    const db = getConfigDatabase();
    
    // Verificar si el usuario ya existe
    const existingUser = db.getUserByUsername(data.username);
    if (existingUser) {
      return NextResponse.json(
        { error: 'El nombre de usuario ya existe' },
        { status: 409 }
      );
    }

    // Hash simple del password (en producción usar bcrypt)
    const passwordHash = Buffer.from(data.password).toString('base64');

    const userId = db.createUser({
      username: data.username,
      password_hash: passwordHash,
      role: data.role,
      enabled: data.enabled !== false  // Mantener como booleano, la conversión se hace en config-database
    });

    const newUser = db.getUserById(userId);
    
    // Remover password del response
    const userResponse = newUser ? {
      id: newUser.id,
      username: newUser.username,
      role: newUser.role,
      enabled: newUser.enabled,
      created_at: newUser.created_at,
      updated_at: newUser.updated_at
    } : null;

    return NextResponse.json({ 
      message: 'Usuario creado exitosamente',
      user: userResponse 
    });
  } catch (error) {
    console.error('Error creando usuario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}