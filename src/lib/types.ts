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
}

export type FrigateEventLabel = 'person' | 'car' | 'license_plate' | 'dog' | 'cat';

export type FrigateEvent = {
  id: string;
  camera: string;
  label: FrigateEventLabel;
  start_time: number; // unix timestamp
  zones: string[];
  image: string;
  has_clip: boolean;
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

export interface Recording {
  camera: string;
  start_time: number;
  end_time: number;
  duration: number;
  events: number;
}
