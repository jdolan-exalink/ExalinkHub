/**
 * API para consultar lecturas LPR desde la base de datos local
 * GET /api/lpr/readings - Obtener lecturas con filtros
 * GET /api/lpr/stats - Obtener estadísticas
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLPRDatabase } from '@/lib/lpr-database';
import { getLPRFileManager } from '@/lib/lpr-file-manager';

/**
 * Generar URL para archivos locales
 */
function generateLocalFileUrl(localPath: string, fileType: 'snapshot' | 'clip' | 'crop'): string {
  const fileManager = getLPRFileManager();
  return fileManager.getLocalFileUrl(localPath, fileType);
}

/**
 * GET /api/lpr/readings
 * Obtener lecturas LPR desde la base de datos local
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const db = getLPRDatabase();

    // Parsear parámetros
    const filters = {
      afterTimestamp: searchParams.get('after') ? parseInt(searchParams.get('after')!) : undefined,
      beforeTimestamp: searchParams.get('before') ? parseInt(searchParams.get('before')!) : undefined,
      cameras: searchParams.getAll('camera').filter(Boolean),
      plateSearch: searchParams.get('plate') || undefined, // Búsqueda parcial por matrícula
      minConfidence: searchParams.get('confidence_min') ? parseFloat(searchParams.get('confidence_min')!) : undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0')
    };

    // Buscar lecturas
    const readings = db.searchReadings(filters);
    
    // Enriquecer con URLs locales
    const enrichedReadings = readings.map(reading => ({
      ...reading,
      local_files: {
        snapshot_url: reading.snapshot_path ? generateLocalFileUrl(reading.snapshot_path, 'snapshot') : null,
        clip_url: reading.clip_path ? generateLocalFileUrl(reading.clip_path, 'clip') : null,
        crop_url: reading.crop_path ? generateLocalFileUrl(reading.crop_path, 'crop') : null
      }
    }));

    // Contar total para paginación
    const total = db.searchReadings({ ...filters, limit: undefined, offset: undefined }).length;

    return NextResponse.json({
      readings: enrichedReadings,
      total,
      page: Math.floor(filters.offset / filters.limit) + 1,
      limit: filters.limit,
      hasMore: (filters.offset + filters.limit) < total
    });

  } catch (error) {
    console.error('Error consultando lecturas LPR:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/lpr/readings
 * Insertar nueva lectura manualmente (para testing)
 */
export async function POST(request: NextRequest) {
  try {
    const reading = await request.json();
    const db = getLPRDatabase();

    // Validar campos requeridos
    const required = ['event_id', 'server_id', 'server_name', 'camera', 'plate', 'confidence', 'timestamp'];
    const missing = required.filter(field => !reading[field]);
    
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Campos requeridos: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    // Verificar que no existe
    if (db.eventExists(reading.event_id)) {
      return NextResponse.json(
        { error: 'El evento ya existe' },
        { status: 409 }
      );
    }

    const id = db.insertReading(reading);

    return NextResponse.json({
      success: true,
      id,
      event_id: reading.event_id
    });

  } catch (error) {
    console.error('Error insertando lectura LPR:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}