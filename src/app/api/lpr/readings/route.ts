/**
 * API endpoint para consultar lecturas LPR - Lectura directa de DB/Matriculas.db
 * GET /api/lpr/readings - Obtener lecturas con filtros
 *
 * Este endpoint lee directamente de la base de datos DB/Matriculas.db
 * Muestra los campos plate y speed de la tabla events
 */

import { NextRequest, NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

/**
 * GET /api/lpr/readings
 * Lectura directa de DB/Matriculas.db con filtros por:
 * - plate: búsqueda de matrícula
 * - after: timestamp Unix de inicio
 * - before: timestamp Unix de fin
 * - camera: nombre de cámara
 * - offset: para paginación
 * - limit: cantidad por página (default 50, max 200)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parsear parámetros
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')));
    const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));
    const plate = searchParams.get('plate');
    const after = searchParams.get('after') ? parseInt(searchParams.get('after')!) : undefined;
    const before = searchParams.get('before') ? parseInt(searchParams.get('before')!) : undefined;
    const camera = searchParams.get('camera');

    console.log('📡 LPR READINGS REQUEST (DB Direct):', {
      plate,
      after: after ? new Date(after * 1000).toISOString() : 'N/A',
      before: before ? new Date(before * 1000).toISOString() : 'N/A',
      camera,
      limit,
      offset
    });

    // Abrir conexión a la base de datos
    const db = await open({
      filename: 'DB/Matriculas.db',
      driver: sqlite3.Database
    });

    try {
      // Construir consulta base
      let query = `
        SELECT
          id,
          plate,
          score,
          speed,
          camera,
          ts,
          payload_json,
          snapshot_path,
          clip_path,
          plate_crop_path,
          created_at
        FROM events
        WHERE 1=1
      `;
      const params: any[] = [];

      // Filtro por placa (búsqueda parcial)
      if (plate && plate.trim()) {
        const searchPlate = plate.trim().toUpperCase().replace(/[^A-Z0-9]/gi, '');
        query += ' AND UPPER(REPLACE(REPLACE(REPLACE(plate, " ", ""), "-", ""), ".", "")) LIKE ?';
        params.push(`%${searchPlate}%`);
      }

      // Filtro por cámara
      if (camera && camera !== 'all') {
        query += ' AND camera = ?';
        params.push(camera);
      }

      // Filtro por timestamp
      if (after) {
        query += ' AND strftime("%s", ts) >= ?';
        params.push(after.toString());
      }
      if (before) {
        query += ' AND strftime("%s", ts) <= ?';
        params.push(before.toString());
      }

      // Ordenar por timestamp descendente (más recientes primero)
      query += ' ORDER BY ts DESC';

      // Obtener total de registros sin paginación
      const totalQuery = `SELECT COUNT(*) as total FROM (${query})`;
      const totalResult = await db.get(totalQuery, params);
      const total = totalResult.total;

      // Aplicar paginación
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      console.log('🔍 Ejecutando query:', query);
      console.log('📊 Parámetros:', params);

      const rows = await db.all(query, params);
      console.log(`✅ DB retornó ${rows.length} registros de ${total} totales`);

      /**
       * Normaliza una matrícula eliminando todo excepto letras y números.
       */
      const normalize_plate = (plate: string): string => {
        if (!plate) return '';
        return plate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      };

      // Transformar respuesta al formato esperado por el frontend
      const readings = rows.map((row: any) => {
        // Extraer datos adicionales del payload_json si es necesario

  // Inicialización de campos
  let confidence = 0.5;
  let zone = 'Desconocida';
  let vehicle_type = 'car';
  let traffic_light_status = null;
  let false_positive = false;
  let recognized_plate = null;
  let score = null;

        try {
          if (row.payload_json) {
            const payload = typeof row.payload_json === 'string'
              ? JSON.parse(row.payload_json)
              : row.payload_json;


            // Extraer recognized_license_plate y score
            if (payload.recognized_license_plate) {
              // Puede ser string o array [matricula, score]
              if (Array.isArray(payload.recognized_license_plate)) {
                recognized_plate = String(payload.recognized_license_plate[0] || '').toUpperCase();
                if (payload.recognized_license_plate.length > 1) {
                  score = Number(payload.recognized_license_plate[1]);
                }
              } else {
                // Ejemplo: "AYN619 95%" o "AYN619"
                const match = String(payload.recognized_license_plate).match(/^([A-Z0-9]+)\s*(\d{1,3})?%?$/i);
                if (match) {
                  recognized_plate = match[1].toUpperCase();
                  if (match[2]) {
                    score = parseInt(match[2], 10);
                  }
                } else {
                  recognized_plate = String(payload.recognized_license_plate).toUpperCase();
                }
              }
            }

            // Confianza: si hay score, usarlo como porcentaje (0.93 → 93%), si no usar payload.confidence
            if (score !== null && score !== undefined && !isNaN(Number(score))) {
              // Si el score es 0-1, convertir a porcentaje
              if (Number(score) <= 1) {
                confidence = Number(score);
              } else {
                confidence = Number(score) / 100;
              }
            } else if (payload.confidence !== undefined) {
              confidence = payload.confidence;
            }

            // Zona desde payload.current_zones
            if (payload.current_zones && Array.isArray(payload.current_zones) && payload.current_zones.length > 0) {
              zone = payload.current_zones[0];
            }

            // Tipo de vehículo desde payload.label
            if (payload.label) {
              vehicle_type = payload.label;
            }

            // Estado del semáforo
            if (payload.traffic_light_status) {
              traffic_light_status = payload.traffic_light_status;
            }

            // Falso positivo
            if (payload.false_positive !== undefined) {
              false_positive = payload.false_positive;
            }
          }
        } catch (e) {
          console.warn('⚠️ Error parseando payload_json:', e);
        }

        // Timestamp Unix
        const event_timestamp = row.ts ? Math.floor(new Date(row.ts).getTime() / 1000) : 0;

        // Determinar el valor de confianza SIEMPRE desde score (columna o extraído)
        // Siempre usar SOLO la columna score de la DB, forzando a número
        let confidence_final = 'N/A';
        let score_final = null;
        let score_num = null;
        if (row.score !== undefined && row.score !== null && String(row.score).trim() !== '' && !isNaN(Number(row.score))) {
          score_num = Number(row.score);
          score_final = score_num;
          // Si el score es 0-1, convertir a porcentaje string
          if (score_num <= 1) {
            confidence_final = (score_num * 100).toFixed(2);
          } else {
            confidence_final = score_num.toFixed(2);
          }
        } else {
          score_final = null;
          confidence_final = 'N/A';
        }

        return {
          id: row.id,
          plate: recognized_plate || ((row.plate !== null && row.plate !== undefined && row.plate.trim() !== '') ? row.plate.trim() : 'N/A'),
          score: score_final !== null ? score_final : 'N/A',
          speed: (row.speed !== null && row.speed !== undefined) ? row.speed : 'N/A',
          camera: row.camera || '',
          timestamp: event_timestamp,
          server_name: 'matriculas-db',
          confidence: confidence_final,
          local_files: {
            snapshot_url: row.snapshot_path ? `http://localhost:2221/media/${row.snapshot_path}` : null,
            clip_url: row.clip_path ? `http://localhost:2221/media/${row.clip_path}` : null,
            crop_url: row.plate_crop_path ? `http://localhost:2221/media/${row.plate_crop_path}` : null
          },
          zone: zone,
          vehicle_type: vehicle_type,
          traffic_light_status: traffic_light_status,
          false_positive: false_positive
        };
      });

      console.log(`📊 Retornando ${readings.length} lecturas de ${total} totales`);
      if (readings.length > 0) {
        console.log('🔍 Primer lectura:', {
          id: readings[0].id,
          plate: readings[0].plate,
          speed: readings[0].speed,
          camera: readings[0].camera
        });
      }

      return NextResponse.json({
        readings,
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        has_more: offset + limit < total
      });

    } finally {
      await db.close();
    }

  } catch (error) {
    console.error('❌ Error en LPR readings (DB direct):', error);

    if (error instanceof Error) {
      return NextResponse.json(
        {
          readings: [],
          total: 0,
          page: 1,
          limit: 50,
          error: error.message
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        readings: [],
        total: 0,
        page: 1,
        limit: 50,
        error: 'Error interno del servidor'
    },
      { status: 500 }
    );
  }
}
