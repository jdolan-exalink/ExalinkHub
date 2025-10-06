import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.id);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'ID de usuario inválido' },
        { status: 400 }
      );
    }

    const db = getConfigDatabase();
    const userGroups = db.getUserGroups(userId);

    return NextResponse.json({ groups: userGroups });
  } catch (error) {
    console.error('Error obteniendo grupos del usuario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const userId = parseInt(resolvedParams.id);
    if (isNaN(userId)) {
      return NextResponse.json(
        { error: 'ID de usuario inválido' },
        { status: 400 }
      );
    }

    const data = await request.json();
    const { groupIds } = data;

    if (!Array.isArray(groupIds)) {
      return NextResponse.json(
        { error: 'groupIds debe ser un array' },
        { status: 400 }
      );
    }

    const db = getConfigDatabase();
    
    // Verificar que el usuario existe
    const user = db.getUserById(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Actualizar grupos del usuario
    const success = db.updateUserGroups(userId, groupIds);

    if (success) {
      const updatedGroups = db.getUserGroups(userId);
      return NextResponse.json({ 
        message: 'Grupos del usuario actualizados exitosamente',
        groups: updatedGroups
      });
    } else {
      return NextResponse.json(
        { error: 'Error al actualizar grupos del usuario' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error actualizando grupos del usuario:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}