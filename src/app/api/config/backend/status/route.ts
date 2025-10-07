import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Consulta real del estado de los servicios desde la base de datos
    const ConfigDatabase = (await import('@/lib/config-database')).default;
    const db = new ConfigDatabase();
    const configs = db.getAllBackendConfigs();

    // Mapear estado de cada servicio con campos operacionales
    const default_status = {
      status: 'stopped',
      uptime: 0,
      processed: 0,
      memory_mb: 0,
      cpu_percent: 0,
      counted: 0,
      sent: 0
    };
    const services: Record<string, any> = {};
    configs.forEach((cfg: any) => {
      // Determinar status simulado según enabled
      const status = !!cfg.enabled ? 'running' : 'stopped';
      let extra = {};
      if (cfg.service_name === 'LPR (Matrículas)') {
        extra = { processed: 0, memory_mb: 0, cpu_percent: 0 };
      } else if (cfg.service_name === 'Conteo de Personas') {
        extra = { counted: 0, memory_mb: 0, cpu_percent: 0 };
      } else if (cfg.service_name === 'Notificaciones') {
        extra = { sent: 0, memory_mb: 0, cpu_percent: 0 };
      }
      services[cfg.service_name] = {
        enabled: !!cfg.enabled,
        config: cfg.config,
        status,
        uptime: status === 'running' ? 3600 : 0,
        ...extra
      };
    });

    return NextResponse.json({ services });
  } catch (error) {
    console.error('Error obteniendo estado de servicios:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}