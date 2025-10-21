/**
 * API endpoint para consultar detecciones de matrículas LPR
 * GET /api/plates - Obtener detecciones con filtros
 *
 * Este endpoint actúa como proxy hacia el backend LPR que tiene acceso
 * a la base de datos Matriculas.db donde se guardan las detecciones reales.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLPRBackendURL, getLPRMediaProxyURL } from '@/lib/lpr-backend-config';

/**
 * GET /api/plates
 * Proxy hacia el backend LPR usando configuración dinámica
 */
export async function GET(request: NextRequest) {
  try {
    console.log('🚀 PLATES API: Endpoint proxy llamado');

    const { searchParams } = new URL(request.url);
    console.log('🔍 Parámetros recibidos:', Object.fromEntries(searchParams.entries()));

    // El backend matriculas-listener solo soporta limit básico
    // Mapeamos parámetros del frontend a los que entiende el backend
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '100')));

    // Construir URL del backend LPR (matriculas-listener)
    const lprBaseUrl = await getLPRBackendURL();
    let backendUrl = `${lprBaseUrl}/events?limit=${limit}`;

    // Aplicar filtros si están presentes
    const camera = searchParams.get('camera');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const plateSearch = searchParams.get('plate');

    if (camera && camera !== 'all') {
      backendUrl += `&camera_name=${encodeURIComponent(camera)}`;
    }

    if (plateSearch) {
      backendUrl += `&license_plate=${encodeURIComponent(plateSearch)}`;
    }

    if (startDate) {
      // Convertir fecha ISO a timestamp Unix para el backend
      const startTimestamp = Math.floor(new Date(startDate).getTime() / 1000);
      backendUrl += `&start_date=${startTimestamp}`;
    }

    if (endDate) {
      // Convertir fecha ISO a timestamp Unix para el backend
      const endTimestamp = Math.floor(new Date(endDate).getTime() / 1000);
      backendUrl += `&end_date=${endTimestamp}`;
    }

    console.log('📡 Consultando backend LPR:', backendUrl);

    // Hacer petición al backend LPR
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('❌ Error del backend LPR:', response.status, response.statusText);
      return NextResponse.json(
        { error: `Backend LPR respondió con error: ${response.status}`, detections: [], total: 0 },
        { status: response.status }
      );
    }

    const backendData = await response.json();
    console.log('✅ Respuesta del backend LPR:', {
      events_count: backendData?.length || 0
    });

    // Transformar respuesta del backend al formato esperado por el frontend
    const detections = (backendData || []).map((event: any) => {
      // Extraer matrícula del payload JSON
      let plate = null;
      let confidence = null;

      try {
        const payload = typeof event.payload_json === 'string' ?
          JSON.parse(event.payload_json) : event.payload_json;

        if (payload?.after?.recognized_license_plate) {
          plate = payload.after.recognized_license_plate;
          confidence = payload.after.confidence || 0.5;
        } else if (payload?.after?.plate) {
          plate = payload.after.plate;
          confidence = payload.after.confidence || 0.5;
        }
      } catch (e) {
        console.warn('⚠️ Error parseando payload:', e);
      }

      // Convertir timestamp ISO a Unix timestamp
      let timestamp = Math.floor(Date.now() / 1000);
      try {
        if (event.ts) {
          timestamp = Math.floor(new Date(event.ts).getTime() / 1000);
        }
      } catch (e) {
        console.warn('⚠️ Error convirtiendo timestamp:', e);
      }

      // Usar URLs reales del backend LPR (mismo formato que /api/lpr/readings)
      const localFiles: any = {};

      if (event.snapshot_path) {
        localFiles.snapshot_url = getLPRMediaProxyURL(event.snapshot_path);
      }

      if (event.clip_path) {
        localFiles.clip_url = getLPRMediaProxyURL(event.clip_path);
      }

      if (event.plate_crop_path) {
        localFiles.crop_url = getLPRMediaProxyURL(event.plate_crop_path);
      }

      const has_clip = !!event.clip_path;

      return {
        id: `plate-${event.id}`,
        plate: plate || 'DESCONOCIDA',
        camera: event.camera || 'Desconocida',
        timestamp: timestamp,
        speed: event.speed || undefined,
        confidence: confidence,
        image: event.snapshot_path || '', // URL de imagen o cadena vacía si no hay
        local_files: localFiles, // Para compatibilidad con otros componentes
        has_clip: has_clip,
        vehicle_type: 'car', // Default, el backend no siempre proporciona este dato
        direction: 'unknown' // Default, el backend no proporciona este dato
      };
    });

    return NextResponse.json({
      detections,
      total: detections.length
    });

  } catch (error) {
    console.error('❌ Error en proxy plates:', error);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return NextResponse.json(
          { error: 'Timeout conectando al backend LPR', detections: [], total: 0 },
          { status: 504 }
        );
      }

      return NextResponse.json(
        { error: `Error de conexión: ${error.message}`, detections: [], total: 0 },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Error interno del servidor', detections: [], total: 0 },
      { status: 500 }
    );
  }
}