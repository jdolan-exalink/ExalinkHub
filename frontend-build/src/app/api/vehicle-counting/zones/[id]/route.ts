/**
 * API para configuración individual de zona vehicular
 * GET /api/vehicle-counting/zones/[id] - Obtener configuración específica
 * PUT /api/vehicle-counting/zones/[id] - Actualizar configuración
 * DELETE /api/vehicle-counting/zones/[id] - Eliminar configuración
 */

import { NextRequest, NextResponse } from 'next/server';
import { getVehicleCountingDatabase } from '@/lib/vehicle-counting-database';

const db = getVehicleCountingDatabase();

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    const zone = db.get_zone_config(id);
    if (!zone) {
      return NextResponse.json(
        { success: false, error: 'Configuración de zona no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: zone
    });
  } catch (error) {
    console.error('Error getting vehicle counting zone:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo configuración de zona' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const updated = db.update_zone_config(id, body);

    if (updated) {
      const updated_zone = db.get_zone_config(id);
      return NextResponse.json({
        success: true,
        data: updated_zone
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Error actualizando configuración de zona' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error updating vehicle counting zone:', error);
    return NextResponse.json(
      { success: false, error: 'Error actualizando configuración de zona' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'ID inválido' },
        { status: 400 }
      );
    }

    const deleted = db.delete_zone_config(id);

    if (deleted) {
      return NextResponse.json({
        success: true,
        message: 'Configuración de zona eliminada correctamente'
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Error eliminando configuración de zona' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error deleting vehicle counting zone:', error);
    return NextResponse.json(
      { success: false, error: 'Error eliminando configuración de zona' },
      { status: 500 }
    );
  }
}