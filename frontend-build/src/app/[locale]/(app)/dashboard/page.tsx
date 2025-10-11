"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale as use_locale } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Activity,
  Camera,
  Car,
  Mail,
  Server,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Settings,
  BarChart3,
  CreditCard
} from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'online' | 'offline' | 'unknown';
  port?: number;
  description: string;
  url?: string;
}

interface SystemMetrics {
  uptime: number;
  totalCameras: number;
  activeServices: number;
  totalServices: number;
}

/**
 * Genera una ruta interna asegurando que incluya el locale actual.
 */
function build_locale_href(locale: string, path: string): string {
  const sanitized_path = path.startsWith('/') ? path.slice(1) : path;
  return `/${locale}/${sanitized_path}`;
}

export default function DashboardPage() {
  const locale = use_locale();
  
  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: 'LPR Backend',
      status: 'unknown',
      port: 2221,
      description: 'Sistema de reconocimiento de matrículas',
      url: '/plates-lpr'
    },
    {
      name: 'Conteo Backend',
      status: 'unknown',
      port: 2223,
      description: 'Sistema de conteo de personas',
      url: '/counting'
    },
    {
      name: 'Notificaciones',
      status: 'unknown',
      port: 2224,
      description: 'Sistema de notificaciones por email',
      url: '/notifications'
    },
    {
      name: 'Redis Cache',
      status: 'unknown',
      description: 'Cache y sesiones del sistema'
    },
    {
      name: 'Frigate',
      status: 'unknown',
      description: 'Sistema de videovigilancia',
      url: '/live'
    }
  ]);

  const [metrics, setMetrics] = useState<SystemMetrics>({
    uptime: 0,
    totalCameras: 0,
    activeServices: 0,
    totalServices: 0
  });

  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Función para verificar el estado de un servicio
  const checkServiceStatus = async (service: ServiceStatus): Promise<'online' | 'offline' | 'unknown'> => {
    if (!service.port) return 'unknown';

    try {
      const response = await fetch(`http://localhost:${service.port}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000) // 5 segundos timeout
      });

      return response.ok ? 'online' : 'offline';
    } catch (error) {
      return 'offline';
    }
  };

  // Función para actualizar el estado de todos los servicios
  const updateServiceStatuses = async () => {
    setLoading(true);

    const updatedServices = await Promise.all(
      services.map(async (service) => ({
        ...service,
        status: await checkServiceStatus(service)
      }))
    );

    setServices(updatedServices);

    // Calcular métricas
    const activeServices = updatedServices.filter(s => s.status === 'online').length;
    setMetrics({
      uptime: Date.now() - new Date().setHours(0, 0, 0, 0), // Simulado desde medianoche
      totalCameras: 0, // TODO: Obtener de Frigate si está disponible
      activeServices,
      totalServices: updatedServices.length
    });

    setLastUpdate(new Date());
    setLoading(false);
  };

  useEffect(() => {
    updateServiceStatuses();

    // Actualizar cada 30 segundos
    const interval = setInterval(updateServiceStatuses, 30000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'offline':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge variant="default" className="bg-green-500">Online</Badge>;
      case 'offline':
        return <Badge variant="destructive">Offline</Badge>;
      default:
        return <Badge variant="secondary">Desconocido</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard - ExalinkHub</h1>
          <p className="text-muted-foreground">
            Panel de control del sistema de videovigilancia inteligente
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={updateServiceStatuses}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={build_locale_href(locale, 'settings')}>
              <Settings className="h-4 w-4 mr-2" />
              Configuración
            </Link>
          </Button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Servicios Activos</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeServices}/{metrics.totalServices}</div>
            <p className="text-xs text-muted-foreground">
              de {metrics.totalServices} servicios totales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cámaras</CardTitle>
            <Camera className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalCameras}</div>
            <p className="text-xs text-muted-foreground">
              cámaras configuradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Activo</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor(metrics.uptime / 3600000)}h
            </div>
            <p className="text-xs text-muted-foreground">
              desde el último reinicio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Última Actualización</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {lastUpdate.toLocaleTimeString()}
            </div>
            <p className="text-xs text-muted-foreground">
              actualización automática cada 30s
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Estado de servicios */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de Servicios</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(service.status)}
                  <div>
                    <h3 className="font-medium">{service.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {service.description}
                    </p>
                    {service.port && (
                      <p className="text-xs text-muted-foreground">
                        Puerto: {service.port}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(service.status)}
                  {service.url && service.status === 'online' && (
                    <Button asChild size="sm" variant="ghost">
                      <Link href={build_locale_href(locale, service.url)}>
                        Ver
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Accesos rápidos */}
      <Card>
        <CardHeader>
          <CardTitle>Accesos Rápidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button asChild variant="outline" className="h-20 flex-col gap-2">
              <Link href={build_locale_href(locale, 'live')}>
                <Camera className="h-6 w-6" />
                Vista Live
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-20 flex-col gap-2">
              <Link href={build_locale_href(locale, 'plates-lpr')}>
                <CreditCard className="h-6 w-6" />
                Matrículas
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-20 flex-col gap-2">
              <Link href={build_locale_href(locale, 'counting')}>
                <BarChart3 className="h-6 w-6" />
                Conteo Personas
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-20 flex-col gap-2">
              <Link href={build_locale_href(locale, 'notifications')}>
                <Mail className="h-6 w-6" />
                Notificaciones
              </Link>
            </Button>

            <Button asChild variant="outline" className="h-20 flex-col gap-2">
              <Link href={build_locale_href(locale, 'settings')}>
                <Settings className="h-6 w-6" />
                Configuración
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Información del sistema */}
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <strong>Nota:</strong> Este dashboard proporciona una visión general del estado del sistema.
          Algunos servicios pueden requerir configuración adicional para funcionar correctamente.
          Revisa la documentación en el menú de configuración para más detalles.
        </AlertDescription>
      </Alert>
    </div>
  );
}
