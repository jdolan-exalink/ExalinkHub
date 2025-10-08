import { NextRequest, NextResponse } from 'next/server';
import { getActiveFrigateServers, getFrigateHeaders } from '@/lib/frigate-servers';
import type { LPREvent, LPRSearchResult, LPRFilters, FrigateEvent } from '@/lib/types';

/**
 * API endpoint para búsqueda de eventos LPR
 * Agrega datos de múltiples servidores Frigate con filtros
 * 
 * GET /api/frigate/lpr/events
 * Query params:
 * - after: timestamp inicio (epoch)
 * - before: timestamp fin (epoch)
 * - cameras: array de "serverId:cameraName" o cameraName
 * - plate: texto de búsqueda en matrícula
 * - limit: límite por página (default 200)
 * - page: número de página (default 1)
 * - confidence_min: confianza mínima (0-1)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parsear parámetros de búsqueda
    const filters = parseSearchParams(searchParams);
    console.log('🔍 [LPR] Filtros de búsqueda:', filters);

    const servers = getActiveFrigateServers();
    const allEvents: LPREvent[] = [];
    const serverStatus: Record<string, string> = {};
    const TIMEOUT_MS = 10000; // Mayor timeout para búsquedas

    // Función para hacer request con timeout
    const fetchWithTimeout = async (url: string, options: RequestInit): Promise<Response> => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    };

    // Función para extraer matrícula de un evento
    const extractPlate = (event: FrigateEvent): string | null => {
      // Prioridad: sub_label > attributes.license_plate > plus.lpr.plate
      if (event.sub_label && event.sub_label.trim()) {
        return event.sub_label.trim();
      }
      if (event.attributes?.license_plate && event.attributes.license_plate.trim()) {
        return event.attributes.license_plate.trim();
      }
      if (event.plus?.lpr?.plate && event.plus.lpr.plate.trim()) {
        return event.plus.lpr.plate.trim();
      }
      return null;
    };

    // Función para extraer confianza de la placa
    const extractPlateConfidence = (event: FrigateEvent): number => {
      if (event.attributes?.plate_confidence !== undefined) {
        return event.attributes.plate_confidence;
      }
      // Fallback a top_score o score
      return event.top_score || event.score || 0;
    };

    // Consultar cada servidor
    const serverPromises = servers.map(async (server) => {
      try {
        // Filtrar cámaras para este servidor
        const serverCameras = filters.cameras.filter(cam => 
          cam.startsWith(`${server.id}:`) || !cam.includes(':')
        ).map(cam => cam.replace(`${server.id}:`, ''));

        // Si hay filtros de cámara y ninguna pertenece a este servidor, saltar
        if (filters.cameras.length > 0 && serverCameras.length === 0) {
          serverStatus[server.id] = 'skipped';
          return;
        }

        const headers = getFrigateHeaders(server);
        
        // Buscar eventos de license_plate directos
        const licenseUrl = buildEventsUrl(server.baseUrl, filters, serverCameras);
        console.log(`[LPR] Consultando ${server.name} (license_plate): ${licenseUrl}`);
        
        let serverEvents: FrigateEvent[] = [];
        
        try {
          const licenseResponse = await fetchWithTimeout(licenseUrl, {
            method: 'GET',
            headers
          });

          if (licenseResponse.ok) {
            const licenseEvents: FrigateEvent[] = await licenseResponse.json();
            serverEvents = [...serverEvents, ...licenseEvents];
            console.log(`✓ ${server.name}: ${licenseEvents.length} eventos license_plate`);
          }
        } catch (err) {
          console.log(`⚠ ${server.name}: No se pudieron obtener eventos license_plate`);
        }

        // También buscar autos en zonas LPR que tengan sub_label
        const carUrl = new URL(`${server.baseUrl}/api/events`);
        const after = Math.floor(new Date(`${filters.startDate}T${filters.startTime}`).getTime() / 1000);
        const before = Math.floor(new Date(`${filters.endDate}T${filters.endTime}`).getTime() / 1000);
        
        carUrl.searchParams.set('after', after.toString());
        carUrl.searchParams.set('before', before.toString());
        carUrl.searchParams.set('label', 'car');
        carUrl.searchParams.set('zones', 'lpr');
        carUrl.searchParams.set('has_snapshot', '1');
        carUrl.searchParams.set('limit', '1000');
        
        if (serverCameras.length > 0) {
          serverCameras.forEach(camera => {
            carUrl.searchParams.append('camera', camera);
          });
        }

        console.log(`[LPR] Consultando ${server.name} (car+lpr): ${carUrl.toString()}`);
        
        try {
          const carResponse = await fetchWithTimeout(carUrl.toString(), {
            method: 'GET',
            headers
          });

          if (carResponse.ok) {
            const carEvents: FrigateEvent[] = await carResponse.json();
            serverEvents = [...serverEvents, ...carEvents];
            console.log(`✓ ${server.name}: ${carEvents.length} eventos car en zonas LPR`);
          }
        } catch (err) {
          console.log(`⚠ ${server.name}: No se pudieron obtener eventos car+lpr`);
        }

        serverStatus[server.id] = 'online';
        console.log(`✓ ${server.name}: ${serverEvents.length} eventos totales recibidos`);

        // Procesar eventos y filtrar por LPR
        for (const event of serverEvents) {
          const plate = extractPlate(event);
          
          // NUEVO: Solo mostrar eventos con matrícula detectada
          if (!plate || plate === 'No detectada') continue;

          // Filtrar por texto de búsqueda en matrícula
          if (filters.plateSearch && 
              !plate.toLowerCase().includes(filters.plateSearch.toLowerCase())) {
            continue;
          }

          const confidence = extractPlateConfidence(event);

          // Filtrar por confianza mínima
          if (filters.confidenceMin && confidence < filters.confidenceMin) {
            continue;
          }

          // Extraer velocidad
          const speed = event.attributes?.speed_kmh || undefined;

          // Crear evento LPR
          const lprEvent: LPREvent = {
            id: event.id,
            serverId: server.id,
            serverName: server.name,
            camera: event.camera,
            plate: plate,
            timestamp: event.start_time,
            endTime: event.end_time,
            speed: speed,
            confidence: confidence,
            vehicleType: determineVehicleType(event),
            direction: 'unknown', // Podría inferirse de zonas o configuración
            box: event.box,
            has_clip: event.has_clip || false,
            has_snapshot: event.has_snapshot || false,
            score: event.score,
            cropUrl: undefined // Se generará en el componente
          };

          allEvents.push(lprEvent);
        }

      } catch (error) {
        console.error(`✗ Error consultando ${server.name}:`, error);
        
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            serverStatus[server.id] = 'timeout';
          } else {
            serverStatus[server.id] = 'offline';
          }
        } else {
          serverStatus[server.id] = 'offline';
        }
      }
    });

    // Esperar todas las consultas
    await Promise.allSettled(serverPromises);

    // Ordenar por timestamp descendente
    allEvents.sort((a, b) => b.timestamp - a.timestamp);

    // Aplicar paginación
    const startIndex = (filters.page - 1) * filters.limit;
    const endIndex = startIndex + filters.limit;
    const paginatedEvents = allEvents.slice(startIndex, endIndex);
    const hasMore = endIndex < allEvents.length;

    const result: LPRSearchResult = {
      events: paginatedEvents,
      total: allEvents.length,
      page: filters.page,
      limit: filters.limit,
      hasMore: hasMore,
      serverStatus: serverStatus as { [serverId: string]: "online" | "offline" | "timeout" }
    };

    console.log(`🎯 [LPR] Resultado: ${paginatedEvents.length}/${allEvents.length} eventos (página ${filters.page})`);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error en /api/frigate/lpr/events:', error);
    
    return NextResponse.json(
      { 
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido',
        events: [],
        total: 0,
        page: 1,
        limit: 200,
        hasMore: false,
        serverStatus: {}
      } as LPRSearchResult,
      { status: 500 }
    );
  }
}

// Función para parsear parámetros de búsqueda
function parseSearchParams(searchParams: URLSearchParams): LPRFilters & { limit: number; page: number } {
  const after = parseInt(searchParams.get('after') || '0');
  const before = parseInt(searchParams.get('before') || Math.floor(Date.now() / 1000).toString());
  
  // Convertir timestamps a fechas para compatibilidad
  const startDate = new Date(after * 1000).toISOString().split('T')[0];
  const endDate = new Date(before * 1000).toISOString().split('T')[0];
  const startTime = new Date(after * 1000).toTimeString().substring(0, 5);
  const endTime = new Date(before * 1000).toTimeString().substring(0, 5);

  const cameras = searchParams.getAll('camera').filter(Boolean);
  const plateSearch = searchParams.get('plate') || undefined;
  const limit = parseInt(searchParams.get('limit') || '200');
  const page = parseInt(searchParams.get('page') || '1');
  const confidenceMin = parseFloat(searchParams.get('confidence_min') || '0') || undefined;

  return {
    startDate,
    endDate,
    startTime,
    endTime,
    cameras,
    plateSearch,
    confidenceMin,
    limit,
    page
  };
}

// Función para construir URL de eventos de Frigate
function buildEventsUrl(baseUrl: string, filters: any, cameras: string[]): string {
  const url = new URL(`${baseUrl}/api/events`);
  
  // Rango de tiempo
  const after = Math.floor(new Date(`${filters.startDate}T${filters.startTime}`).getTime() / 1000);
  const before = Math.floor(new Date(`${filters.endDate}T${filters.endTime}`).getTime() / 1000);
  
  url.searchParams.set('after', after.toString());
  url.searchParams.set('before', before.toString());
  
  // Buscar tanto autos como license_plates directas
  // Primero intentamos con license_plate directa
  url.searchParams.set('label', 'license_plate');
  url.searchParams.set('has_snapshot', '1');
  url.searchParams.set('limit', '1000'); // Límite alto en servidor, filtraremos después
  
  // Cámaras específicas
  if (cameras.length > 0) {
    cameras.forEach(camera => {
      url.searchParams.append('camera', camera);
    });
  }
  
  return url.toString();
}

// Función para determinar tipo de vehículo
function determineVehicleType(event: FrigateEvent): LPREvent['vehicleType'] {
  const label = event.label?.toLowerCase();
  
  if (label?.includes('truck')) return 'truck';
  if (label?.includes('bus')) return 'bus';  
  if (label?.includes('motorcycle')) return 'motorcycle';
  if (label?.includes('car')) return 'car';
  
  return 'unknown';
}