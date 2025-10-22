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
function getConteoDbPath(): string {
  if (process.env.CONTEO_DB_PATH) return process.env.CONTEO_DB_PATH;
  const confPath = path.join(process.cwd(), 'backend', 'conteo', 'conteo.conf');
  if (fs.existsSync(confPath)) {
    const conf = ini.parse(fs.readFileSync(confPath, 'utf-8'));
    if (conf.app && typeof conf.app.storage === 'string') {
      // Extraer path de storage (puede ser sqlite:///...)
      const match = conf.app.storage.match(/sqlite:\/\/(.*)/);
      if (match && match[1]) {
        // Quitar barras iniciales extra si existen
        let dbPath = match[1].replace(/^\/+/, '');
        // Si es ruta absoluta, devolver tal cual; si es relativa, resolver desde backend/conteo
        if (!path.isAbsolute(dbPath)) {
          dbPath = path.join(process.cwd(), 'backend', 'conteo', dbPath);
        }
        return dbPath;
      }
    }
  }
  // Fallback por defecto
  return path.join(process.cwd(), 'backend', 'Conteo', 'DB', 'Conteo.db');
}

const CONTEO_DB_PATH = getConteoDbPath();

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

    // Verificar que el archivo existe
    if (!fs.existsSync(CONTEO_DB_PATH)) {
      console.error('❌ Base de datos no encontrada:', CONTEO_DB_PATH);
      return {
        vehicleTypes: [],
        hourlyData: Array.from({ length: 24 }, (_, i) => ({ hour: i, in: 0, out: 0, total: 0 })),
        totalEvents: 0
      };
    }

    // Conectar a la base de datos de conteo
    const db = new Database(CONTEO_DB_PATH, { readonly: true });

    try {
      // Calcular fechas según el período seleccionado
      let startDate: Date;
      let endDate: Date;

      const now = new Date();

      switch (period) {
        case 'today':
          // Hoy: desde 00:00 hasta 23:59
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
          break;

        case 'yesterday':
          // Ayer: desde 00:00 hasta 23:59 del día anterior
          startDate = new Date(now);
          startDate.setDate(startDate.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setDate(endDate.getDate() - 1);
          endDate.setHours(23, 59, 59, 999);
          break;

        case 'week':
          // Esta semana: desde lunes 00:00 hasta ahora
          startDate = new Date(now);
          const dayOfWeek = startDate.getDay(); // 0 = domingo, 1 = lunes
          const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Ir al lunes
          startDate.setDate(startDate.getDate() - daysToSubtract);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          break;

        case 'month':
          // Este mes: desde 1ro del mes hasta ahora
          startDate = new Date(now);
          startDate.setDate(1);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          break;

        default:
          // Por defecto, hoy
          startDate = new Date(now);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(now);
          endDate.setHours(23, 59, 59, 999);
      }

      // NO convertir a UTC - los datos están guardados en hora local
      const startStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
      const endStr = endDate.toISOString().slice(0, 19).replace('T', ' ');

      console.log(`📅 Consultando período ${period}:`, startStr, 'hasta:', endStr, '(hora local - sin conversión UTC)');

      const events = db.prepare(`
        SELECT camera, label, start_time, end_time, zone
        FROM events
        WHERE start_time >= ? AND start_time <= ?
        ORDER BY start_time DESC
      `).all(startStr, endStr);

      console.log(`📊 Eventos encontrados en período ${period}: ${events.length}`);

      // Mostrar algunos eventos de ejemplo
      if (events.length > 0) {
        console.log('📋 Ejemplos de eventos:', events.slice(0, 3).map((e: any) => ({
          camera: e.camera,
          label: e.label,
          time: e.start_time,
          zone: e.zone
        })));
      }

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

      // Para períodos históricos, no calculamos tipos de la "hora actual"
      // Solo calculamos para "today"
      let currentHour = new Date().getHours();
      let hourlyTypeCounts: Record<string, { in: number; out: number; total: number }> = {};

      if (period === 'today') {
        // Agrupar por hora y tipo de vehículo para datos de la hora actual
        hourlyTypeCounts = {};

        events.forEach((event: any) => {
          // Los datos están guardados en UTC, convertir a hora local
          const eventTime = new Date(event.start_time + 'Z'); // Agregar 'Z' para tratar como UTC
          const utcHour = eventTime.getUTCHours();
          const localHour = (utcHour + timezoneOffset + 24) % 24; // Convertir a hora local

          // Solo procesar eventos de la hora actual
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

        console.log(`🕐 Tipos de vehículo en la hora actual (${currentHour}:00):`, Object.keys(hourlyTypeCounts).length, 'tipos');
      } else {
        console.log(`📅 Período ${period}: no se calculan tipos de vehículo de la hora actual`);
      }

      // Mapear tipos de vehículo a iconos
      const vehicleIcons: Record<string, string> = {
        'auto': '🚗',
        'moto': '🏍️',
        'bicicleta': '🚴',
        'autobús': '🚌',
        'bus': '🚌',
        'personas': '👥'
      };

      // Procesar datos por tipo de vehículo (día completo)
      const vehicleTypes = Object.entries(typeCounts).map(([label, counts]) => ({
        label,
        count: counts.total,
        in: counts.in,
        out: counts.out,
        icon: vehicleIcons[label] || '📦',
        color: getVehicleColor(label)
      }));

      // Procesar datos por tipo de vehículo (hora actual)
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

      console.log('✅ Tipos de vehículo procesados (día completo):', vehicleTypes.length);
      console.log('✅ Tipos de vehículo procesados (hora actual):', currentHourVehicleTypes.length);

      // Transformar datos por hora aplicando timezone
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
    // Retornar datos vacíos en caso de error
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