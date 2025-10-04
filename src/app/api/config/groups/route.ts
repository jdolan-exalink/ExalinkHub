/**
 * API para gestión de grupos
 * GET /api/config/groups - Obtener todos los grupos
 * POST /api/config/groups - Crear nuevo grupo
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

/**
 * GET /api/config/groups
 * Obtener todos los grupos
 */
export async function GET() {
  try {
    const db = getConfigDatabase();
    const groups = db.getAllGroups().map(group => ({
      ...group,
      saved_views: JSON.parse(group.saved_views)
    }));

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Error obteniendo grupos:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/config/groups
 * Crear nuevo grupo
 */
export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Validar datos requeridos
    if (!data.name) {
      return NextResponse.json(
        { error: 'El nombre del grupo es requerido' },
        { status: 400 }
      );
    }

    const db = getConfigDatabase();

    const groupId = db.createGroup({
      name: data.name,
      description: data.description || '',
      saved_views: JSON.stringify(data.saved_views || [])
    });

    const newGroup = db.getGroupById(groupId);

    return NextResponse.json({ 
      message: 'Grupo creado exitosamente',
      group: newGroup ? {
        ...newGroup,
        saved_views: JSON.parse(newGroup.saved_views)
      } : null
    });
  } catch (error) {
    console.error('Error creando grupo:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}