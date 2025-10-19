/**
 * API endpoint para consultar eventos LPR directamente desde DB/Matriculas.db
 * GET /api/lpr/events-db - Obtener eventos con filtros opcionales
 */

import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';

/**
 * GET /api/lpr/events-db
 * Consulta directa a la tabla events de DB/Matriculas.db
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parámetros de consulta
    const limit = Math.min(1000, Math.max(1, parseInt(searchParams.get('limit') || '100')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));
    const plateFilter = searchParams.get('plate')?.trim();
    const startDate = searchParams.get('start_date')?.trim();
    const endDate = searchParams.get('end_date')?.trim();

    // Ruta a la base de datos
    const dbPath = path.join(process.cwd(), 'DB', 'Matriculas.db');

    console.log('📊 Consultando DB/Matriculas.db directamente:', { limit, offset, plateFilter, startDate, endDate, dbPath });

    // Abrir conexión a la base de datos
    const db = new Database(dbPath, { readonly: true });

    try {
      let query = `
        SELECT
          id,
          server,
          frigate_event_id,
          camera,
          event_type,
          ts,
          payload_json,
          snapshot_path,
          clip_path,
          plate_crop_path,
          speed,
          created_at
        FROM events
        WHERE 1=1
      `;

      const params: any[] = [];

      // Filtro por fecha si se especifica
      if (startDate) {
        query += ` AND ts >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND ts <= ?`;
        params.push(endDate);
      }

      // NO aplicar filtro en la query SQL - se filtra después de transformar
      // Ordenar por ID descendente (más recientes primero)
      query += ` ORDER BY id DESC`;

      // Paginación - obtener todos los registros primero, filtrar después
      query += ` LIMIT ? OFFSET ?`;
      params.push(1000, 0); // Obtener hasta 1000 registros para filtrar

      console.log('🔍 Ejecutando query:', query, params);

      const stmt = db.prepare(query);
      const events = stmt.all(...params);

      // Contar total de registros (sin filtro)
      const countStmt = db.prepare(`SELECT COUNT(*) as total FROM events`);
      const totalResult = countStmt.get() as { total: number };
      const total = totalResult.total;

      // Transformar eventos al formato esperado por el frontend
      const transformedEvents = events.map((event: any) => {
        // Parsear el payload JSON
        let payload = {};
        try {
          payload = typeof event.payload_json === 'string' ? JSON.parse(event.payload_json) : event.payload_json || {};
        } catch (e) {
          console.warn(`⚠️ Error parseando payload_json para evento ${event.id}:`, e);
        }

        // Extraer datos de matrícula del payload
        const eventAfter = (payload as any).after || {};
        const recognizedPlate = eventAfter.recognized_license_plate || [];
        const rawPlate = recognizedPlate[0] || '';
        // Normalizar matrícula: quitar espacios y guiones, convertir a mayúsculas
        const plate = rawPlate.replace(/[\s\-]/g, '').toUpperCase();
        const confidence = recognizedPlate[1] || 0.5;

        // Convertir timestamp de string a Unix timestamp
        let timestamp = Math.floor(Date.now() / 1000); // fallback
        try {
          timestamp = Math.floor(new Date(event.ts).getTime() / 1000);
        } catch (e) {
          console.warn(`⚠️ Error convirtiendo timestamp para evento ${event.id}:`, event.ts);
        }

        return {
          id: event.id,
          plate: plate,
          camera: event.camera || eventAfter.camera || '',
          timestamp: timestamp,
          server_name: event.server || 'helvecia',
          speed: event.speed || eventAfter.average_estimated_speed || null,
          confidence: confidence,
          local_files: {
            snapshot_url: event.snapshot_path ? `/MEDIA/${event.snapshot_path}` : null,
            clip_url: event.clip_path ? `/MEDIA/${event.clip_path}` : null,
            crop_url: event.plate_crop_path ? `/MEDIA/${event.plate_crop_path}` : null
          },
          zone: eventAfter.current_zones ? eventAfter.current_zones[0] : 'Desconocida',
          vehicle_type: eventAfter.label || 'car',
          traffic_light_status: null, // No disponible en el payload
          false_positive: eventAfter.false_positive || false
        };
      });

      // Aplicar filtro por matrícula después de transformar (más confiable)
      let filteredEvents = transformedEvents;
      if (plateFilter) {
        const normalizedFilter = plateFilter.replace(/[\s\-]/g, '').toUpperCase();
        filteredEvents = transformedEvents.filter(event =>
          event.plate && event.plate.toUpperCase().includes(normalizedFilter)
        );
      }

      // Aplicar paginación después del filtro
      const paginatedEvents = filteredEvents.slice(offset, offset + limit);

      console.log(`✅ Encontrados ${events.length} eventos crudos, ${transformedEvents.length} transformados, ${filteredEvents.length} filtrados, ${paginatedEvents.length} paginados`);

      return NextResponse.json({
        events: paginatedEvents,
        total: filteredEvents.length,
        limit: limit,
        offset: offset,
        has_more: offset + limit < filteredEvents.length
      });

    } finally {
      db.close();
    }

  } catch (error) {
    console.error('❌ Error consultando DB/Matriculas.db:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: `Error de base de datos: ${error.message}`, events: [], total: 0 },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor', events: [], total: 0 },
      { status: 500 }
    );
  }
}