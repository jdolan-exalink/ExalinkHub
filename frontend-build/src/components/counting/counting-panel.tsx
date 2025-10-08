'use client';

/**
 * Panel principal del sistema de conteo y aforo (versión actualizada)
 *
 * Sistema completo de conteo basado en analíticas Frigate MQTT que incluye:
 * - Vista en tiempo real de ocupación por áreas
 * - Dashboard con métricas agregadas
 * - Gestión de áreas y puntos de acceso
 * - Sistema de alertas y umbrales
 * - Históricos y exportación de datos
 *
 * Responsabilidades:
 * - Dashboard principal con métricas en tiempo real
 * - Vista de áreas con estado actual de ocupación
 * - Panel de configuración de áreas y umbrales
 * - Históricos y tendencias
 *
 * Notas de implementación:
 * - Nombres de variables y funciones en snake_case según lineamientos.
 * - Cada función expuesta tiene bloque JSDoc.
 * - Integra con el nuevo modelo de datos (áreas, access_points, eventos)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Car, Activity, RefreshCw, Calendar, Camera, BarChart3, TrendingUp, Eye, Users, Truck, Bike, Bus,
  AlertTriangle, MapPin, Plus, Settings, Download, Filter, Clock, Target, AlertOctagon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';

/** Información del dashboard principal */
interface dashboard_data {
  metrics: {
    total_ocupacion: number;
    total_capacidad: number;
    ocupacion_percentage: number;
    active_areas: number;
    active_cameras: number;
    events_today: number;
    total_events: number;
  };
  areas: area_status[];
  recent_events: recent_event[];
  alerts: {
    stats: alert_stat[];
    recent_warnings: number;
    recent_exceeded: number;
  };
  activity_by_type: activity_type[];
  top_areas: top_area[];
  system: {
    enabled: boolean;
    mqtt_connected: boolean;
    operation_mode: string;
    retention_days: number;
    confidence_threshold: number;
  };
  generated_at: string;
  period: string;
  date_range: { start_date: string; end_date: string };
}

interface area_status {
  id: number;
  nombre: string;
  tipo: 'personas' | 'vehiculos';
  estado_actual: number;
  max_ocupacion: number;
  color_estado: string;
  modo_limite: 'soft' | 'hard';
  percentage: number;
  access_points_count: number;
}

interface recent_event {
  id: number;
  area_id: number;
  area_nombre: string;
  area_tipo: string;
  tipo: 'enter' | 'exit' | 'warning' | 'exceeded';
  valor: number;
  fuente: string;
  ts: string;
}

interface alert_stat {
  area_nombre: string;
  area_tipo: string;
  warnings_count: number;
  exceeded_count: number;
  last_alert: string;
}

interface activity_type {
  tipo: string;
  entradas: number;
  salidas: number;
  total_eventos: number;
}

interface top_area {
  nombre: string;
  tipo: string;
  estado_actual: number;
  max_ocupacion: number;
  eventos_count: number;
  entradas: number;
  salidas: number;
}

/** Información base del módulo (compatibilidad) */
interface counting_info { 
  mode: 'agregado' | 'dividido'; 
  title: string; 
  cameras: string[]; 
}

/** Estado de objetos (compatibilidad) */
interface counting_state { 
  activos: string[]; 
  objetos: string[]; 
  system: any;
  stats: any;
  areas: area_status[];
  cameras: string[];
}

/** Iconos por tipo de objeto y área */
const object_icons: Record<string, React.ReactNode> = {
  person: <Users className="h-4 w-4" />,
  personas: <Users className="h-4 w-4" />,
  car: <Car className="h-4 w-4" />,
  vehiculos: <Car className="h-4 w-4" />,
  truck: <Truck className="h-4 w-4" />,
  motorcycle: <Bike className="h-4 w-4" />,
  bicycle: <Bike className="h-4 w-4" />,
  bus: <Bus className="h-4 w-4" />,
  auto: <Car className="h-4 w-4" />,
  moto: <Bike className="h-4 w-4" />,
  autobús: <Bus className="h-4 w-4" />,
  camión: <Truck className="h-4 w-4" />
};

/** Colores para estados de áreas */
const status_colors: Record<string, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500'
};

interface counting_panel_props { 
  refresh_trigger?: number 
}

/**
 * Componente principal CountingPanel actualizado
 * @param refresh_trigger número que al cambiar fuerza recarga completa (proviene del header externo)
 */
export function CountingPanel({ refresh_trigger }: counting_panel_props) {
  // Estados de datos principales
  const [dashboard_data, set_dashboard_data] = useState<dashboard_data | null>(null);
  const [info, set_info] = useState<counting_info | null>(null);
  const [state, set_state] = useState<counting_state | null>(null);

  // Estados UI
  const [loading, set_loading] = useState(true);
  const [refreshing, set_refreshing] = useState(false);
  const [active_tab, set_active_tab] = useState('dashboard');
  const [selected_period, set_selected_period] = useState('today');
  const [selected_view, set_selected_view] = useState<'day' | 'week' | 'month'>('day');
  const [selected_date, set_selected_date] = useState(new Date().toISOString().split('T')[0]);
  const [selected_camera, set_selected_camera] = useState('');

  /**
   * Carga los datos del dashboard principal
   */
  const load_dashboard_data = useCallback(async () => {
    try {
      console.log('CountingPanel: Loading dashboard data...');

      const response = await fetch(`/api/conteo/dashboard?period=${selected_period}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log('CountingPanel: Dashboard data received:', data);

      if (data.success) {
        set_dashboard_data(data.data);
      } else {
        throw new Error(data.error || 'Error loading dashboard');
      }

    } catch (error) {
      console.error('CountingPanel: Error loading dashboard data:', error);
      toast({ 
        title: 'Error', 
        description: 'No se pudo cargar datos del dashboard', 
        variant: 'destructive' 
      });
    }
  }, [selected_period]);

  /**
   * Carga metadata del módulo de conteo desde la API (compatibilidad)
   */
  const load_info = useCallback(async () => {
    try {
      console.log('CountingPanel: Loading info from counting API...');

      const response = await fetch('/api/conteo/info', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const info_data = await response.json();
      console.log('CountingPanel: Info data received:', info_data);

      set_info(info_data);
    } catch (error) {
      console.error('CountingPanel: Error loading info:', error);
      toast({ 
        title: 'Error', 
        description: 'No se pudo cargar información del módulo', 
        variant: 'destructive' 
      });
    }
  }, []);

  /**
   * Carga el estado del sistema de conteo
   */
  const load_state = useCallback(async () => {
    try {
      console.log('CountingPanel: Loading state from counting API...');

      const response = await fetch('/api/conteo/state', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const state_data = await response.json();
      console.log('CountingPanel: State data received:', state_data);

      set_state(state_data);
    } catch (error) {
      console.error('CountingPanel: Error loading state:', error);
      toast({ 
        title: 'Error', 
        description: 'No se pudo cargar estado del sistema', 
        variant: 'destructive' 
      });
    }
  }, []);

  /**
   * Refresca toda la información
   */
  const refresh_all = useCallback(async () => {
    set_refreshing(true);
    try {
      await Promise.all([
        load_dashboard_data(),
        load_info(),
        load_state()
      ]);
    } finally {
      set_refreshing(false);
    }
  }, [load_dashboard_data, load_info, load_state]);

  // Carga inicial
  useEffect(() => {
    const load_initial_data = async () => {
      set_loading(true);
      try {
        await Promise.all([
          load_dashboard_data(),
          load_info(),
          load_state()
        ]);
      } finally {
        set_loading(false);
      }
    };
    load_initial_data();
  }, [load_dashboard_data, load_info, load_state]);

  // Disparo externo de refresh
  useEffect(() => {
    if (refresh_trigger !== undefined && refresh_trigger > 0) {
      refresh_all();
    }
  }, [refresh_trigger, refresh_all]);

  // Auto-refresh cada 30 segundos en el tab dashboard
  useEffect(() => {
    if (active_tab === 'dashboard') {
      const interval = setInterval(() => {
        load_dashboard_data();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [active_tab, load_dashboard_data]);

  // Estados de carga / error
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Cargando sistema de conteo...</p>
        </div>
      </div>
    );
  }

  if (!dashboard_data && !state) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertDescription>Error de configuración del sistema de conteo.</AlertDescription>
        </Alert>
        <Button variant="outline" size="sm" onClick={refresh_all} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> 
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con métricas principales */}
      {dashboard_data && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ocupación Total</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard_data.metrics.total_ocupacion}/{dashboard_data.metrics.total_capacidad}
              </div>
              <Progress 
                value={dashboard_data.metrics.ocupacion_percentage} 
                className="mt-2" 
              />
              <p className="text-xs text-muted-foreground mt-1">
                {dashboard_data.metrics.ocupacion_percentage}% de capacidad
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Áreas Activas</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard_data.metrics.active_areas}</div>
              <p className="text-xs text-muted-foreground">
                {dashboard_data.metrics.active_cameras} cámaras monitoreando
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Eventos Hoy</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard_data.metrics.events_today.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Total: {dashboard_data.metrics.total_events.toLocaleString()}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Alertas Recientes</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {dashboard_data.alerts.recent_warnings}
              </div>
              <p className="text-xs text-muted-foreground">
                {dashboard_data.alerts.recent_exceeded} excedidas
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs principales */}
      <Tabs value={active_tab} onValueChange={set_active_tab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="areas">Áreas</TabsTrigger>
          <TabsTrigger value="activity">Actividad</TabsTrigger>
          <TabsTrigger value="config">Configuración</TabsTrigger>
        </TabsList>

        {/* Tab Dashboard - Vista en tiempo real */}
        <TabsContent value="dashboard" className="space-y-6">
          {dashboard_data && (
            <>
              {/* Controles de período */}
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <Select value={selected_period} onValueChange={set_selected_period}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Hoy</SelectItem>
                      <SelectItem value="week">Semana</SelectItem>
                      <SelectItem value="month">Mes</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="outline">
                    <Clock className="h-3 w-3 mr-1" />
                    Actualizado: {new Date(dashboard_data.generated_at).toLocaleTimeString()}
                  </Badge>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={load_dashboard_data}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Actualizar
                </Button>
              </div>

              {/* Vista de áreas en tiempo real */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {dashboard_data.areas.map((area) => (
                  <Card key={area.id} className="relative">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {object_icons[area.tipo] || <MapPin className="h-4 w-4" />}
                          <CardTitle className="text-sm">{area.nombre}</CardTitle>
                        </div>
                        <div className="flex items-center gap-2">
                          <div 
                            className={`w-3 h-3 rounded-full ${status_colors[area.color_estado] || 'bg-gray-500'}`}
                            title={`Estado: ${area.color_estado}`}
                          />
                          {area.modo_limite === 'hard' && (
                            <div title="Límite estricto">
                              <Target className="h-3 w-3 text-red-500" />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="text-center">
                          <div className="text-3xl font-bold">
                            {area.estado_actual}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            de {area.max_ocupacion} máximo
                          </div>
                        </div>
                        
                        <Progress 
                          value={area.percentage} 
                          className="h-2"
                        />
                        
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{area.percentage}% ocupado</span>
                          <span>{area.access_points_count} accesos</span>
                        </div>
                        
                        {area.percentage >= 80 && (
                          <div className="flex items-center gap-1 text-orange-600 text-xs">
                            <AlertOctagon className="h-3 w-3" />
                            <span>Nivel alto</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Actividad por tipo */}
              {dashboard_data.activity_by_type.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Actividad por Tipo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2">
                      {dashboard_data.activity_by_type.map((activity) => (
                        <div key={activity.tipo} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex items-center gap-2">
                            {object_icons[activity.tipo] || <Activity className="h-4 w-4" />}
                            <span className="font-medium capitalize">{activity.tipo}</span>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-bold">{activity.total_eventos} eventos</div>
                            <div className="text-xs text-muted-foreground">
                              ↗️ {activity.entradas} entradas · ↙️ {activity.salidas} salidas
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* Tab Áreas - Gestión de áreas */}
        <TabsContent value="areas" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Gestión de Áreas</h3>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Área
            </Button>
          </div>

          {state?.areas && state.areas.length > 0 ? (
            <div className="grid gap-4">
              {state.areas.map((area) => (
                <Card key={area.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {object_icons[area.tipo] || <MapPin className="h-5 w-5" />}
                        <div>
                          <h4 className="font-medium">{area.nombre}</h4>
                          <p className="text-sm text-muted-foreground capitalize">{area.tipo}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-bold">
                            {area.estado_actual}/{area.max_ocupacion}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {area.percentage}% ocupado
                          </div>
                        </div>
                        <div 
                          className={`w-4 h-4 rounded-full ${status_colors[area.color_estado] || 'bg-gray-500'}`}
                        />
                        <Button variant="outline" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <MapPin className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No hay áreas configuradas</h3>
                <p className="text-muted-foreground mb-4">
                  Crea tu primera área para comenzar a monitorear ocupación
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Primera Área
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Actividad - Eventos recientes y históricos */}
        <TabsContent value="activity" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Actividad Reciente</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
            </div>
          </div>

          {dashboard_data?.recent_events && dashboard_data.recent_events.length > 0 ? (
            <Card>
              <CardContent className="p-0">
                <div className="space-y-1">
                  {dashboard_data.recent_events.slice(0, 20).map((event, index) => (
                    <div 
                      key={event.id} 
                      className={`flex items-center justify-between p-3 ${index % 2 === 0 ? 'bg-muted/30' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          event.tipo === 'enter' ? 'bg-green-500' :
                          event.tipo === 'exit' ? 'bg-blue-500' :
                          event.tipo === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                        }`} />
                        <div>
                          <div className="font-medium">{event.area_nombre}</div>
                          <div className="text-xs text-muted-foreground">
                            {event.tipo === 'enter' ? 'Entrada' :
                             event.tipo === 'exit' ? 'Salida' :
                             event.tipo === 'warning' ? 'Alerta' : 'Límite excedido'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">{event.fuente}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(event.ts).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No hay actividad reciente</h3>
                <p className="text-muted-foreground">
                  Los eventos aparecerán aquí cuando se detecte actividad
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Configuración */}
        <TabsContent value="config" className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Configuración del Sistema</h3>
            <Button variant="outline" size="sm" onClick={load_state}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Recargar
            </Button>
          </div>

          {state?.system && (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Estado del Sistema</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>Estado:</span>
                    <Badge variant={state.system.enabled ? "default" : "secondary"}>
                      {state.system.enabled ? "Activo" : "Inactivo"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Modo:</span>
                    <span className="capitalize">{state.system.operation_mode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MQTT:</span>
                    <span>{state.system.mqtt_host}:{state.system.mqtt_port}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confianza mínima:</span>
                    <span>{(state.system.confidence_threshold * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Retención:</span>
                    <span>{state.system.retention_days} días</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Estadísticas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>Eventos totales:</span>
                    <span>{state.stats?.total_events?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Eventos hoy:</span>
                    <span>{state.stats?.events_today?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Áreas activas:</span>
                    <span>{state.stats?.active_areas || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ocupación total:</span>
                    <span>{state.stats?.total_ocupacion || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cámaras:</span>
                    <span>{state.cameras?.length || 0}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Objetos activos (compatibilidad con UI anterior) */}
          {state?.objetos && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Objetos Monitoreados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {state.objetos.map(obj => {
                    const active = state.activos.includes(obj);
                    return (
                      <Badge 
                        key={obj} 
                        variant={active ? "default" : "outline"}
                        className="capitalize"
                      >
                        {object_icons[obj]}
                        <span className="ml-1">{obj}</span>
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}