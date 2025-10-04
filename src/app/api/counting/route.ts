import { NextRequest, NextResponse } from 'next/server';
import type { CountingMetrics, CountingData, HourlyCount } from '@/lib/types';

// Generar datos mock para conteo
const generateMockCountingData = (): CountingMetrics => {
  const cameras = ['acceso_sur', 'entrada_principal', 'salida_norte', 'portones'];
  
  // Datos por hora (24 horas)
  const hourlyData: HourlyCount[] = [];
  for (let hour = 0; hour < 24; hour++) {
    const entries = Math.floor(Math.random() * 500) + 50;
    const exits = Math.floor(Math.random() * 480) + 40;
    hourlyData.push({
      hour,
      entries,
      exits,
      total: entries + exits
    });
  }
  
  // Datos por cámara
  const cameraData: CountingData[] = cameras.map(camera => {
    const cars = Math.floor(Math.random() * 5000) + 1000;
    const trucks = Math.floor(Math.random() * 1000) + 100;
    const motorcycles = Math.floor(Math.random() * 800) + 50;
    const buses = Math.floor(Math.random() * 200) + 10;
    const bicycles = Math.floor(Math.random() * 150) + 5;
    
    const total = cars + trucks + motorcycles + buses + bicycles;
    const entries = Math.floor(total * 0.52); // 52% entradas
    const exits = total - entries;
    
    return {
      camera,
      total,
      entries,
      exits,
      vehicles: {
        cars,
        trucks,
        motorcycles,
        buses,
        bicycles
      }
    };
  });
  
  // Totales generales
  const totalVehicles = cameraData.reduce((sum, data) => sum + data.total, 0);
  const totalEntries = cameraData.reduce((sum, data) => sum + data.entries, 0);
  const totalExits = cameraData.reduce((sum, data) => sum + data.exits, 0);
  
  const vehicleBreakdown = cameraData.reduce(
    (totals, data) => ({
      cars: totals.cars + data.vehicles.cars,
      trucks: totals.trucks + data.vehicles.trucks,
      motorcycles: totals.motorcycles + data.vehicles.motorcycles,
      buses: totals.buses + data.vehicles.buses,
      bicycles: totals.bicycles + data.vehicles.bicycles
    }),
    { cars: 0, trucks: 0, motorcycles: 0, buses: 0, bicycles: 0 }
  );
  
  return {
    totalVehicles,
    totalEntries,
    totalExits,
    vehicleBreakdown,
    hourlyData,
    cameraData
  };
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const cameras = searchParams.get('cameras')?.split(',') || [];
  
  try {
    let metrics = generateMockCountingData();
    
    // Aplicar filtros si se especificaron cámaras
    if (cameras.length > 0 && !cameras.includes('all')) {
      metrics.cameraData = metrics.cameraData.filter(data => 
        cameras.includes(data.camera)
      );
      
      // Recalcular totales
      metrics.totalVehicles = metrics.cameraData.reduce((sum, data) => sum + data.total, 0);
      metrics.totalEntries = metrics.cameraData.reduce((sum, data) => sum + data.entries, 0);
      metrics.totalExits = metrics.cameraData.reduce((sum, data) => sum + data.exits, 0);
      
      metrics.vehicleBreakdown = metrics.cameraData.reduce(
        (totals, data) => ({
          cars: totals.cars + data.vehicles.cars,
          trucks: totals.trucks + data.vehicles.trucks,
          motorcycles: totals.motorcycles + data.vehicles.motorcycles,
          buses: totals.buses + data.vehicles.buses,
          bicycles: totals.bicycles + data.vehicles.bicycles
        }),
        { cars: 0, trucks: 0, motorcycles: 0, buses: 0, bicycles: 0 }
      );
    }
    
    return NextResponse.json(metrics);
    
  } catch (error) {
    console.error('Error fetching counting metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch counting metrics' },
      { status: 500 }
    );
  }
}