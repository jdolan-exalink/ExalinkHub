/**
 * API para estadísticas del día actual de conteo vehicular
 * GET /api/vehicle-counting/today-stats - Obtener estadísticas desde las 00:00 del día actual
 * Lee directamente de la base de datos Conteos.db del backend
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

// Importar módulos de Node.js usando require para evitar problemas de tipos

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const ini = require('ini');


/**
 * Obtiene la ruta absoluta a la base de datos de conteo vehicular leyendo backend/conteo/conteo.conf.
 * Normaliza la ruta a minúsculas y resuelve correctamente para entorno local y Docker.
 * Si no existe o hay error, retorna la ruta por defecto.
 */

// Reemplazo seguro multiplataforma: nunca lanzar error
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

const CONTEO_DB_PATH = get_conteo_db_path();

/**
 * Obtiene estadísticas del período seleccionado desde las 00:00
 */
async function getTodayStats(timezoneOffset: number, period: string = 'today') {
  try {
    console.log(`📅 Obteniendo estadísticas del período: ${period}...`);
    console.log(`📍 Ruta de BD:`, CONTEO_DB_PATH);
    // Si la base no existe o la ruta es null, devolver datos vacíos (no lanzar error ni intentar abrir DB)
    if (!CONTEO_DB_PATH) {
      console.warn('⚠️ Base de datos de conteo no encontrada (ruta null)');
      return {
        total_in: 0,
        total_out: 0,
        balance: 0,
        total_events: 0,
        vehicle_types: []
      };
    }
    if (!fs.existsSync(CONTEO_DB_PATH)) {
      console.warn('⚠️ Base de datos de conteo no encontrada en el filesystem:', CONTEO_DB_PATH);
      return {
        total_in: 0,
        total_out: 0,
        balance: 0,
        total_events: 0,
        vehicle_types: []
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

      // Calcular estadísticas
      let totalIn = 0;
      let totalOut = 0;
      const vehicleTypeCounts: Record<string, { in: number; out: number; total: number }> = {};

      events.forEach((event: any) => {
        if (event.zone === 'IN') {
          totalIn += 1;
        } else if (event.zone === 'OUT') {
          totalOut += 1;
        }

        // Contar por tipo de vehículo
        const type = event.label;
        if (!vehicleTypeCounts[type]) {
          vehicleTypeCounts[type] = { in: 0, out: 0, total: 0 };
        }

        if (event.zone === 'IN') {
          vehicleTypeCounts[type].in += 1;
        } else if (event.zone === 'OUT') {
          vehicleTypeCounts[type].out += 1;
        }
        vehicleTypeCounts[type].total += 1;
      });

      const balance = totalIn - totalOut;

      // Mapear tipos de vehículo con iconos y colores
      const vehicleIcons: Record<string, string> = {
        'auto': '🚗',
        'moto': '🏍️',
        'bicicleta': '🚴',
        'autobús': '🚌',
        'bus': '🚌',
        'personas': '👥'
      };

      const vehicleTypes = Object.entries(vehicleTypeCounts).map(([label, counts]) => ({
        label,
        count: counts.total,
        in: counts.in,
        out: counts.out,
        icon: vehicleIcons[label] || '📦',
        color: getVehicleColor(label)
      }));

      console.log('✅ Estadísticas del día calculadas:', { totalIn, totalOut, balance, vehicleTypes: vehicleTypes.length });

      return {
        total_in: totalIn,
        total_out: totalOut,
        balance: balance,
        total_events: events.length,
        vehicle_types: vehicleTypes
      };

    } finally {
      db.close();
    }

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas del día:', error);
    return {
      total_in: 0,
      total_out: 0,
      balance: 0,
      total_events: 0,
      vehicle_types: []
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

    // Obtener estadísticas del período seleccionado
    console.log(`📊 Calculando estadísticas del período: ${period}...`);
    const todayStats = await getTodayStats(timezoneOffset, period);

    console.log(`📈 Estadísticas del período ${period}:`, {
      entradas: todayStats.total_in,
      salidas: todayStats.total_out,
      balance: todayStats.balance,
      total: todayStats.total_events,
      tipos: todayStats.vehicle_types.length
    });

    return NextResponse.json({
      success: true,
      data: {
        ...todayStats,
        camera_filter: camera_name || 'all',
        timezone_offset: timezoneOffset,
        period: period
      }
    });
  } catch (error) {
    console.error('Error getting today stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error obteniendo estadísticas del período'
      },
      { status: 500 }
    );
  }
}