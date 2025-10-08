import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const groupId = parseInt(resolvedParams.id);
    if (isNaN(groupId)) {
      return NextResponse.json(
        { error: 'ID de grupo inválido' },
        { status: 400 }
      );
    }

    const data = await request.json();
    console.log('📝 Updating group data:', data);
    
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
      saved_views: JSON.stringify(data.saved_views || [])
    };

    console.log('📝 Update data to save:', updateData);
    
    const success = db.updateGroup(groupId, updateData);
    console.log('📝 Update success:', success);

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
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const groupId = parseInt(resolvedParams.id);
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

    // No permitir eliminar grupos predefinidos del sistema
    const protectedGroups = ['admins', 'usuarios', 'viewers'];
    if (protectedGroups.includes(existingGroup.name)) {
      return NextResponse.json(
        { error: `No se puede eliminar el grupo "${existingGroup.name}" porque es un grupo del sistema` },
        { status: 409 }
      );
    }

    const success = db.deleteGroup(groupId);

    if (success) {
      return NextResponse.json({ message: 'Grupo eliminado exitosamente' });
    } else {
      return NextResponse.json(
        { error: 'Error al eliminar el grupo' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error eliminando grupo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}