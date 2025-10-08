/**
 * API para dashboard de conteo en tiempo real
 * 
 * Endpoint principal que proporciona métricas agregadas, estado de áreas,
 * alertas recientes y datos para el panel de control principal.
 * 
 * GET /api/conteo/dashboard - Dashboard completo con métricas en tiempo real
 */

import { NextRequest, NextResponse } from 'next/server';
import { get_counting_database } from '@/lib/counting-database';

/**
 * Obtiene dashboard completo con métricas en tiempo real
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'today'; // today, week, month

    console.log('Conteo Dashboard API: Getting dashboard data, period:', period);

    const counting_db = get_counting_database();
    
    // Calcular rango de fechas según período
    let start_date: string;
    let end_date: string = new Date().toISOString();

    switch (period) {
      case 'week':
        start_date = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'month':
        start_date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'today':
      default:
        start_date = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z';
        break;
    }

    // 1. Estadísticas generales
    const stats = counting_db.get_stats();

    // 2. Estado actual de todas las áreas
    const areas_status = counting_db.get_areas_current_status();

    // 3. Eventos recientes (últimas 2 horas)
    const two_hours_ago = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const recent_events = counting_db.query_all_statement(`
      SELECT 
        ce.*,
        a.nombre as area_nombre,
        a.tipo as area_tipo
      FROM counting_events ce
      JOIN areas a ON ce.area_id = a.id
      WHERE ce.ts >= ?
      ORDER BY ce.ts DESC
      LIMIT 50
    `, [two_hours_ago]);

    // 4. Estadísticas de alertas
    const alert_stats = counting_db.get_alert_stats(start_date, end_date);

    // 5. Resumen de ocupación actual
    const total_ocupacion = areas_status.reduce((sum: number, area: any) => sum + (area.estado_actual || 0), 0);
    const total_capacidad = areas_status.reduce((sum: number, area: any) => sum + (area.max_ocupacion || 0), 0);
    const ocupacion_percentage = total_capacidad > 0 ? (total_ocupacion / total_capacidad) * 100 : 0;

    // 6. Conteo de eventos por tipo de área en el período
    const events_by_area_type = counting_db.query_all_statement(`
      SELECT 
        a.tipo,
        COUNT(CASE WHEN ce.tipo = 'enter' THEN 1 END) as entradas,
        COUNT(CASE WHEN ce.tipo = 'exit' THEN 1 END) as salidas,
        COUNT(*) as total_eventos
      FROM counting_events ce
      JOIN areas a ON ce.area_id = a.id
      WHERE ce.ts >= ? AND ce.ts <= ?
      AND ce.tipo IN ('enter', 'exit')
      GROUP BY a.tipo
    `, [start_date, end_date]);

    // 7. Top áreas por actividad
    const top_areas_activity = counting_db.query_all_statement(`
      SELECT 
        a.nombre,
        a.tipo,
        a.estado_actual,
        a.max_ocupacion,
        COUNT(*) as eventos_count,
        COUNT(CASE WHEN ce.tipo = 'enter' THEN 1 END) as entradas,
        COUNT(CASE WHEN ce.tipo = 'exit' THEN 1 END) as salidas
      FROM areas a
      LEFT JOIN counting_events ce ON a.id = ce.area_id 
        AND ce.ts >= ? AND ce.ts <= ?
        AND ce.tipo IN ('enter', 'exit')
      WHERE a.enabled = 1
      GROUP BY a.id, a.nombre, a.tipo, a.estado_actual, a.max_ocupacion
      ORDER BY eventos_count DESC
      LIMIT 10
    `, [start_date, end_date]);

    // 8. Configuración del sistema
    const system_config = counting_db.get_configuration();

    const dashboard_data = {
      // Métricas principales
      metrics: {
        total_ocupacion,
        total_capacidad,
        ocupacion_percentage: Math.round(ocupacion_percentage),
        active_areas: stats.active_areas,
        active_cameras: stats.active_cameras,
        events_today: stats.events_today,
        total_events: stats.total_events
      },

      // Estado de áreas
      areas: areas_status.map((area: any) => ({
        id: area.id,
        nombre: area.nombre,
        tipo: area.tipo,
        estado_actual: area.estado_actual,
        max_ocupacion: area.max_ocupacion,
        color_estado: area.color_estado,
        modo_limite: area.modo_limite,
        percentage: area.max_ocupacion > 0 ? Math.round((area.estado_actual / area.max_ocupacion) * 100) : 0,
        access_points_count: area.access_points_count
      })),

      // Eventos recientes
      recent_events: recent_events.slice(0, 20),

      // Estadísticas de alertas
      alerts: {
        stats: alert_stats,
        recent_warnings: recent_events.filter((e: any) => e.tipo === 'warning').length,
        recent_exceeded: recent_events.filter((e: any) => e.tipo === 'exceeded').length
      },

      // Actividad por tipo de área
      activity_by_type: events_by_area_type,

      // Top áreas por actividad
      top_areas: top_areas_activity,

      // Estado del sistema
      system: {
        enabled: system_config?.enabled || false,
        mqtt_connected: true, // TODO: Obtener estado real del servicio MQTT
        operation_mode: system_config?.operation_mode || 'zones',
        retention_days: system_config?.retention_days || 30,
        confidence_threshold: system_config?.confidence_threshold || 0.7
      },

      // Metadata
      generated_at: new Date().toISOString(),
      period,
      date_range: { start_date, end_date }
    };

    console.log('Conteo Dashboard API: Dashboard data generated for period:', period);

    return NextResponse.json({
      success: true,
      data: dashboard_data
    });

  } catch (error) {
    console.error('Conteo Dashboard API: Error getting dashboard data:', error);
    
    return NextResponse.json(
      { success: false, error: 'Error al obtener datos del dashboard' },
      { status: 500 }
    );
  }
}