/**
 * Panel principal del sistema de matrículas (LPR)
 * 
 * Componente principal que orquesta todos los demás componentes del módulo LPR.
 * Gestiona el estado principal, filtros, paginación y comunicación con la API.
 * 
 * Todas las variables y funciones usan snake_case siguiendo las convenciones
 * del proyecto ExalinkHub.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, Download, RefreshCw, Settings, Search, Calendar, Filter } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';

import { LPRFilters } from './lpr-filters';
import { LPRTable } from './lpr-table';
import { LPRStatsCards } from './lpr-stats-cards';
import { LPRSettingsModal, LPRImageViewer } from './lpr-auxiliar-components';

// Tipos de datos para el panel LPR
interface PlateEvent {
  id: number;
  frigate_event_id: string;
  camera_name: string;
  license_plate: string;
  timestamp: string;
  start_time: string;
  end_time?: string;
  zone?: string;
  plate_confidence?: number;
  plate_region?: string;
  vehicle_type?: string;
  vehicle_color?: string;
  speed_kmh?: number;
  direction?: string;
  traffic_light_status?: 'red' | 'yellow' | 'green' | 'unknown';
  snapshot_url?: string;
  clip_url?: string;
  false_positive: boolean;
  has_clip: boolean;
  has_snapshot: boolean;
  metadata?: any;
}

interface PlateEventFilters {
  camera_name?: string;
  license_plate?: string;
  start_date?: string;
  end_date?: string;
  traffic_light_status?: string;
  vehicle_type?: string;
  false_positive?: boolean;
  zone?: string;
  min_confidence?: number;
}

interface PlateEventListResponse {
  events: PlateEvent[];
  total: number;
  page: number;
  limit: number;
  has_next: boolean;
}

interface SystemStats {
  total_events: number;
  events_today: number;
  events_this_week: number;
  events_this_month: number;
  cameras_active: number;
  top_cameras: Array<{name: string; count: number}>;
  top_plates: Array<{plate: string; count: number}>;
  traffic_light_stats: Record<string, number>;
}

const LRP_API_BASE_URL = 'http://localhost:2221/api';

/**
 * Hook personalizado para manejar la autenticación con la API LPR
 */
const use_lpr_auth = () => {
  const [auth_token, set_auth_token] = useState<string | null>(null);
  
  const create_auth_header = useCallback((): Record<string, string> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (auth_token) {
      headers['Authorization'] = `Basic ${auth_token}`;
    }
    
    return headers;
  }, [auth_token]);
  
  return { auth_token, set_auth_token, create_auth_header };
};

/**
 * Función para realizar peticiones autenticadas a la API LPR
 */
const api_fetch = async (url: string, options: RequestInit = {}, auth_header?: Record<string, string>) => {
  const config: RequestInit = {
    ...options,
    headers: {
      ...auth_header,
      ...options.headers,
    },
  };
  
  const response = await fetch(`${LRP_API_BASE_URL}${url}`, config);
  
  if (response.status === 401) {
    throw new Error('No autorizado. Verifica las credenciales.');
  }
  
  if (!response.ok) {
    const error_text = await response.text();
    throw new Error(`Error ${response.status}: ${error_text}`);
  }
  
  return response.json();
};

/**
 * Componente principal del panel LPR
 */
export function LPRPanel() {
  const t = useTranslations('lpr_panel');
  const { auth_token, set_auth_token, create_auth_header } = use_lpr_auth();
  
  // Estados principales
  const [events, set_events] = useState<PlateEvent[]>([]);
  const [total_events, set_total_events] = useState(0);
  const [current_page, set_current_page] = useState(1);
  const [is_loading, set_is_loading] = useState(false);
  const [is_refreshing, set_is_refreshing] = useState(false);
  
  // Estados de filtros
  const [filters, set_filters] = useState<PlateEventFilters>({
    start_date: new Date().toISOString().split('T')[0], // Hoy por defecto
    end_date: new Date().toISOString().split('T')[0],
  });
  
  // Estados de modales y vistas
  const [settings_modal_open, set_settings_modal_open] = useState(false);
  const [selected_event, set_selected_event] = useState<PlateEvent | null>(null);
  const [image_viewer_open, set_image_viewer_open] = useState(false);
  
  // Estados de estadísticas
  const [stats, set_stats] = useState<SystemStats | null>(null);
  const [connection_status, set_connection_status] = useState<'connecting' | 'connected' | 'error'>('connecting');
  
  // Configuración de paginación
  const EVENTS_PER_PAGE = 25;
  
  /**
   * Carga eventos desde la API con filtros aplicados
   */
  const load_events = useCallback(async (page: number = 1, reset_list: boolean = true) => {
    if (!auth_token) return;
    
    try {
      set_is_loading(true);
      
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', EVENTS_PER_PAGE.toString());
      
      // Aplicar filtros
      if (filters.camera_name) params.set('camera_name', filters.camera_name);
      if (filters.license_plate) params.set('license_plate', filters.license_plate);
      if (filters.start_date) params.set('start_date', `${filters.start_date}T00:00:00`);
      if (filters.end_date) params.set('end_date', `${filters.end_date}T23:59:59`);
      if (filters.traffic_light_status) params.set('traffic_light_status', filters.traffic_light_status);
      if (filters.vehicle_type) params.set('vehicle_type', filters.vehicle_type);
      if (filters.false_positive !== undefined) params.set('false_positive', filters.false_positive.toString());
      if (filters.zone) params.set('zone', filters.zone);
      if (filters.min_confidence !== undefined) params.set('min_confidence', filters.min_confidence.toString());
      
      const response: PlateEventListResponse = await api_fetch(
        `/events?${params.toString()}`,
        { method: 'GET' },
        create_auth_header()
      );
      
      if (reset_list) {
        set_events(response.events);
      } else {
        set_events(prev => [...prev, ...response.events]);
      }
      
      set_total_events(response.total);
      set_current_page(page);
      set_connection_status('connected');
      
    } catch (error) {
      console.error('Error loading events:', error);
      set_connection_status('error');
      toast({
        title: 'Error al cargar eventos',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      set_is_loading(false);
      set_is_refreshing(false);
    }
  }, [auth_token, filters, create_auth_header]);
  
  /**
   * Carga estadísticas del sistema
   */
  const load_stats = useCallback(async () => {
    if (!auth_token) return;
    
    try {
      const response: SystemStats = await api_fetch(
        '/stats',
        { method: 'GET' },
        create_auth_header()
      );
      
      set_stats(response);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, [auth_token, create_auth_header]);
  
  /**
   * Actualiza un evento específico
   */
  const update_event = useCallback(async (event_id: number, updates: Partial<PlateEvent>) => {
    if (!auth_token) return;
    
    try {
      const updated_event: PlateEvent = await api_fetch(
        `/events/${event_id}`,
        {
          method: 'PUT',
          body: JSON.stringify(updates)
        },
        create_auth_header()
      );
      
      // Actualizar la lista de eventos
      set_events(prev => prev.map(event => 
        event.id === event_id ? updated_event : event
      ));
      
      toast({
        title: 'Evento actualizado',
        description: 'Los cambios se han guardado correctamente.',
      });
      
    } catch (error) {
      console.error('Error updating event:', error);
      toast({
        title: 'Error al actualizar evento',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    }
  }, [auth_token, create_auth_header]);
  
  /**
   * Exporta eventos a Excel
   */
  const export_events = useCallback(async (format: 'xlsx' | 'csv' = 'xlsx') => {
    if (!auth_token) return;
    
    try {
      const response = await fetch(`${LRP_API_BASE_URL}/export`, {
        method: 'POST',
        headers: create_auth_header(),
        body: JSON.stringify({
          format,
          filters,
          include_images: true
        })
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }
      
      // Descargar archivo
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `eventos_matriculas_${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast({
        title: 'Exportación completada',
        description: `Se ha descargado el archivo ${format.toUpperCase()}.`,
      });
      
    } catch (error) {
      console.error('Error exporting events:', error);
      toast({
        title: 'Error en exportación',
        description: error instanceof Error ? error.message : 'Error desconocido',
        variant: 'destructive',
      });
    }
  }, [auth_token, filters, create_auth_header]);
  
  /**
   * Maneja la aplicación de filtros
   */
  const handle_filters_apply = useCallback((new_filters: PlateEventFilters) => {
    set_filters(new_filters);
    set_current_page(1);
  }, []);
  
  /**
   * Maneja la actualización manual de datos
   */
  const handle_refresh = useCallback(() => {
    set_is_refreshing(true);
    load_events(1, true);
    load_stats();
  }, [load_events, load_stats]);
  
  /**
   * Maneja la carga de más eventos (paginación)
   */
  const handle_load_more = useCallback(() => {
    const next_page = current_page + 1;
    load_events(next_page, false);
  }, [current_page, load_events]);
  
  /**
   * Maneja la visualización de imágenes
   */
  const handle_view_image = useCallback((event: PlateEvent) => {
    set_selected_event(event);
    set_image_viewer_open(true);
  }, []);
  
  /**
   * Maneja la edición de matrículas
   */
  const handle_edit_plate = useCallback((event: PlateEvent, new_plate: string) => {
    update_event(event.id, { license_plate: new_plate });
  }, [update_event]);
  
  /**
   * Maneja el marcado de falsos positivos
   */
  const handle_toggle_false_positive = useCallback((event: PlateEvent) => {
    update_event(event.id, { false_positive: !event.false_positive });
  }, [update_event]);
  
  // Efectos
  useEffect(() => {
    // Solicitar token de autenticación al montar el componente
    // En un caso real, esto vendría del contexto de autenticación de la app
    const stored_token = localStorage.getItem('lpr_auth_token');
    if (stored_token) {
      set_auth_token(stored_token);
    }
  }, []);
  
  useEffect(() => {
    if (auth_token) {
      load_events(1, true);
      load_stats();
    }
  }, [auth_token, load_events, load_stats]);
  
  useEffect(() => {
    if (auth_token) {
      load_events(1, true);
    }
  }, [filters, auth_token, load_events]);
  
  // Renderizado condicional para estado de conexión
  if (connection_status === 'connecting') {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Conectando al sistema LPR...</p>
          </div>
        </div>
      </div>
    );
  }
  
  if (connection_status === 'error' && !auth_token) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No se pudo conectar al sistema LPR. Verifica que el servidor esté ejecutándose en el puerto 2221.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  
  const has_more_events = (current_page * EVENTS_PER_PAGE) < total_events;
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Panel de Matrículas
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestión y análisis de eventos de reconocimiento de matrículas
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handle_refresh}
            disabled={is_refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${is_refreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => export_events('xlsx')}
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => set_settings_modal_open(true)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configuración
          </Button>
        </div>
      </div>
      
      {/* Estado de conexión */}
      {connection_status === 'connected' && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          Conectado al sistema LPR
        </div>
      )}
      
      {/* Tarjetas de estadísticas */}
      {stats && <LPRStatsCards stats={stats} />}
      
      {/* Tabs principales */}
      <Tabs defaultValue="events" className="space-y-6">
        <TabsList>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Eventos
          </TabsTrigger>
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Analíticas
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="events" className="space-y-6">
          {/* Filtros */}
          <LPRFilters
            filters={filters}
            on_filters_change={handle_filters_apply}
            is_loading={is_loading}
          />
          
          {/* Tabla de eventos */}
          <LPRTable
            events={events}
            is_loading={is_loading}
            on_view_image={handle_view_image}
            on_edit_plate={handle_edit_plate}
            on_toggle_false_positive={handle_toggle_false_positive}
          />
          
          {/* Información de paginación */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Mostrando {events.length} de {total_events} eventos
            </div>
            
            {has_more_events && (
              <Button
                variant="outline"
                onClick={handle_load_more}
                disabled={is_loading}
              >
                {is_loading ? 'Cargando...' : 'Cargar más eventos'}
              </Button>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="analytics" className="space-y-6">
          {/* TODO: Implementar vista de analíticas */}
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  Vista de analíticas en desarrollo
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Modales */}
      <LPRSettingsModal
        is_open={settings_modal_open}
        on_close={() => set_settings_modal_open(false)}
        auth_header={create_auth_header()}
      />
      
      <LPRImageViewer
        event={selected_event}
        is_open={image_viewer_open}
        on_close={() => {
          set_image_viewer_open(false);
          set_selected_event(null);
        }}
      />
    </div>
  );
}