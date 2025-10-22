/**
 * API para datos históricos por hora de conteo vehicular del día actual
 * GET /api/vehicle-counting/hourly - Obtener datos desde las 00:00 del día actual por hora
 * Lee directamente de la base de datos Conteos.db del backend
 */

import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import ini from 'ini';
import { getConfigDatabase } from '@/lib/config-database';

/**
 * Ruta de la base de datos de conteo
 */
/**
 * Obtiene la ruta de la base de datos de conteo desde conteo.conf
 * Prioridad:
 *   1. process.env.CONTEO_DB_PATH
 *   2. [app] storage en backend/conteo/conteo.conf
 *   3. Path por defecto
 */
/**
 * Obtiene la ruta absoluta a la base de datos de conteo vehicular leyendo backend/conteo/conteo.conf.
 * Normaliza la ruta a minúsculas y resuelve correctamente para entorno local y Docker.
 * Si no existe o hay error, retorna la ruta por defecto.
 */

function get_conteo_db_path(): string | null {
  if (process.env.CONTEO_DB_PATH) return process.env.CONTEO_DB_PATH;
  const candidates = [
    path.join(process.cwd(), 'DB', 'Conteo.db'),
    path.join(process.cwd(), 'DB', 'conteo.db'),
    '/app/DB/Conteo.db',
    '/app/DB/conteo.db',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  // Nunca lanzar error, siempre retornar null si no existe
  return null;
}

const CONTEO_DB_PATH: string | null = get_conteo_db_path();

/**
 * Transforma los datos de la base de datos al formato esperado por el gráfico
 * Aplica conversión de timezone UTC -> Local
 */
function transformConteoDataToHourly(events: any[], timezoneOffset: number) {
  // Crear un mapa de horas (0-23) con datos inicializados en 0
  const hourlyData: Record<number, { hour: number; in: number; out: number; total: number }> = {};

  // Inicializar todas las horas
  for (let hour = 0; hour < 24; hour++) {
    hourlyData[hour] = { hour, in: 0, out: 0, total: 0 };
  }

  // Procesar eventos
  events.forEach((event: any) => {
    // Los datos están guardados en UTC, convertir a hora local
    const eventTime = new Date(event.start_time + 'Z'); // Agregar 'Z' para tratar como UTC
    const utcHour = eventTime.getUTCHours();
    const localHour = (utcHour + timezoneOffset + 24) % 24; // Convertir a hora local

    console.log(`🔄 Conversión timezone: UTC ${utcHour}:00 → Local ${localHour}:00 (offset: ${timezoneOffset})`);

    // Contar según la zona
    if (event.zone === 'IN') {
      hourlyData[localHour].in += 1;
    } else if (event.zone === 'OUT') {
      hourlyData[localHour].out += 1;
    }

    // Total es la suma de entradas y salidas
    hourlyData[localHour].total = hourlyData[localHour].in + hourlyData[localHour].out;
  });

  // Convertir a array ordenado por hora
  return Object.values(hourlyData).sort((a, b) => a.hour - b.hour);
}

/**
 * Obtiene datos por tipo de vehículo del período seleccionado
 */
async function getVehicleTypeData(timezoneOffset: number, period: string = 'today') {
  try {
    console.log(`🔍 Obteniendo datos de tipos de vehículo para período: ${period}...`);
    console.log('📍 Ruta de BD:', CONTEO_DB_PATH);
    // Si la base no existe o la ruta es null, devolver datos vacíos (no lanzar error ni intentar abrir DB)
    if (!CONTEO_DB_PATH) {
      console.warn('⚠️ Base de datos de conteo no encontrada (ruta null)');
      return {
        vehicleTypes: [],
        currentHourVehicleTypes: [],
        hourlyData: Array.from({ length: 24 }, (_, i) => ({ hour: i, in: 0, out: 0, total: 0 })),
        totalEvents: 0,
        currentHour: new Date().getHours()
      };
    }
    if (!fs.existsSync(CONTEO_DB_PATH)) {
      console.warn('⚠️ Base de datos de conteo no encontrada en el filesystem:', CONTEO_DB_PATH);
      return {
        vehicleTypes: [],
        currentHourVehicleTypes: [],
        hourlyData: Array.from({ length: 24 }, (_, i) => ({ hour: i, in: 0, out: 0, total: 0 })),
        totalEvents: 0,
        currentHour: new Date().getHours()
      };
    }

    // Conectar a la base de datos de conteo
    const db = new Database(CONTEO_DB_PATH, { readonly: true });
    let events: any[] = [];
    try {
      // Calcular fechas según el período seleccionado
      let startDate: Date;
      let endDate: Date;
      const now = new Date();
      switch (period) {
        case 'today':
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'yesterday':
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setDate(endDate.getDate() - 1);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'week':
          startDate = new Date(now);
          const dayOfWeek = startDate.getDay();
          const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
          startDate.setDate(startDate.getDate() - daysToSubtract);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          break;
        default:
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
      }
      const startStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
      const endStr = endDate.toISOString().slice(0, 19).replace('T', ' ');
      events = db.prepare(`
        SELECT camera, label, start_time, end_time, zone
        FROM events
        WHERE start_time >= ? AND start_time <= ?
        ORDER BY start_time DESC
      `).all(startStr, endStr);
      // Agrupar por tipo de vehículo
      const typeCounts: Record<string, { in: number; out: number; total: number }> = {};
      events.forEach((event: any) => {
        const type = event.label;
        if (!typeCounts[type]) {
          typeCounts[type] = { in: 0, out: 0, total: 0 };
        }
        if (event.zone === 'IN') {
          typeCounts[type].in += 1;
        } else if (event.zone === 'OUT') {
          typeCounts[type].out += 1;
        }
        typeCounts[type].total += 1;
      });
      let currentHour = new Date().getHours();
      let hourlyTypeCounts: Record<string, { in: number; out: number; total: number }> = {};
      if (period === 'today') {
        hourlyTypeCounts = {};
        events.forEach((event: any) => {
          const eventTime = new Date(event.start_time + 'Z');
          const utcHour = eventTime.getUTCHours();
          const localHour = (utcHour + timezoneOffset + 24) % 24;
          if (localHour === currentHour) {
            const type = event.label;
            if (!hourlyTypeCounts[type]) {
              hourlyTypeCounts[type] = { in: 0, out: 0, total: 0 };
            }
            if (event.zone === 'IN') {
              hourlyTypeCounts[type].in += 1;
            } else if (event.zone === 'OUT') {
              hourlyTypeCounts[type].out += 1;
            }
            hourlyTypeCounts[type].total += 1;
          }
        });
      }
      const vehicleIcons: Record<string, string> = {
        'auto': '🚗',
        'moto': '🏍️',
        'bicicleta': '🚴',
        'autobús': '🚌',
        'bus': '🚌',
        'personas': '👥'
      };
      const vehicleTypes = Object.entries(typeCounts).map(([label, counts]) => ({
        label,
        count: counts.total,
        in: counts.in,
        out: counts.out,
        icon: vehicleIcons[label] || '📦',
        color: getVehicleColor(label)
      }));
      let currentHourVehicleTypes: any[] = [];
      if (period === 'today') {
        currentHourVehicleTypes = Object.entries(hourlyTypeCounts).map(([label, counts]) => ({
          label,
          count: counts.total,
          in: counts.in,
          out: counts.out,
          icon: vehicleIcons[label] || '📦',
          color: getVehicleColor(label)
        }));
      }
      const hourlyData = transformConteoDataToHourly(events, timezoneOffset);
      return {
        vehicleTypes,
        currentHourVehicleTypes,
        hourlyData,
        totalEvents: events.length,
        currentHour
      };
    } finally {
      db.close();
    }
  } catch (error) {
    console.error('❌ Error obteniendo datos de tipos de vehículo:', error);
    return {
      vehicleTypes: [],
      currentHourVehicleTypes: [],
      hourlyData: Array.from({ length: 24 }, (_, i) => ({ hour: i, in: 0, out: 0, total: 0 })),
      totalEvents: 0,
      currentHour: new Date().getHours()
    };
  }
}

/**
 * Obtiene color para cada tipo de vehículo
 */
function getVehicleColor(vehicleType: string): string {
  const colorMap: Record<string, string> = {
    'auto': '#3b82f6',      // Azul
    'moto': '#ef4444',      // Rojo
    'bicicleta': '#10b981',  // Verde
    'autobús': '#f59e0b',    // Amarillo
    'bus': '#f59e0b',        // Amarillo
    'personas': '#8b5cf6'    // Violeta
  };

  return colorMap[vehicleType] || '#6b7280'; // Gris por defecto
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const camera_name = searchParams.get('camera');
    const period = searchParams.get('period') || 'today';

    // Obtener configuración de timezone
    const configDb = getConfigDatabase();
    const timezoneOffset = configDb.get_timezone_offset();
    console.log(`🌍 Usando timezone offset: ${timezoneOffset}`);

    // Obtener datos por tipo de vehículo de la base de datos local
    console.log(`🚗 Llamando a getVehicleTypeData para período: ${period}...`);
    const result = await getVehicleTypeData(timezoneOffset, period);
    const vehicleTypes = result.vehicleTypes || [];
    const currentHourVehicleTypes = result.currentHourVehicleTypes || [];
    const hourlyData = result.hourlyData;
    const totalEvents = result.totalEvents;
    const currentHour = result.currentHour || new Date().getHours();

    console.log(`🚗 VehicleTypes obtenidos (${period} - día completo):`, vehicleTypes.length, 'tipos');
    console.log(`🚗 VehicleTypes obtenidos (${period} - hora actual):`, currentHourVehicleTypes.length, 'tipos');
    console.log('📊 Datos por hora procesados:', hourlyData.length, 'horas');
    console.log(`📈 Total de eventos en período ${period}:`, totalEvents);

    // Obtener lista de contadores para contar cuántos hay
    // Nota: Esta parte podría necesitar ajuste si no hay backend corriendo
    let counters_count = 0;
    try {
      // Por ahora, usar un valor fijo o calcular de los datos disponibles
      // En el futuro, podríamos leer de la configuración de zonas
      counters_count = 1; // Valor por defecto
      console.log('📊 Contadores estimados:', counters_count);
    } catch (error) {
      console.warn('Error getting counters count:', error);
    }

    return NextResponse.json({
      success: true,
      data: {
        hourly: hourlyData,
        vehicle_types: vehicleTypes,
        current_hour_vehicle_types: currentHourVehicleTypes,
        counters_count: counters_count,
        camera_filter: camera_name || 'all',
        timezone_offset: timezoneOffset,
        total_events_today: totalEvents,
        current_hour: currentHour,
        period: period
      }
    });
  } catch (error) {
    console.error('Error getting hourly vehicle counting data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error obteniendo datos históricos por hora'
      },
      { status: 500 }
    );
  }
}