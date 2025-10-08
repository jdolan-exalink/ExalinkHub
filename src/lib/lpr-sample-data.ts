/**
 * Datos de ejemplo para el sistema LPR
 * Se utilizan cuando no hay datos reales disponibles en la base de datos
 */

export interface SampleLPRReading {
  id: number;
  plate: string;
  camera: string;
  confidence: number;
  timestamp: number;
  vehicle_type?: string;
  speed?: number;
  direction?: string;
  server_name: string;
  local_files?: {
    snapshot_url?: string;
    clip_url?: string;
    crop_url?: string;
  };
}

/**
 * Datos de ejemplo de lecturas LPR
 * Representan lecturas típicas que se podrían encontrar en un sistema real
 */
export const sampleLPRReadings: SampleLPRReading[] = [
  {
    id: 1,
    plate: "ABC123",
    camera: "Cámara Principal Entrada",
    confidence: 0.95,
    timestamp: Date.now() - 3600000, // 1 hora atrás
    vehicle_type: "Sedán",
    speed: 45,
    direction: "Entrada",
    server_name: "Servidor Principal"
  },
  {
    id: 2,
    plate: "XYZ789",
    camera: "Cámara Salida Norte",
    confidence: 0.89,
    timestamp: Date.now() - 7200000, // 2 horas atrás
    vehicle_type: "SUV",
    speed: 38,
    direction: "Salida",
    server_name: "Servidor Principal"
  },
  {
    id: 3,
    plate: "DEF456",
    camera: "Cámara Principal Entrada",
    confidence: 0.92,
    timestamp: Date.now() - 10800000, // 3 horas atrás
    vehicle_type: "Camioneta",
    speed: 42,
    direction: "Entrada",
    server_name: "Servidor Principal"
  },
  {
    id: 4,
    plate: "GHI012",
    camera: "Cámara Estacionamiento",
    confidence: 0.87,
    timestamp: Date.now() - 14400000, // 4 horas atrás
    vehicle_type: "Hatchback",
    speed: 15,
    direction: "Estacionamiento",
    server_name: "Servidor Secundario"
  },
  {
    id: 5,
    plate: "JKL345",
    camera: "Cámara Salida Sur",
    confidence: 0.94,
    timestamp: Date.now() - 18000000, // 5 horas atrás
    vehicle_type: "Motocicleta",
    speed: 35,
    direction: "Salida",
    server_name: "Servidor Principal"
  },
  {
    id: 6,
    plate: "MNO678",
    camera: "Cámara Principal Entrada",
    confidence: 0.91,
    timestamp: Date.now() - 21600000, // 6 horas atrás
    vehicle_type: "Furgoneta",
    speed: 40,
    direction: "Entrada",
    server_name: "Servidor Principal"
  },
  {
    id: 7,
    plate: "PQR901",
    camera: "Cámara Vigilancia Este",
    confidence: 0.88,
    timestamp: Date.now() - 25200000, // 7 horas atrás
    vehicle_type: "Sedán",
    speed: 48,
    direction: "Entrada",
    server_name: "Servidor Secundario"
  },
  {
    id: 8,
    plate: "STU234",
    camera: "Cámara Salida Norte",
    confidence: 0.93,
    timestamp: Date.now() - 28800000, // 8 horas atrás
    vehicle_type: "SUV",
    speed: 41,
    direction: "Salida",
    server_name: "Servidor Principal"
  },
  {
    id: 9,
    plate: "VWX567",
    camera: "Cámara Principal Entrada",
    confidence: 0.96,
    timestamp: Date.now() - 32400000, // 9 horas atrás
    vehicle_type: "Camioneta",
    speed: 37,
    direction: "Entrada",
    server_name: "Servidor Principal"
  },
  {
    id: 10,
    plate: "YZA890",
    camera: "Cámara Estacionamiento",
    confidence: 0.85,
    timestamp: Date.now() - 36000000, // 10 horas atrás
    vehicle_type: "Compacto",
    speed: 12,
    direction: "Estacionamiento",
    server_name: "Servidor Secundario"
  }
];

/**
 * Función para obtener datos de ejemplo filtrados
 * @param searchTerm - Término de búsqueda para filtrar por matrícula
 * @returns Array de lecturas filtradas
 */
export function getFilteredSampleData(searchTerm?: string): SampleLPRReading[] {
  if (!searchTerm || searchTerm.trim() === '') {
    return sampleLPRReadings;
  }

  const term = searchTerm.toLowerCase().trim();
  return sampleLPRReadings.filter(reading =>
    reading.plate.toLowerCase().includes(term)
  );
}

/**
 * Función para verificar si debemos mostrar datos de ejemplo
 * @param realData - Datos reales de la base de datos
 * @returns true si debemos mostrar datos de ejemplo
 */
export function shouldShowSampleData(realData: any[]): boolean {
  return !realData || realData.length === 0;
}