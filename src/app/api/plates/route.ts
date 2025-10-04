import { NextRequest, NextResponse } from 'next/server';
import type { PlateDetection } from '@/lib/types';

// Datos mock para detecciones de matrículas
const generateMockPlateDetections = (count: number = 50): PlateDetection[] => {
  const plates = ['ABC123', 'XYZ789', 'DEF456', 'GHI012', 'JKL345', 'MNO678', 'PQR901', 'STU234', 'VWX567', 'YZA890'];
  const cameras = ['acceso_sur', 'entrada_principal', 'salida_norte', 'portones'];
  const vehicleTypes: Array<'car' | 'truck' | 'motorcycle' | 'bus'> = ['car', 'truck', 'motorcycle', 'bus'];
  const directions: Array<'entry' | 'exit' | 'unknown'> = ['entry', 'exit', 'unknown'];
  
  const detections: PlateDetection[] = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    const timestamp = now - (Math.random() * 24 * 60 * 60 * 1000); // Últimas 24 horas
    const vehicleType = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
    
    detections.push({
      id: `plate-${i + 1}`,
      plate: plates[Math.floor(Math.random() * plates.length)] + Math.floor(Math.random() * 100),
      camera: cameras[Math.floor(Math.random() * cameras.length)],
      timestamp: Math.floor(timestamp / 1000),
      speed: vehicleType === 'car' ? Math.floor(Math.random() * 100) + 30 : undefined,
      confidence: 0.8 + Math.random() * 0.2,
      image: `/api/placeholder/plate-${i + 1}.jpg`,
      has_clip: Math.random() > 0.3,
      vehicle_type: vehicleType,
      direction: directions[Math.floor(Math.random() * directions.length)]
    });
  }
  
  return detections.sort((a, b) => b.timestamp - a.timestamp);
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const camera = searchParams.get('camera');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const plateSearch = searchParams.get('plate');
  const speedMin = searchParams.get('speedMin');
  const speedMax = searchParams.get('speedMax');
  
  try {
    let detections = generateMockPlateDetections(100);
    
    // Aplicar filtros
    if (camera && camera !== 'all') {
      detections = detections.filter(d => d.camera === camera);
    }
    
    if (startDate) {
      const startTimestamp = new Date(startDate).getTime() / 1000;
      detections = detections.filter(d => d.timestamp >= startTimestamp);
    }
    
    if (endDate) {
      const endTimestamp = new Date(endDate).getTime() / 1000;
      detections = detections.filter(d => d.timestamp <= endTimestamp);
    }
    
    if (plateSearch) {
      detections = detections.filter(d => 
        d.plate.toLowerCase().includes(plateSearch.toLowerCase())
      );
    }
    
    if (speedMin) {
      const minSpeed = parseInt(speedMin);
      detections = detections.filter(d => d.speed && d.speed >= minSpeed);
    }
    
    if (speedMax) {
      const maxSpeed = parseInt(speedMax);
      detections = detections.filter(d => d.speed && d.speed <= maxSpeed);
    }
    
    return NextResponse.json({
      detections,
      total: detections.length
    });
    
  } catch (error) {
    console.error('Error fetching plate detections:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plate detections' },
      { status: 500 }
    );
  }
}