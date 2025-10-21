/**
 * Componente de configuración del módulo de conteo
 * 
 * Maneja la configuración del sistema de conteo de objetos incluyendo:
 * - Configuración de cámaras para monitoreo
 * - Selección de objetos a contar
 * - Configuración de umbrales y filtros
 * - Gestión de retención de datos
 * - Configuración de notificaciones
 * 
 * Sigue la estructura y patrones del módulo LPR.
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { 
  Settings, 
  Camera, 
  Save, 
  RefreshCw, 
  Plus,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
  Info,
  Clock,
  Database,
  CheckCircle
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';

// Tipos para la configuración
interface counting_config {
  enabled: boolean;
  operation_mode: 'two_cameras' | 'zones';
  title: string;
  // Para modo de 2 cámaras
  camera_in?: string;
  camera_out?: string;
  // Para modo de zonas
  camera_zones?: string;
  zone_in?: string;
  zone_out?: string;
  objects: string[];
  retention_days: number;
  confidence_threshold: number;
  notifications_enabled: boolean;
  notification_email?: string;
  config_json: string;
}

interface frigate_camera {
  name: string;
  enabled: boolean;
  server_id: number;
  server_name: string;
  zones?: string[];
  display_name?: string;
}

interface frigate_server {
  id: number;
  name: string;
  url: string;
  port: number;
  protocol: string;
  enabled: boolean;
  status?: {
    api_status: 'online' | 'offline' | 'error';
    cpu_usage?: number;
    gpu_usage?: number;
    memory_usage?: number;
    disk_usage?: number;
    last_check?: string;
  };
}

// Objetos disponibles para conteo según especificación
const available_objects = [
  { id: 'car', label_es: 'Autos', label_en: 'car', icon: '🚗' },
  { id: 'bus', label_es: 'Colectivos', label_en: 'bus', icon: '🚌' },
  { id: 'motorcycle', label_es: 'Motos', label_en: 'motorcycle', icon: '🏍️' }, 
  { id: 'bicycle', label_es: 'Bicicletas', label_en: 'bicycle', icon: '🚲' },
  { id: 'truck', label_es: 'Camiones', label_en: 'truck', icon: '🚛' },
  { id: 'person', label_es: 'Personas', label_en: 'person', icon: '👤' }
];

/**
 * Componente principal de configuración de conteo
 */
interface counting_config_props { embedded?: boolean }

export function CountingConfig({ embedded = false }: counting_config_props) {
  const t = useTranslations('counting');
  
  // Estados de configuración
  /**
   * Gestión de múltiples sistemas de conteo
   * systems: lista de sistemas configurados
   * selected_system: índice del sistema actualmente editado
   */
  const [systems, set_systems] = useState<counting_config[]>([{
    enabled: false,
    operation_mode: 'zones',
    title: 'Sistema de Conteo',
    objects: [],
    retention_days: 30,
    confidence_threshold: 0.7,
    notifications_enabled: false,
    config_json: '{}'
  }]);
  const [selected_system, set_selected_system] = useState(0);
  const config = systems[selected_system];
  const set_config = (updater: (prev: counting_config) => counting_config) => {
    set_systems(prev => prev.map((sys, idx) => idx === selected_system ? updater(sys) : sys));
  };
  
  // Estados de UI
  const [loading, set_loading] = useState(true);
  const [saving, set_saving] = useState(false);
  const [testing_connection, set_testing_connection] = useState(false);
  const [available_cameras, set_available_cameras] = useState<frigate_camera[]>([]);
  const [cameras_loading, set_cameras_loading] = useState(false);
  const [connection_status, set_connection_status] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [frigate_servers, set_frigate_servers] = useState<frigate_server[]>([]);
  const [service_status, set_service_status] = useState<'unknown' | 'running' | 'stopped' | 'error'>('unknown');
  
  // Estados de formulario
  const [active_tab, set_active_tab] = useState('general');
  const [config_json_text, set_config_json_text] = useState('{}');
  const [form_errors, set_form_errors] = useState<Record<string, string>>({});

  /**
   * Carga la configuración actual desde el backend de conteo
   */
  const load_config = useCallback(async () => {
    try {
      console.log('CountingConfig: Attempting to load config from counting backend...');

      // Intentar múltiples URLs para el backend de conteo
      const backend_urls = [
        'http://localhost:2223/config',
        'http://127.0.0.1:2223/config',
        'http://counting-backend:2223/config'
      ];

      let response: Response | null = null;
      let last_error: Error | null = null;

      for (const url of backend_urls) {
        try {
          console.log(`CountingConfig: Trying ${url}...`);
          response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
            // Timeout de 5 segundos
            signal: AbortSignal.timeout(5000)
          });

          if (response.ok) {
            console.log(`CountingConfig: Successfully connected to ${url}`);
            break;
          } else {
            console.warn(`CountingConfig: ${url} returned status ${response.status}`);
            last_error = new Error(`HTTP ${response.status}`);
          }
        } catch (error) {
          console.warn(`CountingConfig: Failed to connect to ${url}:`, error);
          last_error = error as Error;
          continue;
        }
      }

      if (!response || !response.ok) {
        throw last_error || new Error('No backend URL worked');
      }

      const config_data = await response.json();
      console.log('CountingConfig: Config data received:', config_data);

      if (config_data) {
        const parsed_config = {
          enabled: config_data.enabled || false,
          operation_mode: config_data.operation_mode || 'two_cameras',
          title: config_data.title || 'Sistema de Conteo',
          camera_in: config_data.camera_in || '',
          camera_out: config_data.camera_out || '',
          camera_zones: config_data.camera_zones || '',
          zone_in: config_data.zone_in || '',
          zone_out: config_data.zone_out || '',
          objects: Array.isArray(config_data.objects) ? config_data.objects : [],
          retention_days: config_data.retention_days || 30,
          confidence_threshold: config_data.confidence_threshold || 0.7,
          notifications_enabled: config_data.notifications_enabled || false,
          notification_email: config_data.notification_email || '',
          config_json: config_data.config_json || '{}'
        };

        set_config(() => parsed_config);
        set_config_json_text(parsed_config.config_json);
        console.log('CountingConfig: Config loaded successfully');
      }
    } catch (error) {
      console.error('CountingConfig: Error loading counting config from backend:', error);
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar al backend de conteo. Verifica que esté corriendo en el puerto 2223.',
        variant: 'destructive'
      });

      // Cargar configuración por defecto en caso de error
      const default_config = {
        enabled: false,
        operation_mode: 'zones' as const,
        title: 'Sistema de Conteo',
        objects: [],
        retention_days: 30,
        confidence_threshold: 0.7,
        notifications_enabled: false,
        config_json: '{}'
      };
      set_config(() => default_config);
      set_config_json_text(default_config.config_json);
    }
  }, []);

  /**
   * Carga las cámaras disponibles de todos los servidores Frigate configurados
   */
  const load_cameras = useCallback(async () => {
    set_cameras_loading(true);
    try {
      // Obtener servidores Frigate configurados desde la base de datos
      const servers_response = await fetch('/api/config/servers');
      if (!servers_response.ok) {
        throw new Error('Error al obtener servidores configurados');
      }
      
      const servers_data = await servers_response.json();
      const configured_servers: frigate_server[] = servers_data.servers || [];
      set_frigate_servers(configured_servers);
      
      // Filtrar solo servidores activos (habilitados)
      const active_servers = configured_servers.filter(server => server.enabled);
      
      if (active_servers.length === 0) {
        console.warn('No hay servidores Frigate activos configurados');
        set_available_cameras([]);
        set_connection_status('error');
        toast({
          title: 'Sin servidores activos',
          description: 'No hay servidores Frigate activos configurados en el sistema',
          variant: 'destructive'
        });
        return;
      }
      
      // Obtener cámaras de cada servidor activo
      const all_cameras: frigate_camera[] = [];
      
      for (const server of active_servers) {
        try {
          console.log(`Consultando cámaras del servidor: ${server.name} (ID: ${server.id})`);
          const cameras_response = await fetch(`/api/frigate/cameras?server_id=${server.id}`);
          
          if (cameras_response.ok) {
            const cameras_data = await cameras_response.json();
            const server_cameras: any[] = cameras_data || [];
            
            // Agregar información del servidor a cada cámara
            const cameras_with_server = server_cameras.map(cam => ({
              name: cam.name || cam.id,
              enabled: cam.enabled !== false,
              server_id: server.id,
              server_name: server.name,
              zones: cam.zones || [],
              display_name: cam.name || cam.id
            }));
            
            all_cameras.push(...cameras_with_server);
            console.log(`Servidor ${server.name}: ${cameras_with_server.length} cámaras encontradas`);
          } else {
            console.error(`Error consultando cámaras del servidor ${server.name}: ${cameras_response.status}`);
          }
        } catch (error) {
          console.error(`Error consultando servidor ${server.name}:`, error);
        }
      }
      
      set_available_cameras(all_cameras);
      set_connection_status(all_cameras.length > 0 ? 'connected' : 'error');
      
      if (all_cameras.length === 0) {
        toast({
          title: 'Sin cámaras disponibles',
          description: 'No se encontraron cámaras en los servidores Frigate configurados',
          variant: 'destructive'
        });
      } else {
        console.log(`Total de cámaras cargadas: ${all_cameras.length}`);
      }
    } catch (error) {
      console.error('Error loading cameras:', error);
      set_connection_status('error');
      set_available_cameras([]);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las cámaras disponibles',
        variant: 'destructive'
      });
    } finally {
      set_cameras_loading(false);
    }
  }, []);

  /**
   * Valida la configuración del formulario
   */
  const validate_config = useCallback(() => {
    const errors: Record<string, string> = {};
    
    if (!config.title.trim()) {
      errors.title = 'El título es requerido';
    }
    
    // Validar según modo de operación
    if (config.operation_mode === 'two_cameras') {
      if (!config.camera_in) {
        errors.camera_in = 'Debe seleccionar una cámara de entrada';
      }
      if (!config.camera_out) {
        errors.camera_out = 'Debe seleccionar una cámara de salida';
      }
      if (config.camera_in === config.camera_out) {
        errors.camera_out = 'Las cámaras de entrada y salida deben ser diferentes';
      }
    } else {
      if (!config.camera_zones) {
        errors.camera_zones = 'Debe seleccionar una cámara con zonas';
      }
      if (!config.zone_in) {
        errors.zone_in = 'Debe seleccionar una zona de entrada';
      }
      if (!config.zone_out) {
        errors.zone_out = 'Debe seleccionar una zona de salida';
      }
      if (config.zone_in === config.zone_out) {
        errors.zone_out = 'Las zonas de entrada y salida deben ser diferentes';
      }
    }
    
    if (config.objects.length === 0) {
      errors.objects = 'Debe seleccionar al menos un objeto para contar';
    }
    
    if (config.retention_days < 1 || config.retention_days > 365) {
      errors.retention_days = 'La retención debe estar entre 1 y 365 días';
    }
    
    if (config.confidence_threshold < 0.1 || config.confidence_threshold > 1.0) {
      errors.confidence_threshold = 'El umbral debe estar entre 0.1 y 1.0';
    }
    
    if (config.notifications_enabled && !config.notification_email?.trim()) {
      errors.notification_email = 'Email requerido para notificaciones';
    }
    
    // Validar JSON de configuración
    try {
      JSON.parse(config_json_text);
    } catch (e) {
      errors.config_json = 'JSON de configuración inválido';
    }
    
    set_form_errors(errors);
    return Object.keys(errors).length === 0;
  }, [config, config_json_text]);

  /**
   * Guarda la configuración en el backend de conteo
   */
  const save_config = useCallback(async () => {
    if (!validate_config()) {
      toast({
        title: 'Error de validación',
        description: 'Por favor corrija los errores en el formulario',
        variant: 'destructive'
      });
      return;
    }

    set_saving(true);
    try {
      const config_to_save = {
        ...config,
        config_json: config_json_text
      };

      console.log('CountingConfig: Attempting to save config to counting backend...');

      // Intentar múltiples URLs para el backend de conteo
      const backend_urls = [
        'http://localhost:2223/config',
        'http://127.0.0.1:2223/config',
        'http://counting-backend:2223/config'
      ];

      let response: Response | null = null;
      let last_error: Error | null = null;

      for (const url of backend_urls) {
        try {
          console.log(`CountingConfig: Trying to save to ${url}...`);
          response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(config_to_save),
            signal: AbortSignal.timeout(5000)
          });

          if (response.ok) {
            console.log(`CountingConfig: Successfully saved to ${url}`);
            break;
          } else {
            console.warn(`CountingConfig: ${url} returned status ${response.status}`);
            last_error = new Error(`HTTP ${response.status}`);
          }
        } catch (error) {
          console.warn(`CountingConfig: Failed to save to ${url}:`, error);
          last_error = error as Error;
          continue;
        }
      }

      if (!response || !response.ok) {
        throw last_error || new Error('No backend URL worked');
      }

      const result = await response.json();
      console.log('CountingConfig: Save result:', result);

      toast({
        title: 'Configuración guardada',
        description: 'La configuración se ha guardado correctamente en el backend de conteo'
      });

      // Recargar configuración para reflejar cambios
      await load_config();

    } catch (error) {
      console.error('CountingConfig: Error saving config to backend:', error);
      toast({
        title: 'Error de conexión',
        description: 'No se pudo guardar la configuración. Verifica la conexión con el backend de conteo.',
        variant: 'destructive'
      });
    } finally {
      set_saving(false);
    }
  }, [config, config_json_text, validate_config, load_config]);

  /**
   * Prueba la conexión con el backend de conteo
   */
  const test_connection = useCallback(async () => {
    set_testing_connection(true);
    try {
      console.log('CountingConfig: Testing connection to counting backend...');

      // Intentar múltiples URLs para el backend de conteo
      const backend_urls = [
        'http://localhost:2223/health',
        'http://127.0.0.1:2223/health',
        'http://counting-backend:2223/health'
      ];

      let response: Response | null = null;
      let last_error: Error | null = null;

      for (const url of backend_urls) {
        try {
          console.log(`CountingConfig: Testing connection to ${url}...`);
          response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(5000)
          });

          if (response.ok) {
            console.log(`CountingConfig: Successfully connected to ${url}`);
            break;
          } else {
            console.warn(`CountingConfig: ${url} returned status ${response.status}`);
            last_error = new Error(`HTTP ${response.status}`);
          }
        } catch (error) {
          console.warn(`CountingConfig: Failed to connect to ${url}:`, error);
          last_error = error as Error;
          continue;
        }
      }

      if (!response || !response.ok) {
        throw last_error || new Error('No backend URL worked');
      }

      const result = await response.json();
      console.log('CountingConfig: Health check result:', result);

      if (result.status === 'ok') {
        toast({
          title: 'Conexión exitosa',
          description: 'Se pudo conectar correctamente con el backend de conteo'
        });
      } else {
        throw new Error('Respuesta inválida del backend');
      }
    } catch (error) {
      console.error('CountingConfig: Error testing connection to counting backend:', error);
      toast({
        title: 'Error de conexión',
        description: 'No se pudo conectar con el backend de conteo en ninguna de las URLs probadas.',
        variant: 'destructive'
      });
    } finally {
      set_testing_connection(false);
    }
  }, []);

  /**
   * Maneja el cambio de objetos seleccionados
   */
  const toggle_object = useCallback((object_id: string) => {
    set_config(prev => ({
      ...prev,
      objects: prev.objects.includes(object_id)
        ? prev.objects.filter((o: string) => o !== object_id)
        : [...prev.objects, object_id]
    }));
  }, []);

  /**
   * Carga el estado del servicio desde el backend de conteo
   */
  const load_service_status = useCallback(async () => {
    try {
      console.log('CountingConfig: Loading service status from counting backend...');

      // Intentar múltiples URLs para el backend de conteo
      const backend_urls = [
        'http://localhost:2223/status',
        'http://127.0.0.1:2223/status',
        'http://counting-backend:2223/status'
      ];

      let response: Response | null = null;
      let last_error: Error | null = null;

      for (const url of backend_urls) {
        try {
          console.log(`CountingConfig: Trying to get status from ${url}...`);
          response = await fetch(url, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(5000)
          });

          if (response.ok) {
            console.log(`CountingConfig: Successfully got status from ${url}`);
            break;
          } else {
            console.warn(`CountingConfig: ${url} returned status ${response.status}`);
            last_error = new Error(`HTTP ${response.status}`);
          }
        } catch (error) {
          console.warn(`CountingConfig: Failed to get status from ${url}:`, error);
          last_error = error as Error;
          continue;
        }
      }

      if (!response || !response.ok) {
        throw last_error || new Error('No backend URL worked');
      }

      const data = await response.json();
      console.log('CountingConfig: Status data received:', data);

      // El backend de conteo retorna el estado en data.status.running
      if (data.status) {
        set_service_status(data.status.running ? 'running' : 'stopped');
      } else {
        console.warn('CountingConfig: Status data not found in counting backend response');
        set_service_status('error');
      }
    } catch (error) {
      console.error('CountingConfig: Error loading service status from counting backend:', error);
      set_service_status('error');
    }
  }, []);

  /**
   * Controla el servicio Docker (start/stop/restart)
   */
  const control_service = useCallback(async (action: 'start' | 'stop' | 'restart') => {
    try {
      const response = await fetch(`/api/config/backend/services/conteo/${action}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        toast({
          title: 'Servicio actualizado',
          description: `El servicio de conteo ha sido ${action === 'start' ? 'iniciado' : action === 'stop' ? 'detenido' : 'reiniciado'} correctamente`
        });
        
        // Recargar estado después de un delay
        setTimeout(() => {
          load_service_status();
        }, 2000);
      } else {
        throw new Error(`Error ${response.status}`);
      }
    } catch (error) {
      console.error(`Error ${action} service:`, error);
      toast({
        title: 'Error',
        description: `No se pudo ${action === 'start' ? 'iniciar' : action === 'stop' ? 'detener' : 'reiniciar'} el servicio`,
        variant: 'destructive'
      });
    }
  }, [load_service_status]);

  // Efectos
  useEffect(() => {
    const load_initial_data = async () => {
      set_loading(true);
      await Promise.all([
        load_config(),
        load_cameras(),
        load_service_status()
      ]);
      set_loading(false);
    };

    load_initial_data();
  }, [load_config, load_cameras, load_service_status]);

  // Mostrar carga inicial
  if (loading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Cargando configuración...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Gestión de sistemas de conteo */}
      <Card>
        <CardHeader>
          <CardTitle>Paneles de Conteo</CardTitle>
          <CardDescription>Administre múltiples sistemas y agrúpelos según necesidad</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {systems.map((sys, idx) => (
              <Button
                key={idx}
                variant={selected_system === idx ? 'default' : 'outline'}
                onClick={() => set_selected_system(idx)}
              >
                {sys.title || `Sistema ${idx + 1}`}
              </Button>
            ))}
            <Button variant="secondary" onClick={() => {
              set_systems(prev => [...prev, {
                enabled: true,
                operation_mode: 'zones',
                title: `Sistema ${prev.length + 1}`,
                objects: [],
                retention_days: 30,
                confidence_threshold: 0.7,
                notifications_enabled: false,
                config_json: '{}'
              }]);
              set_selected_system(systems.length);
            }}>
              <Plus className="h-4 w-4 mr-1" /> Nuevo sistema
            </Button>
            {systems.length > 1 && (
              <Button variant="destructive" onClick={() => {
                set_systems(prev => prev.filter((_, idx) => idx !== selected_system));
                set_selected_system(0);
              }}>
                <Trash2 className="h-4 w-4 mr-1" /> Eliminar sistema
              </Button>
            )}
          </div>
          <div className="text-xs text-muted-foreground">Seleccione, cree o elimine sistemas de conteo. Cada uno puede tener configuración independiente.</div>
        </CardContent>
      </Card>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {embedded ? 'Configuración de Conteo (Backend)' : 'Configuración de Conteo'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {embedded ? 'Integrado en Ajustes > Servicios Backend' : 'Configure el sistema de conteo automático de objetos'}
          </p>
        </div>
        {!embedded && (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <div className={`h-2 w-2 rounded-full ${
              service_status === 'running' ? 'bg-green-500' : 
              service_status === 'stopped' ? 'bg-red-500' : 
              service_status === 'error' ? 'bg-yellow-500' : 'bg-gray-400'
            }`} />
            <span className="text-sm text-muted-foreground">
              Servicio: {service_status === 'running' ? 'Activo' : 
                        service_status === 'stopped' ? 'Detenido' :
                        service_status === 'error' ? 'Error' : 'Desconocido'}
            </span>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={test_connection}
            disabled={testing_connection}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${testing_connection ? 'animate-spin' : ''}`} />
            Probar Conexión
          </Button>
          
          <Button
            onClick={save_config}
            disabled={saving}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
        )}
      </div>

      {/* Estado del módulo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Estado del Módulo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label htmlFor="module-enabled">Módulo de Conteo Habilitado</Label>
              <p className="text-sm text-muted-foreground">
                Habilitar o deshabilitar todo el sistema de conteo
              </p>
            </div>
            <Switch
              id="module-enabled"
              checked={config.enabled}
              onCheckedChange={(checked) => set_config(prev => ({ ...prev, enabled: checked }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Configuración en pestañas */}
      <Tabs value={active_tab} onValueChange={set_active_tab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="mode">Modo</TabsTrigger>
          <TabsTrigger value="objects">Objetos</TabsTrigger>
          {!embedded && <TabsTrigger value="service">Servicio</TabsTrigger>}
          <TabsTrigger value="advanced">Avanzado</TabsTrigger>
        </TabsList>

        {/* Pestaña General */}
        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración General</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título del Módulo</Label>
                <Input
                  id="title"
                  value={config.title}
                  onChange={(e) => set_config(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Sistema de Conteo"
                  title="Título del módulo de conteo"
                  aria-label="Título del módulo de conteo"
                />
                {form_errors.title && (
                  <p className="text-sm text-red-500">{form_errors.title}</p>
                )}
              </div>
              {/* Listado de cámaras por servidor */}
              <div className="space-y-2">
                <Label>Servidores y Cámaras Configuradas</Label>
                {frigate_servers.length === 0 ? (
                  <p className="text-muted-foreground">No hay servidores Frigate configurados.</p>
                ) : (
                  <ul className="space-y-2">
                    {frigate_servers.map(server => (
                      <li key={server.id}>
                        <div className="font-bold mb-1">{server.name}</div>
                        <ul className="ml-4 space-y-1">
                          {available_cameras.filter(cam => cam.server_id === server.id).map(cam => (
                            <li key={cam.name} className="flex items-center gap-2">
                              <Camera className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{cam.name}</span>
                              {cam.display_name && <span className="text-xs text-muted-foreground">({cam.display_name})</span>}
                              {cam.zones && cam.zones.length > 0 && (
                                <span className="text-xs text-muted-foreground">Zonas: {cam.zones.join(', ')}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="retention">Retención de Datos (días)</Label>
                <Input
                  id="retention"
                  type="number"
                  min="1"
                  max="365"
                  value={config.retention_days}
                  onChange={(e) => set_config(prev => ({ 
                    ...prev, 
                    retention_days: parseInt(e.target.value) || 30 
                  }))}
                  placeholder="Días de retención"
                  title="Retención de datos en días"
                  aria-label="Retención de datos en días"
                />
                {form_errors.retention_days && (
                  <p className="text-sm text-red-500">{form_errors.retention_days}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  Los eventos más antiguos se eliminarán automáticamente
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña Modo de Operación */}
        <TabsContent value="mode" className="space-y-4">
          {/*
            Bloque de selección de modo de operación
            Permite alternar entre dos modos:
            - 'two_cameras': Dos cámaras, una para IN y otra para OUT
            - 'zones': Una cámara con zonas IN/OUT
          */}
          <Card>
            <CardHeader>
              <CardTitle>Modo de Operación</CardTitle>
              <CardDescription>
                Configure cómo el sistema detectará entradas y salidas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Seleccionar Modo</Label>
                <div className="grid gap-4">
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      config.operation_mode === 'two_cameras' ? 'border-primary bg-primary/5' : 'border-muted'
                    }`}
                    onClick={() => set_config(prev => ({ ...prev, operation_mode: 'two_cameras' }))}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        checked={config.operation_mode === 'two_cameras'}
                        onChange={() => set_config(prev => ({ ...prev, operation_mode: 'two_cameras' }))}
                        className="h-4 w-4"
                      />
                      <div>
                        <h4 className="font-medium">OPCIÓN 1: Dos Cámaras</h4>
                        <p className="text-sm text-muted-foreground">
                          Una cámara para detectar entradas (IN) y otra para detectar salidas (OUT)
                        </p>
                      </div>
                    </div>
                  </div>
                  <div 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      config.operation_mode === 'zones' ? 'border-primary bg-primary/5' : 'border-muted'
                    }`}
                    onClick={() => set_config(prev => ({ ...prev, operation_mode: 'zones' }))}
                  >
                    <div className="flex items-center space-x-3">
                      <input
                        type="radio"
                        checked={config.operation_mode === 'zones'}
                        onChange={() => set_config(prev => ({ ...prev, operation_mode: 'zones' }))}
                        className="h-4 w-4"
                      />
                      <div>
                        <h4 className="font-medium">OPCIÓN 2: Una Cámara con Zonas</h4>
                        <p className="text-sm text-muted-foreground">
                          Una cámara con zonas IN y OUT predefinidas en Frigate
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {config.operation_mode === 'two_cameras' ? (
                <div className="space-y-4">
                  <h4 className="font-medium">Configuración de Dos Cámaras</h4>
                  {/* Árbol de servidores y cámaras */}
                  <div className="border rounded-lg p-4 mb-4">
                    <h5 className="font-semibold mb-2">Servidores y Cámaras Disponibles</h5>
                    {frigate_servers.length === 0 ? (
                      <p className="text-muted-foreground">No hay servidores Frigate configurados.</p>
                    ) : (
                      <ul className="space-y-2">
                        {frigate_servers.map(server => (
                          <li key={server.id}>
                            <div className="font-bold mb-1">{server.name}</div>
                            <ul className="ml-4 space-y-1">
                              {available_cameras.filter(cam => cam.server_id === server.id).map(cam => (
                                <li key={cam.name} className="flex items-center gap-2">
                                  <Camera className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{cam.name}</span>
                                  <Input
                                    type="text"
                                    value={cam.display_name || cam.name}
                                    onChange={e => {
                                      set_available_cameras(prev => prev.map(c => c.name === cam.name ? { ...c, display_name: e.target.value } : c));
                                    }}
                                    className="w-32 text-xs"
                                    placeholder="Nombre mostrado"
                                  />
                                  {cam.zones && cam.zones.length > 0 && (
                                    <span className="text-xs text-muted-foreground">Zonas: {cam.zones.join(', ')}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="camera-in">Cámara de Entrada (IN)</Label>
                      <Select
                        value={config.camera_in || ''}
                        onValueChange={(value) => set_config(prev => ({ ...prev, camera_in: value }))}
                      >
                        <SelectTrigger title="Seleccionar cámara de entrada" aria-label="Seleccionar cámara de entrada">
                          <SelectValue placeholder="Seleccionar cámara de entrada" />
                        </SelectTrigger>
                        <SelectContent>
                          {available_cameras.map((camera) => (
                            <SelectItem key={`in-${camera.server_id}-${camera.name}`} value={camera.name}>
                              {camera.server_name} - {camera.display_name || camera.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form_errors.camera_in && (
                        <p className="text-sm text-red-500">{form_errors.camera_in}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="camera-out">Cámara de Salida (OUT)</Label>
                      <Select
                        value={config.camera_out || ''}
                        onValueChange={(value) => set_config(prev => ({ ...prev, camera_out: value }))}
                      >
                        <SelectTrigger title="Seleccionar cámara de salida" aria-label="Seleccionar cámara de salida">
                          <SelectValue placeholder="Seleccionar cámara de salida" />
                        </SelectTrigger>
                        <SelectContent>
                          {available_cameras.map((camera) => (
                            <SelectItem key={`out-${camera.server_id}-${camera.name}`} value={camera.name}>
                              {camera.server_name} - {camera.display_name || camera.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form_errors.camera_out && (
                        <p className="text-sm text-red-500">{form_errors.camera_out}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="font-medium">Configuración de Zonas</h4>
                  
                  <div className="space-y-2">
                    <Label htmlFor="camera-zones">Cámara con Zonas</Label>
                    <Select
                      value={config.camera_zones || ''}
                      onValueChange={(value) => set_config(prev => ({ ...prev, camera_zones: value }))}
                    >
                      <SelectTrigger title="Seleccionar cámara" aria-label="Seleccionar cámara">
                        <SelectValue placeholder="Seleccionar cámara" />
                      </SelectTrigger>
                      <SelectContent>
                        {available_cameras.filter(cam => cam.zones && cam.zones.length > 0).map((camera) => (
                          <SelectItem key={`zone-${camera.server_id}-${camera.name}`} value={camera.name}>
                            {camera.server_name} - {camera.display_name || camera.name} ({camera.zones?.length || 0} zonas)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {form_errors.camera_zones && (
                      <p className="text-sm text-red-500">{form_errors.camera_zones}</p>
                    )}
                  </div>

                  {config.camera_zones && (
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="zone-in">Zona de Entrada (IN)</Label>
                        <Select
                          value={config.zone_in || ''}
                          onValueChange={(value) => set_config(prev => ({ ...prev, zone_in: value }))}
                        >
                          <SelectTrigger title="Seleccionar zona IN" aria-label="Seleccionar zona IN">
                            <SelectValue placeholder="Seleccionar zona IN" />
                          </SelectTrigger>
                          <SelectContent>
                            {(available_cameras.find(cam => cam.name === config.camera_zones)?.zones || []).map((zone) => (
                              <SelectItem key={`in-${zone}`} value={zone}>
                                {zone}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form_errors.zone_in && (
                          <p className="text-sm text-red-500">{form_errors.zone_in}</p>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="zone-out">Zona de Salida (OUT)</Label>
                        <Select
                          value={config.zone_out || ''}
                          onValueChange={(value) => set_config(prev => ({ ...prev, zone_out: value }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar zona OUT" />
                          </SelectTrigger>
                          <SelectContent>
                            {(available_cameras.find(cam => cam.name === config.camera_zones)?.zones || []).map((zone) => (
                              <SelectItem key={`out-${zone}`} value={zone}>
                                {zone}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {form_errors.zone_out && (
                          <p className="text-sm text-red-500">{form_errors.zone_out}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pestaña Objetos */}
        <TabsContent value="objects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Objetos a Contar</CardTitle>
              <CardDescription>
                Seleccione los tipos de objetos que desea detectar y contar
              </CardDescription>
            </CardHeader>
            <CardContent>
              {form_errors.objects && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{form_errors.objects}</AlertDescription>
                </Alert>
              )}
              
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {available_objects.map((object) => (
                  <div 
                    key={object.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      config.objects.includes(object.id) ? 'border-primary bg-primary/5' : 'border-muted hover:border-muted-foreground'
                    }`}
                    onClick={() => toggle_object(object.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">{object.icon}</div>
                        <div>
                          <p className="font-medium">{object.label_es}</p>
                          <p className="text-sm text-muted-foreground">
                            {object.label_en}
                          </p>
                        </div>
                      </div>
                      
                      <Switch
                        checked={config.objects.includes(object.id)}
                        onCheckedChange={() => toggle_object(object.id)}
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              <Separator />
              
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Objetos seleccionados: {config.objects.length} de {available_objects.length}
                  </span>
                  {config.objects.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {config.objects.map(obj_id => {
                        const obj = available_objects.find(o => o.id === obj_id);
                        return obj ? (
                          <Badge key={obj_id} variant="secondary" className="text-xs">
                            {obj.icon} {obj.label_es}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confidence">Umbral de Confianza</Label>
                  <div className="flex items-center space-x-4">
                    <Input
                      id="confidence"
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.1"
                      value={config.confidence_threshold}
                      onChange={(e) => set_config(prev => ({ 
                        ...prev, 
                        confidence_threshold: parseFloat(e.target.value) || 0.7 
                      }))}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-12">
                      {(config.confidence_threshold * 100).toFixed(0)}%
                    </span>
                  </div>
                  {form_errors.confidence_threshold && (
                    <p className="text-sm text-red-500">{form_errors.confidence_threshold}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Solo contar detecciones con confianza superior a este valor
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

  {/* Pestaña Control de Servicio */}
  {!embedded && (
  <TabsContent value="service" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Control del Servicio Docker
              </CardTitle>
              <CardDescription>
                Gestionar el servicio backend de conteo de objetos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium">Estado del Servicio</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`h-3 w-3 rounded-full ${
                      service_status === 'running' ? 'bg-green-500' : 
                      service_status === 'stopped' ? 'bg-red-500' : 
                      service_status === 'error' ? 'bg-yellow-500' : 'bg-gray-400'
                    }`} />
                    <span className="text-sm text-muted-foreground">
                      {service_status === 'running' ? 'Servicio activo y funcionando' : 
                       service_status === 'stopped' ? 'Servicio detenido' :
                       service_status === 'error' ? 'Error en el servicio' : 'Estado desconocido'}
                    </span>
                  </div>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={load_service_status}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Actualizar
                </Button>
              </div>
              
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant={service_status === 'running' ? 'secondary' : 'default'}
                  onClick={() => control_service('start')}
                  disabled={service_status === 'running'}
                  className="w-full"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Iniciar
                </Button>
                
                <Button
                  variant={service_status === 'stopped' ? 'secondary' : 'destructive'}
                  onClick={() => control_service('stop')}
                  disabled={service_status === 'stopped'}
                  className="w-full"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Detener
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => control_service('restart')}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reiniciar
                </Button>
              </div>
              
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  El servicio Docker debe estar ejecutándose para procesar eventos de conteo en tiempo real.
                  Los cambios de configuración requieren reiniciar el servicio para tomar efecto.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Información del Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground">Servidores Frigate:</p>
                  <p className="font-medium">{frigate_servers.length} configurados</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Cámaras disponibles:</p>
                  <p className="font-medium">{available_cameras.filter(c => c.enabled).length} activas</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Objetos configurados:</p>
                  <p className="font-medium">{config.objects.length} tipos</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Retención:</p>
                  <p className="font-medium">{config.retention_days} días</p>
                </div>
              </div>
            </CardContent>
          </Card>
  </TabsContent>
  )}

        {/* Pestaña Avanzado */}
        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notificaciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="notifications-enabled">Notificaciones Habilitadas</Label>
                  <p className="text-sm text-muted-foreground">
                    Recibir notificaciones por email sobre eventos importantes
                  </p>
                </div>
                <Switch
                  id="notifications-enabled"
                  checked={config.notifications_enabled}
                  onCheckedChange={(checked) => set_config(prev => ({ 
                    ...prev, 
                    notifications_enabled: checked 
                  }))}
                />
              </div>
              
              {config.notifications_enabled && (
                <div className="space-y-2">
                  <Label htmlFor="notification-email">Email de Notificaciones</Label>
                  <Input
                    id="notification-email"
                    type="email"
                    value={config.notification_email || ''}
                    onChange={(e) => set_config(prev => ({ 
                      ...prev, 
                      notification_email: e.target.value 
                    }))}
                    placeholder="admin@empresa.com"
                  />
                  {form_errors.notification_email && (
                    <p className="text-sm text-red-500">{form_errors.notification_email}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Configuración Avanzada (JSON)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="config-json">Configuración JSON</Label>
                <Textarea
                  id="config-json"
                  value={config_json_text}
                  onChange={(e) => set_config_json_text(e.target.value)}
                  placeholder='{"key": "value"}'
                  rows={8}
                  className="font-mono text-sm"
                />
                {form_errors.config_json && (
                  <p className="text-sm text-red-500">{form_errors.config_json}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  Configuración adicional en formato JSON para parámetros avanzados
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}