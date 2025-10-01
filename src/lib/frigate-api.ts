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
    
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Frigate API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
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