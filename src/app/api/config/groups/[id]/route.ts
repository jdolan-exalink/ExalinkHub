import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const groupId = parseInt(params.id);
    if (isNaN(groupId)) {
      return NextResponse.json(
        { error: 'ID de grupo inválido' },
        { status: 400 }
      );
    }

    const data = await request.json();
    const db = getConfigDatabase();
    
    // Verificar que el grupo existe
    const existingGroup = db.getGroupById(groupId);
    if (!existingGroup) {
      return NextResponse.json(
        { error: 'Grupo no encontrado' },
        { status: 404 }
      );
    }

    // Verificar si se está cambiando el nombre y si ya existe
    if (data.name && data.name !== existingGroup.name) {
      const groups = db.getAllGroups();
      if (groups.some(g => g.name === data.name && g.id !== groupId)) {
        return NextResponse.json(
          { error: 'Ya existe un grupo con ese nombre' },
          { status: 409 }
        );
      }
    }

    // Preparar datos de actualización
    const updateData = {
      name: data.name || existingGroup.name,
      description: data.description !== undefined ? data.description : existingGroup.description,
      saved_views: JSON.stringify(data.saved_views || JSON.parse(existingGroup.saved_views))
    };

    db.updateGroup(groupId, updateData);

    const updatedGroup = db.getGroupById(groupId);

    return NextResponse.json({ 
      message: 'Grupo actualizado exitosamente',
      group: updatedGroup ? {
        ...updatedGroup,
        saved_views: JSON.parse(updatedGroup.saved_views)
      } : null
    });
  } catch (error) {
    console.error('Error actualizando grupo:', error);
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
    const groupId = parseInt(params.id);
    if (isNaN(groupId)) {
      return NextResponse.json(
        { error: 'ID de grupo inválido' },
        { status: 400 }
      );
    }

    const db = getConfigDatabase();
    
    // Verificar que el grupo existe
    const existingGroup = db.getGroupById(groupId);
    if (!existingGroup) {
      return NextResponse.json(
        { error: 'Grupo no encontrado' },
        { status: 404 }
      );
    }

    db.deleteGroup(groupId);

    return NextResponse.json({ 
      message: 'Grupo eliminado exitosamente' 
    });
  } catch (error) {
    console.error('Error eliminando grupo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}