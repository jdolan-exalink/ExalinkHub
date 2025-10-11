/**
 * API para actualizar lecturas LPR específicas
 * PATCH /api/lpr/readings/[id] - Actualizar una lectura específica
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLPRDatabase } from '@/lib/lpr-database';

/**
 * PATCH /api/lpr/readings/[id]
 * Actualizar una lectura LPR específica
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await context.params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'ID inválido' },
        { status: 400 }
      );
    }

    const updates = await request.json();
    const db = getLPRDatabase();

    // Validar que solo se actualice la matrícula por ahora
    if (!updates.plate || typeof updates.plate !== 'string') {
      return NextResponse.json(
        { error: 'Solo se puede actualizar la matrícula' },
        { status: 400 }
      );
    }

    // Actualizar en la base de datos
    const stmt = db.getDatabase().prepare(`
      UPDATE lpr_readings
      SET plate = ?, updated_at = unixepoch()
      WHERE id = ?
    `);

    const result = stmt.run(updates.plate.trim(), id);

    if (result.changes === 0) {
      return NextResponse.json(
        { error: 'Registro no encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Matrícula actualizada correctamente'
    });

  } catch (error) {
    console.error('Error actualizando lectura LPR:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
