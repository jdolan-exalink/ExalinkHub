/**
 * Frigate API Service
 * Servicio para interactuar con la API de Frigate v0.16
 */

import type { FrigateServer } from './frigate-servers';
import { getFrigateHeaders as get_frigate_headers } from './frigate-servers';

export interface FrigateConfig {
  baseUrl: string;
  apiKey?: string;
  extraHeaders?: Record<string, string>;
}

export interface FrigateCamera {
  name: string;
  enabled: boolean;
  recording: {
    enabled: boolean;
  };
  detect: {
    enabled: boolean;
  };
  snapshots: {
    enabled: boolean;
  };
  live: {
    quality: string;
    stream_name: string;
  };
}

export interface FrigateEvent {
  id: string;
  camera: string;
  label: string;
  start_time: number;
  end_time?: number;
  thumbnail: string;
  has_clip: boolean;
  has_snapshot: boolean;
}

export interface FrigateRecording {
  id: string;
  camera: string;
  start_time: number;
  end_time: number;
  duration: number;
  segment_size: number;
}

export interface FrigateRecordingSegment {
  id: string;
  start: number;
  end: number;
  motion_detected: boolean;
}

export interface RecordingTimelineData {
  camera: string;
  date: string;
  segments: FrigateRecordingSegment[];
  events: FrigateEvent[];
}

export interface FrigateStats {
  [key: string]: any;
}

export class FrigateAPI {
  private baseUrl: string;
  private apiKey?: string;
  private extraHeaders: Record<string, string>;
  private timezone_offset: number; // Offset en horas (ej: -3 para UTC-3)

  constructor(config: FrigateConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.extraHeaders = config.extraHeaders ?? {};
    
    // Obtener timezone offset de la configuración
    try {
      const { getConfigDatabase } = require('./config-database');
      const db = getConfigDatabase();
      this.timezone_offset = db.get_timezone_offset();
      console.log(`🌍 Timezone offset configurado: UTC${this.timezone_offset >= 0 ? '+' : ''}${this.timezone_offset}`);
    } catch (error) {
      console.warn('⚠️ No se pudo obtener timezone, usando UTC-3 por defecto');
      this.timezone_offset = -3;
    }
  }

  /**
   * Convierte un timestamp local a UTC (para enviar a Frigate).
   * @param local_timestamp - Timestamp en timezone local (segundos)
   * @returns Timestamp en UTC (segundos)
   */
  private local_to_utc(local_timestamp: number): number {
    return local_timestamp - (this.timezone_offset * 3600);
  }

  /**
   * Convierte un timestamp UTC a local (para mostrar al usuario).
   * @param utc_timestamp - Timestamp en UTC (segundos)
   * @returns Timestamp en timezone local (segundos)
   */
  private utc_to_local(utc_timestamp: number): number {
    return utc_timestamp + (this.timezone_offset * 3600);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    Object.assign(headers, this.extraHeaders);
    
    if (this.apiKey) {
      headers['X-Frigate-API-Key'] = this.apiKey;
    }
    
    return headers;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}/api${endpoint}`;
    
    try {
      console.log(`Frigate API: Making request to ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
      });

      console.log(`Frigate API: Response status ${response.status} for ${endpoint}`);

      if (!response.ok) {
        throw new Error(`Frigate API error: ${response.status} ${response.statusText}`);
      }

      // Get the response text first to check what we received
      const text = await response.text();
      console.log(`Frigate API: Raw response for ${endpoint}:`, text.slice(0, 200));

      // Check if it's actually JSON
      if (!text || text.trim() === '') {
        throw new Error('Empty response from Frigate server');
      }

      // Handle special case for version endpoint that might return just version string
      if (endpoint === '/version' && !text.startsWith('{')) {
        // If it's just a version string like "0.16.1-e664cb2", wrap it in JSON
        return { version: text.trim() } as T;
      }

      // Verify content type for other endpoints
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn(`Frigate API: Expected JSON but got ${contentType} for ${endpoint}`);
        // Try to parse anyway in case it's valid JSON with wrong content-type
      }

      try {
        return JSON.parse(text);
      } catch (parseError) {
        throw new Error(`Failed to parse JSON response from ${endpoint}: ${parseError instanceof Error ? parseError.message : 'Unknown error'}. Response: ${text.slice(0, 200)}`);
      }

    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(`Failed to connect to Frigate server at ${this.baseUrl}. Check if the server is running and accessible.`);
      }
      throw error;
    }
  }

  /**
   * Obtener la versión de Frigate
   */
  async getVersion(): Promise<{ version: string }> {
    return this.request('/version');
  }

  /**
   * Obtener las estadísticas del sistema
   */
  async getStats(): Promise<FrigateStats> {
    return this.request('/stats');
  }

  /**
   * Obtener la configuración completa de Frigate
   */
  async getConfig(): Promise<{ cameras: Record<string, FrigateCamera> }> {
    return this.request('/config');
  }

  /**
   * Obtener lista de cámaras configuradas
   */
  async getCameras(): Promise<string[]> {
    const config = await this.getConfig();
    return Object.keys(config.cameras);
  }

  /**
   * Obtener información detallada de una cámara
   */
  async getCameraInfo(cameraName: string): Promise<FrigateCamera> {
    const config = await this.getConfig();
    const camera = config.cameras[cameraName];
    
    if (!camera) {
      throw new Error(`Camera '${cameraName}' not found`);
    }
    
    return camera;
  }

  /**
   * Obtener snapshot de una cámara
   */
  async getCameraSnapshot(cameraName: string): Promise<Blob> {
    const url = `${this.baseUrl}/api/${cameraName}/latest.jpg`;
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to get snapshot for camera '${cameraName}': ${response.status}`);
    }

    return response.blob();
  }

  /**
   * Obtener URL del stream MJPEG en vivo de una cámara (endpoint correcto)
   */
  getCameraStreamUrl(cameraName: string, quality: 'main' | 'sub' = 'sub'): string {
    return `${this.baseUrl}/api/${cameraName}?stream=${quality}`;
  }

  /**
   * Obtener URL del snapshot/thumbnail de una cámara
   */
  getCameraSnapshotUrl(cameraName: string, options?: { quality?: number; height?: number; width?: number }): string {
    const params = new URLSearchParams();
    if (options?.quality) params.append('quality', options.quality.toString());
    if (options?.height) params.append('height', options.height.toString());
    if (options?.width) params.append('width', options.width.toString());
    
    const queryString = params.toString();
    return `${this.baseUrl}/api/${cameraName}/latest.jpg${queryString ? `?${queryString}` : ''}`;
  }

  /**
   * Obtener URL del stream HLS de una cámara (mejor para web players)
   */
  getCameraHLSUrl(cameraName: string): string {
    return `${this.baseUrl}/api/${cameraName}/hls/stream.m3u8`;
  }

  /**
   * Obtener URL del WebSocket para WebRTC (menor latencia)
   */
  getWebRTCWebSocketUrl(): string {
    return `${this.baseUrl.replace('http', 'ws')}/api/ws`;
  }

  /**
   * Obtener URL del stream RTSP restream
   */
  getCameraRTSPUrl(cameraName: string, rtspPort: number = 8554): string {
    const host = this.baseUrl.replace(/^https?:\/\//, '').split(':')[0];
    return `rtsp://${host}:${rtspPort}/${cameraName}`;
  }

  /**
   * Obtener eventos recientes
   */
  async getEvents(params: {
    limit?: number;
    camera?: string;
    label?: string;
    zone?: string;
    after?: number;
    before?: number;
  } = {}): Promise<FrigateEvent[]> {
    const queryParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        queryParams.append(key, value.toString());
      }
    });

    const endpoint = `/events${queryParams.toString() ? `?${queryParams}` : ''}`;
    return this.request(endpoint);
  }

  /**
   * Obtener grabaciones para una cámara en un rango de tiempo
   */
  async getRecordings(params: {
    camera: string;
    after: number;
    before: number;
  }): Promise<FrigateRecording[]> {
    const { camera, after, before } = params;
    
    console.log('getRecordings called with:', { camera, after, before });
    console.log('Date range:', {
      after: new Date(after * 1000).toISOString(),
      before: new Date(before * 1000).toISOString()
    });

    try {
      // For Frigate 0.16, the recordings endpoint structure has changed
      // Let's try to get recordings using the Frigate API directly
      
      // First, get the summary to see what dates have recordings
      const summaryEndpoint = `/recordings/summary?before=${before}&after=${after}&camera=${camera}`;
      console.log('Fetching summary from:', summaryEndpoint);
      
      const summaryData = await this.request<any>(summaryEndpoint);
      console.log('Summary response:', summaryData);

      const recordings: FrigateRecording[] = [];

      if (summaryData && typeof summaryData === 'object') {
        // For each date that has recordings, create recording segments
        // Since Frigate summary only tells us which dates have recordings,
        // we'll create approximate segments based on events
        
        for (const [date, hasRecordings] of Object.entries(summaryData)) {
          if (hasRecordings && typeof hasRecordings === 'boolean') {
            console.log(`Date ${date} has recordings`);
            
            const dayStart = Math.floor(new Date(date + 'T00:00:00Z').getTime() / 1000);
            const dayEnd = Math.floor(new Date(date + 'T23:59:59Z').getTime() / 1000);
            
            // Create recording segments based on the requested time range
            const segmentStart = Math.max(dayStart, after);
            const segmentEnd = Math.min(dayEnd, before);
            
            if (segmentStart < segmentEnd) {
              // Create hourly segments for better timeline visualization
              let currentHour = segmentStart;
              const oneHour = 3600; // 1 hour in seconds
              
              while (currentHour < segmentEnd) {
                const hourEnd = Math.min(currentHour + oneHour, segmentEnd);
                
                recordings.push({
                  id: `${camera}_${date}_${Math.floor(currentHour / oneHour)}`,
                  camera,
                  start_time: currentHour,
                  end_time: hourEnd,
                  duration: hourEnd - currentHour,
                  path: `${camera}/${date}/${Math.floor(currentHour / oneHour)}.mp4`,
                  size: 0 // We don't have size info from summary
                });
                
                currentHour = hourEnd;
              }
            }
          }
        }
      }
      
      console.log('Generated recordings:', recordings.length, 'segments');
      recordings.forEach(r => console.log(`  ${new Date(r.start_time * 1000).toISOString()} -> ${new Date(r.end_time * 1000).toISOString()}`));
      
      return recordings.sort((a, b) => a.start_time - b.start_time);

    } catch (error) {
      console.error(`Error fetching recordings for ${camera}:`, error);
      return [];
    }
  }

  /**
   * Obtener timeline de grabaciones y eventos para una cámara en un día
   */
  async getRecordingTimeline(camera: string, date: string): Promise<RecordingTimelineData> {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);
    
    const after = Math.floor(startDate.getTime() / 1000);
    const before = Math.floor(endDate.getTime() / 1000);

    // Obtener grabaciones y eventos en paralelo
    const [recordings, events] = await Promise.all([
      this.getRecordings({ camera, after, before }),
      this.getEvents({ camera, after, before, limit: 1000 })
    ]);

    // Convertir grabaciones a segmentos de timeline
    const segments: FrigateRecordingSegment[] = recordings.map(recording => ({
      start_time: recording.start_time,
      end_time: recording.end_time,
      duration: recording.duration,
      events: events.filter(event => 
        event.start_time >= recording.start_time && 
        event.start_time <= recording.end_time
      ).length
    }));

    return {
      segments,
      events
    };
  }

  /**
   * Obtener días con grabaciones disponibles para una cámara
   */
  async getRecordingDays(camera: string, month: number, year: number): Promise<string[]> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Último día del mes
    
    const after = Math.floor(startDate.getTime() / 1000);
    const before = Math.floor(endDate.getTime() / 1000);

    try {
      const endpoint = `/recordings/summary?before=${before}&after=${after}&camera=${camera}`;
      const data = await this.request<any>(endpoint);
      
      // Extraer las fechas que tienen grabaciones
      const daysWithRecordings: string[] = [];
      
      if (data && typeof data === 'object') {
        Object.keys(data).forEach(date => {
          const dateData = data[date];
          // Check if date has recordings (boolean true or array with recordings)
          if (dateData === true || (Array.isArray(dateData) && dateData.length > 0)) {
            daysWithRecordings.push(date);
          }
        });
      }
      
      return daysWithRecordings.sort();
    } catch (error) {
      console.error(`Error fetching recording days for ${camera}:`, error);
      return [];
    }
  }

  /**
   * Obtener URL del stream HLS de grabación (recomendado)
   */
  getRecordingStreamUrl(camera: string, startTime: number, endTime: number): string {
    // Usar el endpoint VOD de Frigate 0.16 para streaming HLS
    return `${this.baseUrl}/vod/${camera}/start/${startTime}/end/${endTime}/master.m3u8`;
  }

  /**
   * Generar URL de descarga para un clip de video (Frigate 0.16)
   */
  getRecordingClipUrl(camera: string, startTime: number, endTime: number): string {
    // Usar el endpoint de exportación correcto de Frigate 0.16
    return `${this.baseUrl}/api/export/${camera}/start/${startTime}/end/${endTime}`;
  }

  /**
   * Verificar si hay stream HLS disponible
   */
  async checkHLSStream(camera: string, startTime: number, endTime: number): Promise<boolean> {
    const url = this.getRecordingStreamUrl(camera, startTime, endTime);
    
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verificar si existen grabaciones para una cámara en un rango de tiempo
   * IMPORTANTE: start_time y end_time deben venir en timezone LOCAL
   */
  async check_recordings_available(camera: string, start_time: number, end_time: number): Promise<{ available: boolean; duration?: number; message?: string }> {
    try {
      // IMPORTANTE: Frigate trabaja en timezone local del servidor, NO en UTC
      // Por lo tanto, NO debemos convertir los timestamps

      // Log para debugging utilizando timestamps en UTC y zona local
      const start_time_utc = this.local_to_utc(start_time);
      const end_time_utc = this.local_to_utc(end_time);
      const now_utc_seconds = Math.floor(Date.now() / 1000);
      const tolerance_seconds = 120; // tolerancia por desfase de relojes (~2 minutos)

      const start_date_local = new Date((start_time_utc + this.timezone_offset * 3600) * 1000);
      const end_date_local = new Date((end_time_utc + this.timezone_offset * 3600) * 1000);
      const start_date_utc = new Date(start_time_utc * 1000);
      const end_date_utc = new Date(end_time_utc * 1000);
      const now_utc = new Date(now_utc_seconds * 1000);
      const is_future = start_time_utc > (now_utc_seconds + tolerance_seconds);
      
      console.log('🔍 Verificando grabaciones:', {
        camera,
        start_time,
        end_time,
        start_date_local: start_date_local.toISOString(),
        end_date_local: end_date_local.toISOString(),
        start_date_utc: start_date_utc.toISOString(),
        end_date_utc: end_date_utc.toISOString(),
        current_date_utc: now_utc.toISOString(),
        timezone_offset: this.timezone_offset,
        tolerance_seconds,
        is_future,
        duration_requested: end_time - start_time,
      });

      // Verificar si la fecha LOCAL (convertida a UTC) es futura
      if (is_future) {
        console.warn('❌ Fecha de inicio es futura:', {
          start_date_local: start_date_local.toISOString(),
          start_date_utc: start_date_utc.toISOString(),
          now_utc: now_utc.toISOString(),
          tolerance_seconds,
        });
        return { 
          available: false, 
          duration: 0,
          message: `Start time is in the future (${start_date_local.toISOString()}). Cannot export recordings that don't exist yet.` 
        };
      }

      // Usar el endpoint de recordings para verificar disponibilidad (con timestamps locales)
      const url = `${this.baseUrl}/api/${camera}/recordings/summary`;
      const params = new URLSearchParams({
        after: String(start_time),
        before: String(end_time),
      });

      console.log('📡 Consultando Frigate (local timezone):', `${url}?${params}`);

      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        console.warn('⚠️ Failed to check recordings availability:', response.status);
        // Si falla la verificación, NO permitir continuar - mejor prevenir
        return { 
          available: false, 
          message: `Frigate API returned ${response.status}. Cannot verify recordings.` 
        };
      }

      const data = await response.json();
      console.log('📊 Datos de grabaciones recibidos:', data);
      
      // Verificar si hay datos de grabación
      if (Array.isArray(data) && data.length > 0) {
        const total_duration = data.reduce((sum: number, rec: any) => sum + (rec.duration || 0), 0);
        console.log('✅ Grabaciones encontradas. Duración total:', total_duration, 'segundos');
        
        // Si la duración es 0, significa que no hay grabaciones reales
        if (total_duration === 0) {
          return { 
            available: false, 
            duration: 0,
            message: 'No recordings with actual content found for this time range' 
          };
        }
        
        return { available: true, duration: total_duration };
      }

      console.log('❌ No se encontraron datos de grabación');
      return { available: false, duration: 0, message: 'No recordings found for this time range' };
    } catch (error) {
      console.error('❌ Error checking recordings availability:', error);
      // En caso de error, NO permitir que continúe
      return { 
        available: false, 
        message: `Error verifying recordings: ${error instanceof Error ? error.message : String(error)}` 
      };
    }
  }

  /**
   * Iniciar exportación de clip de video
   * NOTA: Frigate 0.16-0 no soporta el endpoint /api/{camera}/recordings/export
   * Este método ya no intenta crear exports, solo retorna error descriptivo
   */
  async startRecordingExport(camera: string, startTime: number, endTime: number, options?: { name?: string; playback?: string }): Promise<string> {
    console.log('🎬 Export requested:', {
      camera,
      startTime,
      endTime,
      start_date: new Date(startTime * 1000).toISOString(),
      end_date: new Date(endTime * 1000).toISOString(),
      duration: endTime - startTime,
      name: options?.name,
    });

    // Frigate 0.16-0 no tiene endpoint de export funcional
    // El endpoint documentado /api/{camera}/recordings/export no existe en esta versión
    const error_msg = `Recording export is not supported in Frigate 0.16-0. 
      
Available alternatives:
1. Download event clips: GET /api/events/{event_id}/clip.mp4
2. Use HLS streaming: /vod/{camera}/start/{start}/end/{end}/master.m3u8
3. Upgrade Frigate to version 0.17+ for export support

Requested: ${camera} from ${new Date(startTime * 1000).toISOString()} to ${new Date(endTime * 1000).toISOString()}`;

    console.error('❌ Export not supported:', error_msg);
    throw new Error(error_msg);
  }

  /**
   * Esperar a que un export esté listo para descargar
   * Hace polling del estado hasta que complete o falle
   */
  async wait_for_export_ready(
    export_id: string, 
    options?: { 
      max_wait_ms?: number; 
      poll_interval_ms?: number;
      on_progress?: (progress: number, status: string) => void;
    }
  ): Promise<{ ready: boolean; status: string; download_path?: string; error?: string }> {
    const max_wait = options?.max_wait_ms ?? 300000; // 5 minutos por defecto
    const poll_interval = options?.poll_interval_ms ?? 2000; // 2 segundos por defecto
    const start_time = Date.now();

    while (Date.now() - start_time < max_wait) {
      try {
        const status_data = await this.getExportStatus(export_id);
        const status = status_data.status?.toLowerCase() || 'unknown';
        const progress = status_data.progress ?? 0;

        // Notificar progreso si hay callback
        if (options?.on_progress) {
          options.on_progress(progress, status);
        }

        // Verificar si está completo
        if (status === 'complete' || status === 'completed') {
          return {
            ready: true,
            status: 'complete',
            download_path: status_data.download_path,
          };
        }

        // Verificar si falló
        if (status === 'failed' || status === 'error') {
          return {
            ready: false,
            status: 'failed',
            error: 'Export failed during processing',
          };
        }

        // Si está procesando, esperar antes de volver a verificar
        if (status === 'processing' || status === 'pending' || status === 'running') {
          await new Promise(resolve => setTimeout(resolve, poll_interval));
          continue;
        }

        // Estado desconocido, esperar un poco más
        await new Promise(resolve => setTimeout(resolve, poll_interval));
      } catch (error) {
        console.warn('Error checking export status:', error);
        // Esperar antes de reintentar
        await new Promise(resolve => setTimeout(resolve, poll_interval));
      }
    }

    // Timeout alcanzado
    return {
      ready: false,
      status: 'timeout',
      error: `Export did not complete within ${max_wait / 1000} seconds`,
    };
  }

  /**
   * Obtener estado de exportación
   */
  async getExportStatus(exportId: string): Promise<{ status: string; progress?: number; download_path?: string }> {
    const url = `${this.baseUrl}/api/export/${exportId}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      // If 405, try different endpoint structure
      if (response.status === 405) {
        // Try alternative endpoint - some Frigate versions use different paths
        const altUrl = `${this.baseUrl}/api/exports/${exportId}`;
        const altResponse = await fetch(altUrl, {
          method: 'GET',
          headers: this.getHeaders(),
        });
        
        if (altResponse.ok) {
          return altResponse.json();
        }
        
        // If still fails, return a simulated complete status for direct download
        console.warn('Export status endpoint not available, assuming export is ready');
        return { status: 'complete' };
      }
      
      // Include body for diagnostics
      let bodyText = '';
      try { bodyText = await response.text(); } catch (e) { bodyText = `<failed to read response body: ${e instanceof Error ? e.message : String(e)}>`; }
      throw new Error(`Failed to get export status: ${response.status} ${response.statusText} - ${bodyText}`);
    }

    return response.json();
  }

  /**
   * Listar exports existentes en el servidor Frigate
   * Devuelve un array de objetos con información básica de cada export.
   */
  async list_exports(): Promise<Array<{ export_id: string; name?: string; status?: string; created_at?: string; download_path?: string; camera?: string; start_time?: number; end_time?: number }>> {
    // Algunos Frigate exponen /api/exports o /api/export/list; intentamos ambos
    const candidates = ['/exports', '/export/list', '/export'];

    for (const endpoint of candidates) {
      try {
        const url = `${this.baseUrl}/api${endpoint}`;
        console.log('Attempting to list exports from', url);
        const response = await fetch(url, { headers: this.getHeaders() });
        if (!response.ok) {
          console.warn(`List exports endpoint ${endpoint} returned ${response.status}`);
          continue;
        }

        const text = await response.text();
        if (!text || text.trim() === '') {
          continue;
        }

        try {
          const data = JSON.parse(text);
          // Normalizar varias formas posibles de respuesta
          // Esperamos un array de objetos o un mapa { exports: [...] }
          let items: any[] = [];
          if (Array.isArray(data)) items = data;
          else if (data && Array.isArray(data.exports)) items = data.exports;
          else if (data && Array.isArray(data.items)) items = data.items;

          // Mapear a forma simplificada
          const mapped = items.map((it: any) => ({
            export_id: it.export_id || it.id || it.name || String(it),
            name: it.name || it.export_name || undefined,
            status: it.status || undefined,
            created_at: it.created_at || it.created || undefined,
            download_path: it.download_path || it.path || undefined,
            camera: it.camera || undefined,
            start_time: it.start_time || undefined,
            end_time: it.end_time || undefined,
          }));

          return mapped;
        } catch (parseErr) {
          console.warn('Failed to parse list exports response:', parseErr instanceof Error ? parseErr.message : String(parseErr));
          continue;
        }
      } catch (err) {
        console.warn('Error while trying to call list exports endpoint', endpoint, err instanceof Error ? err.message : String(err));
        continue;
      }
    }

    // Si no encontramos ningún endpoint, devolver array vacío
    return [];
  }

  /**
   * Eliminar un export del servidor Frigate
   * @param export_id - ID del export a eliminar
   * @returns true si se eliminó correctamente, false en caso contrario
   */
  async delete_export(export_id: string): Promise<boolean> {
    const url = `${this.baseUrl}/api/export/${export_id}`;
    
    try {
      console.log('Deleting export:', export_id, 'from', url);
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        let bodyText = '';
        try { bodyText = await response.text(); } catch (e) { bodyText = `<failed to read response body: ${e instanceof Error ? e.message : String(e)}>`; }
        console.error(`Failed to delete export ${export_id}: ${response.status} ${response.statusText} - ${bodyText}`);
        return false;
      }

      console.log('Export deleted successfully:', export_id);
      return true;
    } catch (err) {
      console.error('Error deleting export:', err instanceof Error ? err.message : String(err));
      return false;
    }
  }

  /**
   * Descargar clip de video completado
   */
  async downloadExportedClip(exportId: string): Promise<Blob> {
    const url = `${this.baseUrl}/api/export/${exportId}/download`;
    
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      let bodyText = '';
      try { bodyText = await response.text(); } catch (e) { bodyText = `<failed to read response body: ${e instanceof Error ? e.message : String(e)}>`; }
      throw new Error(`Failed to download exported clip: ${response.status} ${response.statusText} - ${bodyText}`);
    }

    return response.blob();
  }

  /**
   * Descargar clip de video usando el endpoint directo start/end de Frigate.
   * @param camera - Nombre de la cámara configurada en Frigate
   * @param startTime - Timestamp de inicio en segundos (zona horaria local)
   * @param endTime - Timestamp de fin en segundos (zona horaria local)
   */
  async downloadRecordingClip(
    camera: string,
    startTime: number,
    endTime: number,
    options?: { disable_recording_file_fallback?: boolean }
  ): Promise<Blob> {
    const sanitized_camera = encodeURIComponent(camera);
    const start_seconds = Math.floor(startTime);
    const end_seconds = Math.floor(endTime);

    if (end_seconds <= start_seconds) {
      throw new Error(`Invalid time range for clip download: start ${start_seconds} >= end ${end_seconds}`);
    }

    const clip_url = `${this.baseUrl}/api/${sanitized_camera}/start/${start_seconds}/end/${end_seconds}/clip.mp4`;
    console.log('Frigate direct clip download URL:', clip_url);

    const max_attempts = 3;
    const retry_delay_ms = 2000;
    let last_empty_payload = false;
    let array_buffer: ArrayBuffer | null = null;

    for (let attempt = 1; attempt <= max_attempts; attempt += 1) {
      last_empty_payload = false;

      const response = await fetch(clip_url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        let body_text = '';
        try {
          body_text = await response.text();
        } catch (error) {
          body_text = `<failed to read body: ${error instanceof Error ? error.message : String(error)}>`;
        }

        throw new Error(`Failed to download clip directly: ${response.status} ${response.statusText} - ${body_text}`);
      }

      array_buffer = await response.arrayBuffer();
      if (array_buffer && array_buffer.byteLength > 0) {
        break;
      }

      last_empty_payload = true;
      console.warn(`Frigate clip download attempt ${attempt}/${max_attempts} returned empty payload`, {
        camera,
        start_seconds,
        end_seconds,
        clip_url,
      });

      if (attempt < max_attempts) {
        await new Promise((resolve) => setTimeout(resolve, retry_delay_ms));
      }
    }

    if (!array_buffer || array_buffer.byteLength === 0 || last_empty_payload) {
      console.warn('Frigate clip download exhausted retries with empty payload, attempting HLS fallback', {
        camera,
        start_seconds,
        end_seconds,
        clip_url,
      });

      const hls_blob = await this.downloadRecordingClipFromHls(camera, start_seconds, end_seconds).catch((error) => {
        console.warn(
          'HLS fallback failed:',
          error instanceof Error ? error.message : String(error)
        );
        return null;
      });

      if (hls_blob) {
        return hls_blob;
      }

      if (!options?.disable_recording_file_fallback) {
        const recording_blob = await this.downloadRecordingClipFromRecordingFiles(
          camera,
          start_seconds,
          end_seconds
        ).catch((error) => {
          console.warn(
            'Recording file fallback failed:',
            error instanceof Error ? error.message : String(error)
          );
          return null;
        });

        if (recording_blob) {
          return recording_blob;
        }
      }

      throw new Error('frigate_clip_empty');
    }

    const byte_view = new Uint8Array(array_buffer);
    const has_ftyp_box =
      byte_view.length >= 8 &&
      byte_view[4] === 0x66 &&
      byte_view[5] === 0x74 &&
      byte_view[6] === 0x79 &&
      byte_view[7] === 0x70;

    if (!has_ftyp_box) {
      console.warn('Frigate clip download does not contain ftyp box at expected offset', {
        first_bytes: Array.from(byte_view.slice(0, 12)),
        clip_url,
      });
    }

    return new Blob([array_buffer], { type: 'video/mp4' });
  }

  private async downloadRecordingClipFromHls(
    camera: string,
    start_seconds: number,
    end_seconds: number
  ): Promise<Blob | null> {
    const sanitized_camera = encodeURIComponent(camera);
    const vod_base = `${this.baseUrl}/vod/${sanitized_camera}/start/${start_seconds}/end/${end_seconds}`;
    const master_url = `${vod_base}/master.m3u8`;

    const fetch_with_headers = async (url: string) => {
      return fetch(url, { headers: this.getHeaders() });
    };

    const master_response = await fetch_with_headers(master_url);
    if (!master_response.ok) {
      throw new Error(`Failed to fetch HLS master playlist: ${master_response.status} ${master_response.statusText}`);
    }

    const master_text = await master_response.text();
    const variant_line = master_text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0 && !line.startsWith('#') && line.endsWith('.m3u8'));

    if (!variant_line) {
      throw new Error('HLS master playlist does not contain any variant streams');
    }

    const variant_url = new URL(variant_line, master_url).toString();
    const variant_response = await fetch_with_headers(variant_url);
    if (!variant_response.ok) {
      throw new Error(`Failed to fetch HLS variant playlist: ${variant_response.status} ${variant_response.statusText}`);
    }

    const variant_text = await variant_response.text();
    const lines = variant_text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    let init_uri: string | null = null;
    const segment_uris: string[] = [];

    for (const line of lines) {
      if (line.startsWith('#EXT-X-MAP:')) {
        const matches = /URI="([^"]+)"/.exec(line);
        if (matches && matches[1]) {
          init_uri = new URL(matches[1], variant_url).toString();
        }
      } else if (!line.startsWith('#')) {
        segment_uris.push(new URL(line, variant_url).toString());
      }
    }

    if (segment_uris.length === 0) {
      throw new Error('HLS variant playlist does not contain any segments');
    }

    const buffers: Uint8Array[] = [];

    if (init_uri) {
      const init_response = await fetch_with_headers(init_uri);
      if (!init_response.ok) {
        throw new Error(`Failed to fetch HLS init segment: ${init_response.status} ${init_response.statusText}`);
      }
      buffers.push(new Uint8Array(await init_response.arrayBuffer()));
    }

    for (const segment_uri of segment_uris) {
      const segment_response = await fetch_with_headers(segment_uri);
      if (!segment_response.ok) {
        throw new Error(`Failed to fetch HLS segment ${segment_uri}: ${segment_response.status} ${segment_response.statusText}`);
      }
      buffers.push(new Uint8Array(await segment_response.arrayBuffer()));
    }

    const total_length = buffers.reduce((sum, chunk) => sum + chunk.length, 0);
    if (total_length === 0) {
      return null;
    }

    const merged = new Uint8Array(total_length);
    let offset = 0;
    for (const chunk of buffers) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return new Blob([merged], { type: 'video/mp4' });
  }

  /**
   * Activar/Desactivar grabaciones para una cámara
   */
  async setRecording(cameraName: string, enabled: boolean): Promise<{ success: boolean; message?: string }> {
    const endpoint = `/${cameraName}/recordings/set`;
    
    try {
      await fetch(`${this.baseUrl}/api${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: enabled ? 'ON' : 'OFF',
      });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Activar/Desactivar detección para una cámara
   */
  async setDetection(cameraName: string, enabled: boolean): Promise<{ success: boolean; message?: string }> {
    const endpoint = `/${cameraName}/detect/set`;
    
    try {
      await fetch(`${this.baseUrl}/api${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: enabled ? 'ON' : 'OFF',
      });
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Probar la conexión con Frigate
   */
  async testConnection(): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      const version = await this.getVersion();
      return { success: true, version: version.version };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      };
    }
  }
}

/**
 * Crea una instancia de FrigateAPI aplicando las cabeceras de autenticación
 * configuradas para un servidor activo.
 */
export function create_frigate_api(server: FrigateServer): FrigateAPI {
  const auth_headers = get_frigate_headers(server);
  const sanitized_headers: Record<string, string> = { ...auth_headers };
  delete sanitized_headers['Content-Type'];

  return new FrigateAPI({
    baseUrl: server.baseUrl,
    extraHeaders: sanitized_headers
  });
}
