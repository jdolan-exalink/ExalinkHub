'use client';

/**
 * Panel principal del sistema de conteo (versión simplificada y estable)
 *
 * Características:
 * - Métricas agregadas (totales, activos, cámaras, modo)
 * - Activar / desactivar objetos mediante botones sólo con icono
 * - Filtros básicos (vista día|semana|mes, fecha, cámara en modo dividido)
 * - Resumen por objeto con porcentaje relativo
 *
 * Responsabilidades externas (page.tsx):
 * - Header y botón global de actualizar que incrementa refresh_trigger
 *
 * Notas de implementación:
 * - Nombres de variables y funciones en snake_case según lineamientos.
 * - Cada función expuesta tiene bloque JSDoc.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Car, Activity, RefreshCw, Calendar, Camera, BarChart3, TrendingUp, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';

/** Información base del módulo */
interface counting_info { mode: 'agregado' | 'dividido'; title: string; cameras: string[]; }
/** Estado de objetos (definidos y activos) */
interface counting_state { activos: string[]; objetos: string[]; }
/** Totales por etiqueta */
interface counting_totals { label: string; cnt: number; }
/** Resumen agregado */
interface counting_summary { totals: counting_totals[]; }

/** Iconos por tipo de objeto */
const object_icons: Record<string, React.ReactNode> = {
  auto: <Car className="h-4 w-4" />,
  moto: <Activity className="h-4 w-4" />,
  bicicleta: <Activity className="h-4 w-4" />,
  autobús: <Car className="h-4 w-4" />,
  personas: <Activity className="h-4 w-4" />,
  camión: <Car className="h-4 w-4" />
};

interface counting_panel_props { refresh_trigger?: number }

/**
 * Componente principal CountingPanel
 * @param refresh_trigger número que al cambiar fuerza recarga completa (proviene del header externo)
 */
export function CountingPanel({ refresh_trigger }: counting_panel_props) {
  // Estados de datos
  const [info, set_info] = useState<counting_info | null>(null);
  const [state, set_state] = useState<counting_state | null>(null);
  const [summary, set_summary] = useState<counting_summary | null>(null);

  // Estados UI
  const [loading, set_loading] = useState(true);
  const [refreshing, set_refreshing] = useState(false);
  const [selected_view, set_selected_view] = useState<'day' | 'week' | 'month'>('day');
  const [selected_date, set_selected_date] = useState(new Date().toISOString().split('T')[0]);
  const [selected_camera, set_selected_camera] = useState('');
  const [toggling, set_toggling] = useState<Set<string>>(new Set());

  /**
   * Carga metadata del módulo de conteo desde el backend
   */
  const load_info = useCallback(async () => {
    try {
      console.log('CountingPanel: Loading info from counting backend...');

      // Intentar múltiples URLs para el backend de conteo
      const backend_urls = [
        'http://localhost:2223/config',
        'http://127.0.0.1:2223/config',
        'http://host.docker.internal:2223/config'
      ];

      let config_response: Response | null = null;
      let last_error: Error | null = null;

      for (const url of backend_urls) {
        try {
          console.log(`CountingPanel: Trying to get config from ${url}...`);
          config_response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(5000)
          });

          if (config_response.ok) {
            console.log(`CountingPanel: Successfully got config from ${url}`);
            break;
          } else {
            console.warn(`CountingPanel: ${url} returned status ${config_response.status}`);
            last_error = new Error(`HTTP ${config_response.status}`);
          }
        } catch (error) {
          console.warn(`CountingPanel: Failed to get config from ${url}:`, error);
          last_error = error as Error;
          continue;
        }
      }

      if (!config_response || !config_response.ok) {
        throw last_error || new Error('No backend URL worked');
      }

      const config_data = await config_response.json();
      console.log('CountingPanel: Config data received:', config_data);

      // Crear info basado en la configuración
      const info_data: counting_info = {
        mode: config_data.operation_mode === 'zones' ? 'agregado' : 'dividido',
        title: config_data.title || 'Sistema de Conteo',
        cameras: config_data.camera_zones ? [config_data.camera_zones] :
                config_data.camera_in && config_data.camera_out ? [config_data.camera_in, config_data.camera_out] : []
      };

      set_info(info_data);
      if (info_data.mode === 'dividido' && info_data.cameras?.length && !selected_camera) {
        set_selected_camera(info_data.cameras[0]);
      }
    } catch (error) {
      console.error('CountingPanel: Error loading info from counting backend:', error);
      toast({ title: 'Error', description: 'No se pudo cargar información del backend de conteo', variant: 'destructive' });
    }
  }, [selected_camera]);

  /**
   * Carga el estado (objetos definidos y activos) desde el backend
   */
  const load_state = useCallback(async () => {
    try {
      console.log('CountingPanel: Loading state from counting backend...');

      // Intentar múltiples URLs para el backend de conteo
      const backend_urls = [
        'http://localhost:2223/config',
        'http://127.0.0.1:2223/config',
        'http://host.docker.internal:2223/config'
      ];

      let response: Response | null = null;
      let last_error: Error | null = null;

      for (const url of backend_urls) {
        try {
          console.log(`CountingPanel: Trying to get config from ${url}...`);
          response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(5000)
          });

          if (response.ok) {
            console.log(`CountingPanel: Successfully got config from ${url}`);
            break;
          } else {
            console.warn(`CountingPanel: ${url} returned status ${response.status}`);
            last_error = new Error(`HTTP ${response.status}`);
          }
        } catch (error) {
          console.warn(`CountingPanel: Failed to get config from ${url}:`, error);
          last_error = error as Error;
          continue;
        }
      }

      if (!response || !response.ok) {
        throw last_error || new Error('No backend URL worked');
      }

      const config_data = await response.json();
      console.log('CountingPanel: Config data received:', config_data);

      // El backend devuelve un objeto CountingConfig completo
      // Extraer los objetos de la configuración
      const objects_list = config_data.objects || [];

      // Crear estado basado en la configuración
      const state_data: counting_state = {
        activos: objects_list, // Todos los objetos configurados están "activos"
        objetos: objects_list
      };

      set_state(state_data);
    } catch (error) {
      console.error('CountingPanel: Error loading state from counting backend:', error);
      toast({ title: 'Error', description: 'No se pudo cargar estado del backend de conteo', variant: 'destructive' });
    }
  }, []);

  /**
   * Carga resumen agregado según filtros seleccionados desde el backend
   */
  const load_summary = useCallback(async () => {
    try {
      console.log('CountingPanel: Loading summary from counting backend...');

      // Intentar múltiples URLs para el backend de conteo
      const backend_urls = [
        'http://localhost:2223/metrics',
        'http://127.0.0.1:2223/metrics',
        'http://host.docker.internal:2223/metrics'
      ];

      let response: Response | null = null;
      let last_error: Error | null = null;

      for (const url of backend_urls) {
        try {
          console.log(`CountingPanel: Trying to get metrics from ${url}...`);
          response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(5000)
          });

          if (response.ok) {
            console.log(`CountingPanel: Successfully got metrics from ${url}`);
            break;
          } else {
            console.warn(`CountingPanel: ${url} returned status ${response.status}`);
            last_error = new Error(`HTTP ${response.status}`);
          }
        } catch (error) {
          console.warn(`CountingPanel: Failed to get metrics from ${url}:`, error);
          last_error = error as Error;
          continue;
        }
      }

      if (!response || !response.ok) {
        throw last_error || new Error('No backend URL worked');
      }

      const metrics_data = await response.json();
      console.log('CountingPanel: Metrics data received:', metrics_data);

      // Crear resumen basado en las métricas del backend
      const summary_data: counting_summary = {
        totals: (metrics_data.object_metrics ? Object.entries(metrics_data.object_metrics) : []).map(([label, metric]: [string, any]) => ({
          label: label,
          cnt: metric.count || 0
        }))
      };

      // Si no hay métricas específicas, crear entradas con 0 para todos los objetos activos
      if (summary_data.totals.length === 0 && state?.activos) {
        summary_data.totals = state.activos.map(obj => ({
          label: obj,
          cnt: 0
        }));
      }

      set_summary(summary_data);
    } catch (error) {
      console.error('CountingPanel: Error loading summary from counting backend:', error);
      toast({ title: 'Error', description: 'No se pudo cargar resumen del backend de conteo', variant: 'destructive' });
    }
  }, []);

  /**
   * Refresca toda la información (info + state + summary)
   */
  const refresh_all = useCallback(async () => {
    set_refreshing(true);
    try {
      // Cargar info y state primero
      await Promise.all([load_info(), load_state()]);
      // Luego cargar summary que depende de state
      await load_summary();
    } finally {
      set_refreshing(false);
    }
  }, [load_info, load_state, load_summary]);

  // Carga inicial
  useEffect(() => { set_loading(true); refresh_all().finally(() => set_loading(false)); }, [refresh_all]);
  // Disparo externo
  useEffect(() => { if (refresh_trigger !== undefined) refresh_all(); }, [refresh_trigger, refresh_all]);
  // Cambios de filtros -> solo resumen
  useEffect(() => {
    if (!loading && info && state && summary) {
      load_summary();
    }
  }, [selected_view, selected_date, selected_camera, loading, info, state, summary, load_summary]);

  /**
   * Activa / desactiva un objeto (actualiza configuración en el backend)
   * @param label nombre del objeto
   */
  const toggle_object = async (label: string) => {
    if (!state) return;

    set_toggling(p => new Set(p).add(label));
    try {
      console.log('CountingPanel: Toggling object in counting backend...');

      // Intentar múltiples URLs para obtener configuración
      const backend_urls = [
        'http://localhost:2223/config',
        'http://127.0.0.1:2223/config',
        'http://host.docker.internal:2223/config'
      ];

      let config_response: Response | null = null;
      let last_error: Error | null = null;

      for (const url of backend_urls) {
        try {
          console.log(`CountingPanel: Trying to get config from ${url}...`);
          config_response = await fetch(url, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(5000)
          });

          if (config_response.ok) {
            console.log(`CountingPanel: Successfully got config from ${url}`);
            break;
          } else {
            console.warn(`CountingPanel: ${url} returned status ${config_response.status}`);
            last_error = new Error(`HTTP ${config_response.status}`);
          }
        } catch (error) {
          console.warn(`CountingPanel: Failed to get config from ${url}:`, error);
          last_error = error as Error;
          continue;
        }
      }

      if (!config_response || !config_response.ok) {
        throw last_error || new Error('No backend URL worked');
      }

      const config_data = await config_response.json();
      console.log('CountingPanel: Config data received:', config_data);

      // El backend devuelve un objeto CountingConfig completo
      // Extraer la lista de objetos
      const current_objects = config_data.objects || [];

      // Actualizar lista de objetos
      const new_objects = current_objects.includes(label)
        ? current_objects.filter((obj: string) => obj !== label)
        : [...current_objects, label];

      // Crear el objeto completo para enviar al backend
      const config_to_update = {
        ...config_data,
        objects: new_objects
      };

      // Intentar actualizar configuración
      let update_response: Response | null = null;
      for (const url of backend_urls) {
        try {
          console.log(`CountingPanel: Trying to update config at ${url}...`);
          update_response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config_to_update),
            signal: AbortSignal.timeout(5000)
          });

          if (update_response.ok) {
            console.log(`CountingPanel: Successfully updated config at ${url}`);
            break;
          } else {
            console.warn(`CountingPanel: ${url} returned status ${update_response.status}`);
          }
        } catch (error) {
          console.warn(`CountingPanel: Failed to update config at ${url}:`, error);
          continue;
        }
      }

      if (!update_response || !update_response.ok) {
        throw new Error('Failed to update configuration');
      }

      // Actualizar estado local
      set_state(prev => prev ? {
        ...prev,
        activos: new_objects,
        objetos: new_objects
      } : prev);

      await load_summary();
      toast({
        title: 'Actualizado',
        description: `Objeto ${label} ${new_objects.includes(label) ? 'activado' : 'desactivado'}`
      });
    } catch (error) {
      console.error('CountingPanel: Error toggling object:', error);
      toast({ title: 'Error', description: 'Cambio de estado fallido', variant: 'destructive' });
    } finally {
      set_toggling(p => { const n = new Set(p); n.delete(label); return n; });
    }
  };

  // Estados de carga / error
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Cargando datos...</p>
        </div>
      </div>
    );
  }

  if (!info || !state) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive"><AlertDescription>Error de configuración del módulo de conteo.</AlertDescription></Alert>
        <Button variant="outline" size="sm" onClick={refresh_all} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Reintentar
        </Button>
      </div>
    );
  }

  const total_count = summary?.totals?.reduce((s, it) => s + it.cnt, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Métricas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Detectados</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total_count.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">en el período seleccionado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Objetos Activos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{state.activos.length}</div>
            <p className="text-xs text-muted-foreground">de {state.objetos.length} disponibles</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cámaras</CardTitle>
            <Camera className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{info.cameras.length}</div>
            <p className="text-xs text-muted-foreground">monitoreando eventos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Modo</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{info.mode}</div>
            <p className="text-xs text-muted-foreground">vista {info.mode}</p>
          </CardContent>
        </Card>
      </div>

      {/* Objetos */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><Activity className="h-4 w-4" /> Objetos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {state.objetos.map(o => {
              const active = state.activos.includes(o);
              const toggling_now = toggling.has(o);
              return (
                <Button
                  key={o}
                  variant={active ? 'default' : 'outline'}
                  size="icon"
                  onClick={() => toggle_object(o)}
                  disabled={toggling_now}
                  title={o}
                  aria-label={o}
                  className="h-8 w-8 relative"
                >
                  {toggling_now ? <RefreshCw className="h-4 w-4 animate-spin" /> : object_icons[o] || <Activity className="h-4 w-4" />}
                  <span className={`absolute -top-1 -right-1 h-2 w-2 rounded-full ${active ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            <Select value={selected_view} onValueChange={(v: any) => set_selected_view(v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Día</SelectItem>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mes</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <input
            type="date"
            value={selected_date}
            onChange={e => set_selected_date(e.target.value)}
            className="px-3 py-1 border rounded-md"
            aria-label="Seleccionar fecha"
            title="Seleccionar fecha"
          />
          {info.mode === 'dividido' && (
            <Select value={selected_camera} onValueChange={set_selected_camera}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Todas las cámaras" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas las cámaras</SelectItem>
                {info.cameras.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Resumen */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {summary.totals.map(t => (
            <Card key={t.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2">
                  {object_icons[t.label] || <Activity className="h-4 w-4 text-muted-foreground" />}
                  <CardTitle className="text-sm font-medium capitalize">{t.label}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{t.cnt.toLocaleString()}</div>
                <Progress value={total_count ? (t.cnt / total_count) * 100 : 0} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-1">{total_count ? Math.round((t.cnt / total_count) * 100) : 0}% del total</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}