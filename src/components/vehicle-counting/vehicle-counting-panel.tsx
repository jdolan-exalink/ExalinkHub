/**
 * Panel de Conteo Vehicular IN/OUT
 * Muestra estadísticas en tiempo real y histórico de conteo vehicular por zonas
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Car, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  BarChart3, 
  RefreshCw,
  AlertTriangle,
  Settings,
  Activity,
  ArrowUpRight,
  ArrowDownLeft
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface VehicleZoneConfig {
  id: number;
  camera_name: string;
  zone_in: string;
  zone_out: string;
  enabled: boolean;
  title: string;
}

interface VehicleStats {
  total_in: number;
  total_out: number;
  current_count: number;
  by_type: Record<string, { in: number; out: number }>;
}

interface VehicleTransitionEvent {
  id: number;
  camera_name: string;
  object_type: string;
  transition_type: 'in' | 'out';
  confidence: number;
  zone_name: string;
  timestamp: string;
}

export function VehicleCountingPanel() {
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<VehicleZoneConfig[]>([]);
  const [currentStats, setCurrentStats] = useState<VehicleStats>({
    total_in: 0,
    total_out: 0,
    current_count: 0,
    by_type: {}
  });
  const [recentEvents, setRecentEvents] = useState<VehicleTransitionEvent[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('all');
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('today');

  /**
   * Carga las configuraciones de zonas habilitadas
   */
  const loadZoneConfigs = useCallback(async () => {
    try {
      const response = await fetch('/api/vehicle-counting/zones?enabled=true');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setZones(data.data);
        }
      }
    } catch (error) {
      console.error('Error loading zone configs:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las configuraciones de zonas',
        variant: 'destructive'
      });
    }
  }, []);

  /**
   * Carga las estadísticas actuales
   */
  const loadCurrentStats = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        period: selectedPeriod
      });

      if (selectedCamera !== 'all') {
        params.append('camera', selectedCamera);
      }

      if (selectedZone !== 'all') {
        params.append('zone_id', selectedZone);
      }

      const response = await fetch(`/api/vehicle-counting/stats?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setCurrentStats(data.data.current || {
            total_in: 0,
            total_out: 0,
            current_count: 0,
            by_type: {}
          });
        }
      }
    } catch (error) {
      console.error('Error loading current stats:', error);
    }
  }, [selectedCamera, selectedZone, selectedPeriod]);

  /**
   * Carga los eventos recientes
   */
  const loadRecentEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        limit: '20'
      });

      if (selectedCamera !== 'all') {
        params.append('camera', selectedCamera);
      }

      if (selectedZone !== 'all') {
        params.append('zone_id', selectedZone);
      }

      const response = await fetch(`/api/vehicle-counting/events?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setRecentEvents(data.data.events || []);
        }
      }
    } catch (error) {
      console.error('Error loading recent events:', error);
    }
  }, [selectedCamera, selectedZone]);

  /**
   * Actualiza todos los datos
   */
  const refreshData = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      loadZoneConfigs(),
      loadCurrentStats(),
      loadRecentEvents()
    ]);
    setLoading(false);
  }, [loadZoneConfigs, loadCurrentStats, loadRecentEvents]);

  /**
   * Obtiene las cámaras únicas de las zonas configuradas
   */
  const getUniqueCameras = () => {
    const cameras = Array.from(new Set(zones.map(zone => zone.camera_name)));
    return cameras;
  };

  /**
   * Renderiza las estadísticas por tipo de vehículo
   */
  const renderVehicleTypeStats = () => {
    const types = Object.keys(currentStats.by_type);
    if (types.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-4">
          No hay datos de vehículos para el período seleccionado
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {types.map(type => {
          const typeStats = currentStats.by_type[type];
          const total = typeStats.in + typeStats.out;
          const percentage = currentStats.total_in + currentStats.total_out > 0 
            ? (total / (currentStats.total_in + currentStats.total_out)) * 100 
            : 0;

          return (
            <div key={type} className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium capitalize">
                  {type === 'car' ? 'Automóviles' : 
                   type === 'truck' ? 'Camiones' : 
                   type === 'motorcycle' ? 'Motocicletas' : 
                   type === 'bus' ? 'Autobuses' : type}
                </span>
                <span className="text-sm text-muted-foreground">
                  {total} ({percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3 text-green-600" />
                  Entradas: {typeStats.in}
                </span>
                <span className="flex items-center gap-1">
                  <ArrowDownLeft className="h-3 w-3 text-red-600" />
                  Salidas: {typeStats.out}
                </span>
              </div>
              <Progress value={percentage} className="h-2" />
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * Renderiza la lista de eventos recientes
   */
  const renderRecentEvents = () => {
    if (recentEvents.length === 0) {
      return (
        <div className="text-center text-muted-foreground py-4">
          No hay eventos recientes para mostrar
        </div>
      );
    }

    return (
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {recentEvents.map(event => (
          <div key={event.id} className="flex items-center justify-between p-2 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Badge variant={event.transition_type === 'in' ? 'default' : 'secondary'}>
                {event.transition_type === 'in' ? (
                  <ArrowUpRight className="h-3 w-3 mr-1" />
                ) : (
                  <ArrowDownLeft className="h-3 w-3 mr-1" />
                )}
                {event.transition_type.toUpperCase()}
              </Badge>
              <span className="text-sm font-medium">
                {event.object_type === 'car' ? 'Auto' : 
                 event.object_type === 'truck' ? 'Camión' : 
                 event.object_type === 'motorcycle' ? 'Moto' : event.object_type}
              </span>
              <span className="text-sm text-muted-foreground">
                {event.camera_name}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">
              {new Date(event.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Cargar datos iniciales
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Actualizar datos cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      loadCurrentStats();
      loadRecentEvents();
    }, 30000);

    return () => clearInterval(interval);
  }, [loadCurrentStats, loadRecentEvents]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Cargando datos de conteo vehicular...
      </div>
    );
  }

  if (zones.length === 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No hay zonas de conteo vehicular configuradas. 
          Ve a Configuración → Paneles para configurar las zonas IN/OUT.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con controles */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Conteo Vehicular</h2>
          <p className="text-muted-foreground">
            Sistema de conteo con zonas IN/OUT - {zones.length} zonas configuradas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refreshData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-4">
        <Select value={selectedCamera} onValueChange={setSelectedCamera}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Seleccionar cámara" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las cámaras</SelectItem>
            {getUniqueCameras().map(camera => (
              <SelectItem key={camera} value={camera}>{camera}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hoy</SelectItem>
            <SelectItem value="yesterday">Ayer</SelectItem>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Este mes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tarjetas de estadísticas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Entradas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{currentStats.total_in}</div>
            <p className="text-xs text-muted-foreground">Vehículos que ingresaron</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salidas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{currentStats.total_out}</div>
            <p className="text-xs text-muted-foreground">Vehículos que salieron</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance Actual</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${currentStats.current_count >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {currentStats.current_count >= 0 ? '+' : ''}{currentStats.current_count}
            </div>
            <p className="text-xs text-muted-foreground">Diferencia IN - OUT</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Eventos</CardTitle>
            <Car className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{currentStats.total_in + currentStats.total_out}</div>
            <p className="text-xs text-muted-foreground">Transiciones detectadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Pestañas con detalles */}
      <Tabs defaultValue="types" className="w-full">
        <TabsList>
          <TabsTrigger value="types">Por Tipo de Vehículo</TabsTrigger>
          <TabsTrigger value="activity">Actividad Reciente</TabsTrigger>
          <TabsTrigger value="zones">Configuración de Zonas</TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Estadísticas por Tipo de Vehículo
              </CardTitle>
              <CardDescription>
                Distribución de entradas y salidas por tipo de vehículo
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderVehicleTypeStats()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Actividad Reciente
              </CardTitle>
              <CardDescription>
                Últimas transiciones detectadas en las zonas configuradas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderRecentEvents()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zones" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Zonas Configuradas
              </CardTitle>
              <CardDescription>
                Zonas IN/OUT activas para conteo vehicular
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {zones.map(zone => (
                  <div key={zone.id} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{zone.title}</h4>
                        <p className="text-sm text-muted-foreground">{zone.camera_name}</p>
                      </div>
                      <Badge variant="outline">
                        IN: {zone.zone_in} → OUT: {zone.zone_out}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default VehicleCountingPanel;