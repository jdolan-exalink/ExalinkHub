export interface FrigateServer {
  id: string;
  name: string;
  url: string;
  status: 'online' | 'offline';
  version?: string;
  apiKey?: string;
}

export interface Camera {
  id: string;
  name: string;
  enabled: boolean;
  recording: boolean;
  detection: boolean;
  snapshots: boolean;
  streamUrl: string;
  snapshotUrl: string;
  server: string;
  server_id?: number; // ID del servidor en la configuración
  server_name?: string; // Nombre del servidor
}

export type FrigateEventLabel = 'person' | 'car' | 'license_plate' | 'dog' | 'cat';

export type FrigateEvent = {
  id: string;
  camera: string;
  label: FrigateEventLabel;
  sub_label?: string; // Para matrículas leídas por LPR
  start_time: number; // unix timestamp
  end_time?: number;
  zones: string[];
  image: string;
  has_clip: boolean;
  has_snapshot: boolean;
  score: number; // confianza del objeto
  top_score: number; // máxima confianza
  box?: [number, number, number, number]; // bbox [x1, y1, x2, y2]
  attributes?: {
    license_plate?: string; // matrícula alternativa
    speed_kmh?: number; // velocidad si disponible
    plate_confidence?: number; // confianza específica de la placa
  };
  plus?: {
    lpr?: {
      plate?: string; // otra ubicación posible para la matrícula
    };
  };
};

export type CategorizedEvent = {
    category: string;
    priority: 'high' | 'medium' | 'low';
    reason: string;
};

export interface Event {
  id: string;
  camera: string;
  label: string;
  start_time: number;
  end_time?: number;
  thumbnail: string;
  has_clip: boolean;
  has_snapshot: boolean;
  score: number;
}

// Interface para detecciones de matrículas
export interface LPREvent {
  id: string;
  serverId: string; // ID del servidor Frigate
  serverName: string; // Nombre del servidor
  camera: string;
  plate: string; // matrícula leída
  timestamp: number; // start_time del evento
  endTime?: number; // end_time del evento
  speed?: number; // velocidad en km/h
  confidence: number; // confianza de la lectura (0-1)
  vehicleType?: 'car' | 'truck' | 'motorcycle' | 'bus' | 'unknown';
  direction?: 'entry' | 'exit' | 'unknown';
  box?: [number, number, number, number]; // bbox para recorte
  has_clip: boolean;
  has_snapshot: boolean;
  score: number; // confianza general del objeto
  cropUrl?: string; // URL del recorte de la matrícula
}

// Interface para configuración de cámaras por servidor
export interface ServerCamera {
  serverId: string;
  serverName: string;
  cameraName: string;
  enabled: boolean;
}

// Interface para respuesta de búsqueda LPR
export interface LPRSearchResult {
  events: LPREvent[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  serverStatus: {
    [serverId: string]: 'online' | 'offline' | 'timeout';
  };
}

// Interface para filtros de búsqueda LPR
export interface LPRFilters {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  cameras: string[]; // array de "serverId:cameraName"
  plateSearch?: string; // texto de búsqueda en matrícula
  speedMin?: number;
  speedMax?: number;
  confidenceMin?: number; // filtro por confianza mínima
  vehicleTypes?: string[];
  serverIds?: string[]; // filtrar por servidores específicos
}

// Interface para semáforo de confianza
export interface ConfidenceLevel {
  level: 'high' | 'medium' | 'low';
  color: 'green' | 'yellow' | 'red';
  threshold: number;
}

// Interface para detecciones de matrículas (componente existente)
export interface PlateDetection {
  id: string;
  plate: string;
  camera: string;
  timestamp: number;
  speed?: number;
  confidence: number;
  image: string;
  has_clip: boolean;
  vehicle_type: 'car' | 'truck' | 'motorcycle' | 'bus';
  direction: 'entry' | 'exit' | 'unknown';
}

// Interface para filtros de matrículas
export interface PlateFilters {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  cameras: string[];
  plateSearch: string;
  speedMin?: number;
  speedMax?: number;
  vehicleTypes: string[];
}

// Interface para datos de conteo
export interface CountingData {
  camera: string;
  total: number;
  entries: number;
  exits: number;
  vehicles: {
    cars: number;
    trucks: number;
    motorcycles: number;
    buses: number;
    bicycles: number;
  };
}

// Interface para datos de conteo por hora
export interface HourlyCount {
  hour: number;
  entries: number;
  exits: number;
  total: number;
}

// Interface para métricas generales de conteo
export interface CountingMetrics {
  totalVehicles: number;
  totalEntries: number;
  totalExits: number;
  vehicleBreakdown: {
    cars: number;
    trucks: number;
    motorcycles: number;
    buses: number;
    bicycles: number;
  };
  hourlyData: HourlyCount[];
  cameraData: CountingData[];
}

// Interface para filtros de conteo
export interface CountingFilters {
  date: string;
  cameras: string[];
  vehicleTypes: string[];
}

export interface Recording {
  camera: string;
  start_time: number;
  end_time: number;
  duration: number;
  events: number;
}
