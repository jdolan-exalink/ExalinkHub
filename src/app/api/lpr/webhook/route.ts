/**
 * API para procesamiento de eventos LPR en tiempo real
 * Recibe webhooks de Frigate y procesa lecturas de matrículas
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLPRDatabase } from '@/lib/lpr-database';
import { getLPRFileManager } from '@/lib/lpr-file-manager';
import { get_active_frigate_servers, get_frigate_headers as get_frigate_headers } from '@/lib/frigate-servers';
import type { FrigateServer as ConfiguredFrigateServer } from '@/lib/frigate-servers';
import type { FrigateEvent } from '@/lib/types';

/**
 * POST /api/lpr/webhook
 * Webhook para recibir eventos de Frigate en tiempo real
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    console.log('🔔 Webhook LPR recibido:', JSON.stringify(payload, null, 2));

    // Validar estructura del webhook
    if (!payload.type || !payload.after) {
      return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
    }

    const event: FrigateEvent = payload.after;
    
    // Solo procesar eventos de autos o license_plate
    if (event.label !== 'car' && event.label !== 'license_plate') {
      return NextResponse.json({ message: 'Evento ignorado - no es relevante para LPR' });
    }

    const result = await processLPREvent(event, payload.server_id || 'srv1');
    
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error procesando webhook LPR:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/lpr/process
 * Endpoint para procesar eventos LPR manualmente
 */
export async function PUT(request: NextRequest) {
  try {
    const { eventId, serverId = 'srv1' } = await request.json();

    if (!eventId) {
      return NextResponse.json({ error: 'eventId requerido' }, { status: 400 });
    }

    // Obtener evento desde Frigate
    const servers: ConfiguredFrigateServer[] = get_active_frigate_servers();
    const server = servers.find(s => s.id === serverId);
    
    if (!server) {
      return NextResponse.json({ error: 'Servidor no encontrado' }, { status: 404 });
    }

    const eventUrl = `${server.baseUrl}/api/events/${eventId}`;
    const headers = get_frigate_headers(server);

    const response = await fetch(eventUrl, { headers });
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Evento no encontrado en Frigate' }, { status: 404 });
    }

    const event: FrigateEvent = await response.json();
    const result = await processLPREvent(event, serverId);

    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ Error procesando evento LPR:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * Procesa un evento LPR individual
 */
async function processLPREvent(event: FrigateEvent, serverId: string) {
  const db = getLPRDatabase();
  const fileManager = getLPRFileManager();
  
  // Verificar si ya existe
  if (db.eventExists(event.id)) {
    console.log(`⚠️ Evento ${event.id} ya existe en BD, actualizando...`);
  }

  // Extraer matrícula
  const plate = extractPlate(event);
  
  if (!plate || plate === 'No detectada') {
    console.log(`⚠️ Evento ${event.id} no tiene matrícula detectada, ignorando`);
    return { message: 'Sin matrícula detectada' };
  }

  // Obtener información del servidor
  const servers: ConfiguredFrigateServer[] = get_active_frigate_servers();
  const server = servers.find(s => s.id === serverId);
  const serverName = server?.name || 'Servidor Desconocido';

  console.log(`🔍 Procesando lectura LPR: ${plate} en ${event.camera}`);

  try {
    // Insertar/actualizar en BD
    const reading = {
      event_id: event.id,
      server_id: serverId,
      server_name: serverName,
      camera: event.camera,
      plate: plate,
      confidence: extractPlateConfidence(event),
      timestamp: event.start_time,
      end_time: event.end_time,
      vehicle_type: determineVehicleType(event),
      speed: event.attributes?.speed_kmh,
      direction: 'unknown', // TODO: inferir desde zonas
      has_clip: event.has_clip || false,
      has_snapshot: event.has_snapshot || false,
      score: event.score || 0,
      box: event.box ? JSON.stringify(event.box) : undefined
    };

    let readingId: number;
    
    if (db.eventExists(event.id)) {
      // Actualizar existente (no implementado por simplicidad)
      readingId = 0;
    } else {
      readingId = db.insertReading(reading);
    }

    console.log(`✓ Lectura guardada en BD: ID ${readingId}`);

    // Descargar archivos
    const downloadPromises: Promise<void>[] = [];
    const localPaths: any = {};

    // Snapshot
    if (event.has_snapshot && server) {
      downloadPromises.push(
        downloadAndSaveFile(
          event, 
          'snapshot', 
          `${server.baseUrl}/api/events/${event.id}/snapshot.jpg`,
          fileManager,
          db
        ).then(path => { localPaths.snapshot_path = path; })
      );
    }

    // Clip
    if (event.has_clip && server) {
      downloadPromises.push(
        downloadAndSaveFile(
          event,
          'clip',
          `${server.baseUrl}/api/events/${event.id}/clip.mp4`,
          fileManager,
          db
        ).then(path => { localPaths.clip_path = path; })
      );
    }

    // Crop de la matrícula (si hay box disponible)
    if (event.box && event.has_snapshot && server) {
      downloadPromises.push(
        downloadLicensePlateCrop(
          event,
          server,
          fileManager,
          db
        ).then(path => { localPaths.crop_path = path; })
      );
    }

    // Esperar todas las descargas
    await Promise.allSettled(downloadPromises);

    // Actualizar rutas en BD
    if (Object.keys(localPaths).length > 0) {
      db.updateLocalPaths(event.id, localPaths);
      console.log(`✓ Rutas locales actualizadas:`, localPaths);
    }

    return {
      success: true,
      event_id: event.id,
      plate: plate,
      confidence: reading.confidence,
      files_downloaded: Object.keys(localPaths).length,
      local_paths: localPaths
    };

  } catch (error) {
    console.error(`❌ Error procesando evento ${event.id}:`, error);
    throw error;
  }
}

/**
 * Descarga y guarda un archivo
 */
async function downloadAndSaveFile(
  event: FrigateEvent,
  fileType: 'snapshot' | 'clip' | 'crop',
  sourceUrl: string,
  fileManager: any,
  db: any
): Promise<string | undefined> {
  try {
    const extension = fileType === 'clip' ? 'mp4' : 'jpg';
    const result = await fileManager.downloadFile(event.id, fileType, sourceUrl, extension);
    
    // Registrar en BD
    db.insertFile({
      event_id: event.id,
      file_type: fileType,
      original_url: sourceUrl,
      local_path: result.localPath,
      file_size: result.fileSize,
      hash: result.hash
    });

    console.log(`✓ ${fileType} descargado: ${result.localPath}`);
    return result.localPath;

  } catch (error) {
    console.error(`❌ Error descargando ${fileType} para evento ${event.id}:`, error);
    return undefined;
  }
}

/**
 * Descarga crop específico de la matrícula
 */
async function downloadLicensePlateCrop(
  event: FrigateEvent,
  server: any,
  fileManager: any,
  db: any
): Promise<string | undefined> {
  try {
    // URL para obtener crop de la matrícula
    const box = Array.isArray(event.box) ? event.box : [0, 0, 1, 1];
    const [x1, y1, x2, y2] = box;
    
    // Construir URL de crop
    const cropUrl = `${server.baseUrl}/api/events/${event.id}/snapshot.jpg?crop=1&box=${x1},${y1},${x2},${y2}`;
    
    return await downloadAndSaveFile(event, 'crop', cropUrl, fileManager, db);

  } catch (error) {
    console.error(`❌ Error descargando crop para evento ${event.id}:`, error);
    return undefined;
  }
}

/**
 * Extrae matrícula de un evento
 */
function extractPlate(event: FrigateEvent): string | null {
  // Prioridad: sub_label > attributes.license_plate > plus.lpr.plate
  if (event.sub_label && event.sub_label.trim()) {
    return event.sub_label.trim();
  }
  if (event.attributes?.license_plate && event.attributes.license_plate.trim()) {
    return event.attributes.license_plate.trim();
  }
  if ((event as any).plus?.lpr?.plate && (event as any).plus.lpr.plate.trim()) {
    return (event as any).plus.lpr.plate.trim();
  }
  return null;
}

/**
 * Extrae confianza de la placa
 */
function extractPlateConfidence(event: FrigateEvent): number {
  if (event.attributes?.plate_confidence !== undefined) {
    return event.attributes.plate_confidence;
  }
  // Fallback a top_score o score
  return event.top_score || event.score || 0;
}

/**
 * Determina tipo de vehículo
 */
function determineVehicleType(event: FrigateEvent): string {
  const label = event.label?.toLowerCase();
  
  if (label?.includes('truck')) return 'truck';
  if (label?.includes('bus')) return 'bus';  
  if (label?.includes('motorcycle')) return 'motorcycle';
  if (label?.includes('car')) return 'car';
  
  return 'unknown';
}
