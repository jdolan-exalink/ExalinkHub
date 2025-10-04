import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'ID de usuario inválido' },
        { status: 400 }
      );
    }

    const data = await request.json();
    const db = getConfigDatabase();
    
    // Verificar que el usuario existe
    const existingUser = db.getUserById(userId);
    if (!existingUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Verificar si se está cambiando el username y si ya existe
    if (data.username && data.username !== existingUser.username) {
      const userWithSameName = db.getUserByUsername(data.username);
      if (userWithSameName) {
        return NextResponse.json(
          { error: 'El nombre de usuario ya existe' },
          { status: 409 }
        );
      }
    }

    // Preparar datos de actualización
    const updateData: any = {
      username: data.username || existingUser.username,
      role: data.role || existingUser.role,
      enabled: data.enabled !== undefined ? data.enabled : existingUser.enabled,
    };

    // Solo actualizar password si se proporciona uno nuevo
    if (data.password && data.password.trim() !== '') {
      updateData.password_hash = Buffer.from(data.password).toString('base64');
    }

    // Validar rol
    if (!['admin', 'operator', 'viewer'].includes(updateData.role)) {
      return NextResponse.json(
        { error: 'Rol inválido' },
        { status: 400 }
      );
    }

    db.updateUser(userId, updateData);

    const updatedUser = db.getUserById(userId);
    
    // Remover password del response
    const userResponse = updatedUser ? {
      id: updatedUser.id,
      username: updatedUser.username,
      role: updatedUser.role,
      enabled: updatedUser.enabled,
      created_at: updatedUser.created_at,
      updated_at: updatedUser.updated_at
    } : null;

    return NextResponse.json({ 
      message: 'Usuario actualizado exitosamente',
      user: userResponse 
    });
  } catch (error) {
    console.error('Error actualizando usuario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = parseInt(params.id);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'ID de usuario inválido' },
        { status: 400 }
      );
    }

    const db = getConfigDatabase();
    
    // Verificar que el usuario existe
    const existingUser = db.getUserById(userId);
    if (!existingUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Evitar eliminar el usuario admin
    if (existingUser.username === 'admin') {
      return NextResponse.json(
        { error: 'No se puede eliminar el usuario admin' },
        { status: 403 }
      );
    }

    db.deleteUser(userId);

    return NextResponse.json({ 
      message: 'Usuario eliminado exitosamente' 
    });
  } catch (error) {
    console.error('Error eliminando usuario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}