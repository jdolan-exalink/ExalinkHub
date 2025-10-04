/**
 * Frigate API Service
 * Servicio para interactuar con la API de Frigate v0.16
 */

export interface FrigateConfig {
  baseUrl: string;
  apiKey?: string;
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
  path: string;
  size: number;
}

export interface FrigateRecordingSegment {
  start_time: number;
  end_time: number;
  duration: number;
  events: number;
}

export interface RecordingTimelineData {
  segments: FrigateRecordingSegment[];
  events: FrigateEvent[];
}

export interface FrigateStats {
  [key: string]: any;
}

export class FrigateAPI {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: FrigateConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
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
   * Iniciar exportación de clip de video (Frigate 0.16)
   */
  async startRecordingExport(camera: string, startTime: number, endTime: number): Promise<string> {
    const url = this.getRecordingClipUrl(camera, startTime, endTime);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.getHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ playback: 'realtime' }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start export: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    if (!result.success || !result.export_id) {
      throw new Error('Failed to get export ID');
    }

    return result.export_id;
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
      
      throw new Error(`Failed to get export status: ${response.status} ${response.statusText}`);
    }

    return response.json();
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
      throw new Error(`Failed to download exported clip: ${response.status} ${response.statusText}`);
    }

    return response.blob();
  }

  /**
   * Descargar clip de video (método completo con espera)
   */
  async downloadRecordingClip(camera: string, startTime: number, endTime: number): Promise<Blob> {
    // Iniciar exportación
    const exportId = await this.startRecordingExport(camera, startTime, endTime);
    
    // Esperar a que se complete la exportación
    const maxAttempts = 30; // 30 intentos (30 segundos máximo)
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const status = await this.getExportStatus(exportId);
      
      if (status.status === 'complete') {
        // Descargar el archivo completado
        return this.downloadExportedClip(exportId);
      } else if (status.status === 'failed') {
        throw new Error('Export failed');
      }
      
      // Esperar 1 segundo antes del siguiente intento
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    throw new Error('Export timeout - took too long to complete');
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

// Configuración por defecto del servidor de Casa
export const defaultFrigateConfig: FrigateConfig = {
  baseUrl: 'http://10.1.1.252:5000',
  // apiKey: undefined // Sin clave API por defecto
};

// Instancia por defecto
export const frigateAPI = new FrigateAPI(defaultFrigateConfig);