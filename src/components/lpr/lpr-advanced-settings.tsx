/**
 * Componente de configuración avanzada del sistema LPR
 * 
 * Permite configurar todos los parámetros del sistema:
 * - Servidor MQTT (host, puerto, credenciales, tópicos)
 * - Servidor Frigate (conexión y autenticación) 
 * - Selección de cámaras para LPR
 * - Configuración de base de datos y retención
 * - Parámetros de procesamiento
 * - Gestión de contenedor Docker
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Settings, 
  Server, 
  Camera, 
  MessageSquare, 
  Database, 
  Shield,
  Save,
  TestTube,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FolderOpen,
  Calendar,
  HardDrive
} from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { DockerServiceManager } from './docker-service-manager';
import { FRIGATE_SERVERS, type FrigateServer } from '@/lib/frigate-servers';

// Tipos para la configuración
interface mqtt_config {
  host: string;
  port: number;
  username?: string;
  password?: string;
  topic_prefix: string;
  use_ssl: boolean;
  keepalive: number;
  client_id?: string;
}

interface frigate_config {
  server_id?: string; // ID del servidor de la lista predefinida
  host: string;
  port: number;
  use_ssl: boolean;
  username?: string;
  password?: string;
  api_key?: string;
}

interface database_config {
  type: 'sqlite' | 'postgresql';
  path: string;
  auto_backup: boolean;
  backup_retention_days: number;
}

interface retention_config {
  events_retention_days: number;
  clips_retention_days: number;
  snapshots_retention_days: number;
  auto_cleanup: boolean;
  max_storage_gb: number;
}

interface camera_config {
  name: string;
  enabled_for_lpr: boolean;
  confidence_threshold: number;
  zones?: string[];
  processing_fps: number;
}

interface lpr_system_config {
  mqtt: mqtt_config;
  frigate: frigate_config;
  database: database_config;
  retention: retention_config;
  cameras: Record<string, camera_config>;
  max_events_per_camera: number;
  enable_false_positive_detection: boolean;
  enable_speed_calculation: boolean;
  enable_traffic_light_detection: boolean;
  debug_mode: boolean;
}

interface lpr_advanced_settings_props {
  is_open: boolean;
  on_close: () => void;
  auth_header: Record<string, string>;
}

/**
 * Hook para gestionar la configuración del sistema LPR
 */
const use_lpr_config = (auth_header: Record<string, string>) => {
  const [config, set_config] = useState<lpr_system_config | null>(null);
  const [loading, set_loading] = useState(false);
  const [saving, set_saving] = useState(false);
  
  const load_config = useCallback(async () => {
    set_loading(true);
    try {
      const response = await fetch('http://localhost:2221/api/preferences', {
        headers: auth_header
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Migrar configuración antigua a nueva estructura si es necesario
        const migrated_config: lpr_system_config = {
          mqtt: data.mqtt || {
            host: 'localhost',
            port: 1883,
            topic_prefix: 'frigate',
            use_ssl: false,
            keepalive: 60
          },
          frigate: data.frigate || {
            host: 'localhost',
            port: 5000,
            use_ssl: false
          },
          database: data.database || {
            type: 'sqlite',
            path: './DB/matriculas.db',
            auto_backup: true,
            backup_retention_days: 7
          },
          retention: data.retention || {
            events_retention_days: data.retention_days || 30,
            clips_retention_days: 7,
            snapshots_retention_days: 14,
            auto_cleanup: true,
            max_storage_gb: 50
          },
          cameras: data.cameras || {},
          max_events_per_camera: data.max_events_per_camera || 1000,
          enable_false_positive_detection: data.enable_false_positive_detection || false,
          enable_speed_calculation: data.enable_speed_calculation || false,
          enable_traffic_light_detection: data.enable_traffic_light_detection || false,
          debug_mode: data.debug_mode || false
        };
        
        set_config(migrated_config);
      } else {
        throw new Error('Error al cargar configuración');
      }
    } catch (error) {
      console.error('Error loading config:', error);
      
      // Crear configuración por defecto
      const default_config: lpr_system_config = {
        mqtt: {
          host: 'localhost',
          port: 1883,
          topic_prefix: 'frigate',
          use_ssl: false,
          keepalive: 60
        },
        frigate: {
          host: 'localhost',
          port: 5000,
          use_ssl: false
        },
        database: {
          type: 'sqlite',
          path: './DB/matriculas.db',
          auto_backup: true,
          backup_retention_days: 7
        },
        retention: {
          events_retention_days: 30,
          clips_retention_days: 7,
          snapshots_retention_days: 14,
          auto_cleanup: true,
          max_storage_gb: 50
        },
        cameras: {},
        max_events_per_camera: 1000,
        enable_false_positive_detection: false,
        enable_speed_calculation: false,
        enable_traffic_light_detection: false,
        debug_mode: false
      };
      
      set_config(default_config);
      
      toast({
        title: 'Información',
        description: 'Usando configuración por defecto. Guarda los cambios para crear el archivo de configuración.',
        variant: 'default'
      });
    } finally {
      set_loading(false);
    }
  }, [auth_header]);
  
  const save_config = useCallback(async (new_config: lpr_system_config) => {
    set_saving(true);
    try {
      const response = await fetch('http://localhost:2221/api/preferences', {
        method: 'POST',
        headers: auth_header,
        body: JSON.stringify(new_config)
      });
      
      if (response.ok) {
        set_config(new_config);
        toast({
          title: 'Configuración guardada',
          description: 'Los cambios se aplicarán tras reiniciar el sistema'
        });
        return true;
      } else {
        throw new Error('Error al guardar configuración');
      }
    } catch (error) {
      console.error('Error saving config:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración',
        variant: 'destructive'
      });
      return false;
    } finally {
      set_saving(false);
    }
  }, [auth_header]);
  
  return { config, set_config, loading, saving, load_config, save_config };
};

/**
 * Hook para obtener cámaras disponibles de Frigate
 */
const use_frigate_cameras = (frigate_config: frigate_config, auth_header: Record<string, string>) => {
  const [cameras, set_cameras] = useState<string[]>([]);
  const [loading, set_loading] = useState(false);
  
  const load_cameras = useCallback(async () => {
    if (!frigate_config.host) return;
    
    set_loading(true);
    try {
      const protocol = frigate_config.use_ssl ? 'https' : 'http';
      const url = `${protocol}://${frigate_config.host}:${frigate_config.port}/api/config`;
      
      // Proxy a través de nuestra API para evitar CORS
      const response = await fetch('http://localhost:2221/api/frigate/cameras', {
        headers: auth_header
      });
      
      if (response.ok) {
        const data = await response.json();
        set_cameras(data.cameras || []);
      }
    } catch (error) {
      console.error('Error loading cameras:', error);
    } finally {
      set_loading(false);
    }
  }, [frigate_config, auth_header]);
  
  return { cameras, loading, load_cameras };
};

/**
 * Componente para configuración MQTT
 */
const MqttConfigSection: React.FC<{
  config: mqtt_config;
  on_change: (config: mqtt_config) => void;
  on_test: () => void;
  testing: boolean;
}> = ({ config, on_change, on_test, testing }) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="mqtt-host">Servidor MQTT</Label>
          <Input
            id="mqtt-host"
            value={config.host}
            onChange={(e) => on_change({ ...config, host: e.target.value })}
            placeholder="localhost"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mqtt-port">Puerto</Label>
          <Input
            id="mqtt-port"
            type="number"
            value={config.port}
            onChange={(e) => on_change({ ...config, port: parseInt(e.target.value) || 1883 })}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="mqtt-username">Usuario (opcional)</Label>
          <Input
            id="mqtt-username"
            value={config.username || ''}
            onChange={(e) => on_change({ ...config, username: e.target.value || undefined })}
            placeholder="usuario_mqtt"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mqtt-password">Contraseña (opcional)</Label>
          <Input
            id="mqtt-password"
            type="password"
            value={config.password || ''}
            onChange={(e) => on_change({ ...config, password: e.target.value || undefined })}
            placeholder="contraseña"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="mqtt-topic">Prefijo de tópicos</Label>
          <Input
            id="mqtt-topic"
            value={config.topic_prefix}
            onChange={(e) => on_change({ ...config, topic_prefix: e.target.value })}
            placeholder="frigate"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mqtt-keepalive">Keep Alive (seg)</Label>
          <Input
            id="mqtt-keepalive"
            type="number"
            value={config.keepalive}
            onChange={(e) => on_change({ ...config, keepalive: parseInt(e.target.value) || 60 })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mqtt-client-id">Client ID (opcional)</Label>
          <Input
            id="mqtt-client-id"
            value={config.client_id || ''}
            onChange={(e) => on_change({ ...config, client_id: e.target.value || undefined })}
            placeholder="lpr-client"
          />
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Switch
          id="mqtt-ssl"
          checked={config.use_ssl}
          onCheckedChange={(checked) => on_change({ ...config, use_ssl: checked })}
        />
        <Label htmlFor="mqtt-ssl">Usar SSL/TLS</Label>
      </div>
      
      <Button 
        onClick={on_test} 
        disabled={testing}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
        Probar Conexión MQTT
      </Button>
    </div>
  );
};

/**
 * Componente para configuración de Frigate
 */
const FrigateConfigSection: React.FC<{
  config: frigate_config;
  on_change: (config: frigate_config) => void;
  on_test: () => void;
  testing: boolean;
}> = ({ config, on_change, on_test, testing }) => {
  
  const handle_server_select = (server_id: string) => {
    if (server_id === 'custom') {
      on_change({ 
        ...config, 
        server_id: undefined,
        host: '',
        port: 5000,
        use_ssl: false
      });
    } else {
      const selected_server = FRIGATE_SERVERS.find(s => s.id === server_id);
      if (selected_server) {
        const url = new URL(selected_server.baseUrl);
        on_change({
          ...config,
          server_id: server_id,
          host: url.hostname,
          port: parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80),
          use_ssl: url.protocol === 'https:',
          username: selected_server.auth?.username,
          password: selected_server.auth?.password
        });
      }
    }
  };
  
  const selected_server = config.server_id ? FRIGATE_SERVERS.find(s => s.id === config.server_id) : null;
  
  return (
    <div className="space-y-4">
      {/* Selector de servidor predefinido */}
      <div className="space-y-2">
        <Label>Servidor Frigate</Label>
        <Select 
          value={config.server_id || 'custom'} 
          onValueChange={handle_server_select}
        >
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar servidor" />
          </SelectTrigger>
          <SelectContent>
            {FRIGATE_SERVERS.map(server => (
              <SelectItem key={server.id} value={server.id}>
                <div className="flex items-center gap-2">
                  <Badge variant={server.enabled ? "default" : "secondary"} className="w-2 h-2 p-0" />
                  {server.name} ({server.baseUrl})
                </div>
              </SelectItem>
            ))}
            <SelectItem value="custom">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuración Personalizada
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mostrar información del servidor seleccionado */}
      {selected_server && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Servidor seleccionado:</strong> {selected_server.name}<br />
            <strong>URL:</strong> {selected_server.baseUrl}<br />
            <strong>Estado:</strong> {selected_server.enabled ? 'Activo' : 'Inactivo'}
          </AlertDescription>
        </Alert>
      )}
      
      {/* Configuración manual (solo si es custom o para override) */}
      {(!config.server_id || config.server_id === 'custom') && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="frigate-host">Host</Label>
              <Input
                id="frigate-host"
                value={config.host}
                onChange={(e) => on_change({ ...config, host: e.target.value })}
                placeholder="localhost"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="frigate-port">Puerto</Label>
              <Input
                id="frigate-port"
                type="number"
                value={config.port}
                onChange={(e) => on_change({ ...config, port: parseInt(e.target.value) || 5000 })}
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="frigate-ssl"
              checked={config.use_ssl}
              onCheckedChange={(checked) => on_change({ ...config, use_ssl: checked })}
            />
            <Label htmlFor="frigate-ssl">Usar HTTPS</Label>
          </div>
        </>
      )}
      
      {/* Autenticación (siempre disponible) */}
      <Separator />
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Autenticación (opcional)</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="frigate-username">Usuario</Label>
            <Input
              id="frigate-username"
              value={config.username || ''}
              onChange={(e) => on_change({ ...config, username: e.target.value || undefined })}
              placeholder="admin"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="frigate-password">Contraseña</Label>
            <Input
              id="frigate-password"
              type="password"
              value={config.password || ''}
              onChange={(e) => on_change({ ...config, password: e.target.value || undefined })}
              placeholder="contraseña"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="frigate-api-key">API Key (alternativo)</Label>
          <Input
            id="frigate-api-key"
            value={config.api_key || ''}
            onChange={(e) => on_change({ ...config, api_key: e.target.value || undefined })}
            placeholder="your-api-key"
          />
        </div>
      </div>
      
      <Button 
        onClick={on_test} 
        disabled={testing}
        variant="outline"
        size="sm"
        className="flex items-center gap-2"
      >
        {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
        Probar Conexión Frigate
      </Button>
    </div>
  );
};

/**
 * Componente para configuración de cámaras LPR
 */
const CamerasConfigSection: React.FC<{
  cameras: Record<string, camera_config>;
  available_cameras: string[];
  on_change: (cameras: Record<string, camera_config>) => void;
  on_refresh_cameras: () => void;
  loading_cameras: boolean;
}> = ({ cameras, available_cameras, on_change, on_refresh_cameras, loading_cameras }) => {
  
  const update_camera_config = (camera_name: string, updates: Partial<camera_config>) => {
    const current_config = cameras[camera_name] || {
      name: camera_name,
      enabled_for_lpr: false,
      confidence_threshold: 0.7,
      processing_fps: 2
    };
    
    on_change({
      ...cameras,
      [camera_name]: { ...current_config, ...updates }
    });
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Cámaras Disponibles</h4>
        <Button
          onClick={on_refresh_cameras}
          disabled={loading_cameras}
          variant="outline"
          size="sm"
        >
          {loading_cameras ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </Button>
      </div>
      
      {available_cameras.length === 0 ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No se encontraron cámaras. Verifica la conexión con Frigate.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-4">
          {available_cameras.map(camera_name => {
            const camera_config = cameras[camera_name] || {
              name: camera_name,
              enabled_for_lpr: false,
              confidence_threshold: 0.7,
              processing_fps: 2
            };
            
            return (
              <Card key={camera_name}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">{camera_name}</CardTitle>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={camera_config.enabled_for_lpr}
                        onCheckedChange={(checked) => 
                          update_camera_config(camera_name, { enabled_for_lpr: checked })
                        }
                      />
                      <Label className="text-sm">Habilitar LPR</Label>
                    </div>
                  </div>
                </CardHeader>
                
                {camera_config.enabled_for_lpr && (
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Confianza mínima</Label>
                        <Input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={camera_config.confidence_threshold}
                          onChange={(e) => 
                            update_camera_config(camera_name, { 
                              confidence_threshold: parseFloat(e.target.value) || 0.7 
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">FPS de procesamiento</Label>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          value={camera_config.processing_fps}
                          onChange={(e) => 
                            update_camera_config(camera_name, { 
                              processing_fps: parseInt(e.target.value) || 2 
                            })
                          }
                        />
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

/**
 * Componente para configuración de base de datos
 */
const DatabaseConfigSection: React.FC<{
  config: database_config;
  on_change: (config: database_config) => void;
}> = ({ config, on_change }) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Base de Datos</Label>
          <Select 
            value={config.type} 
            onValueChange={(value: 'sqlite' | 'postgresql') => on_change({ ...config, type: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sqlite">SQLite (Recomendado)</SelectItem>
              <SelectItem value="postgresql">PostgreSQL</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="db-path">
            {config.type === 'sqlite' ? 'Ruta del archivo' : 'Cadena de conexión'}
          </Label>
          <div className="flex gap-2">
            <Input
              id="db-path"
              value={config.path}
              onChange={(e) => on_change({ ...config, path: e.target.value })}
              placeholder={config.type === 'sqlite' ? './DB/matriculas.db' : 'postgresql://user:pass@host:5432/lpr'}
            />
            {config.type === 'sqlite' && (
              <Button variant="outline" size="sm">
                <FolderOpen className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Configuración de Respaldo</h4>
        
        <div className="flex items-center justify-between">
          <div>
            <Label>Respaldo automático</Label>
            <p className="text-sm text-muted-foreground">
              Crear respaldos automáticos de la base de datos
            </p>
          </div>
          <Switch
            checked={config.auto_backup}
            onCheckedChange={(checked) => on_change({ ...config, auto_backup: checked })}
          />
        </div>
        
        {config.auto_backup && (
          <div className="space-y-2">
            <Label htmlFor="backup-retention">Días de retención de respaldos</Label>
            <Input
              id="backup-retention"
              type="number"
              min="1"
              max="365"
              value={config.backup_retention_days}
              onChange={(e) => on_change({ 
                ...config, 
                backup_retention_days: parseInt(e.target.value) || 7 
              })}
            />
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Componente para configuración de retención de datos
 */
const RetentionConfigSection: React.FC<{
  config: retention_config;
  on_change: (config: retention_config) => void;
}> = ({ config, on_change }) => {
  const [estimated_size, set_estimated_size] = useState<string>('Calculando...');
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="events-retention">Retención de eventos (días)</Label>
          <Input
            id="events-retention"
            type="number"
            min="1"
            max="365"
            value={config.events_retention_days}
            onChange={(e) => on_change({ 
              ...config, 
              events_retention_days: parseInt(e.target.value) || 30 
            })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="clips-retention">Retención de clips (días)</Label>
          <Input
            id="clips-retention"
            type="number"
            min="1"
            max="365"
            value={config.clips_retention_days}
            onChange={(e) => on_change({ 
              ...config, 
              clips_retention_days: parseInt(e.target.value) || 7 
            })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="snapshots-retention">Retención de snapshots (días)</Label>
          <Input
            id="snapshots-retention"
            type="number"
            min="1"
            max="365"
            value={config.snapshots_retention_days}
            onChange={(e) => on_change({ 
              ...config, 
              snapshots_retention_days: parseInt(e.target.value) || 14 
            })}
          />
        </div>
      </div>
      
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Gestión de Almacenamiento</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="max-storage">Límite de almacenamiento (GB)</Label>
            <Input
              id="max-storage"
              type="number"
              min="1"
              max="1000"
              value={config.max_storage_gb}
              onChange={(e) => on_change({ 
                ...config, 
                max_storage_gb: parseInt(e.target.value) || 50 
              })}
            />
          </div>
          <div className="space-y-2">
            <Label>Limpieza automática</Label>
            <div className="flex items-center space-x-2">
              <Switch
                checked={config.auto_cleanup}
                onCheckedChange={(checked) => on_change({ ...config, auto_cleanup: checked })}
              />
              <span className="text-sm text-muted-foreground">
                Eliminar automáticamente datos antiguos
              </span>
            </div>
          </div>
        </div>
        
        <Alert>
          <HardDrive className="h-4 w-4" />
          <AlertDescription>
            <strong>Uso estimado de almacenamiento:</strong> {estimated_size}<br />
            Los clips de video ocupan más espacio que las imágenes. Ajusta la retención según el almacenamiento disponible.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};

/**
 * Componente principal de configuración avanzada
 */
export function LPRAdvancedSettings({ is_open, on_close, auth_header }: lpr_advanced_settings_props) {
  const { config, set_config, loading, saving, load_config, save_config } = use_lpr_config(auth_header);
  const { cameras: available_cameras, loading: loading_cameras, load_cameras } = use_frigate_cameras(
    config?.frigate || { host: '', port: 5000, use_ssl: false }, 
    auth_header
  );
  
  const [testing_mqtt, set_testing_mqtt] = useState(false);
  const [testing_frigate, set_testing_frigate] = useState(false);
  
  // Cargar configuración al abrir el modal
  useEffect(() => {
    if (is_open) {
      load_config();
    }
  }, [is_open, load_config]);
  
  // Cargar cámaras cuando cambie la configuración de Frigate
  useEffect(() => {
    if (config?.frigate.host) {
      load_cameras();
    }
  }, [config?.frigate, load_cameras]);
  
  /**
   * Prueba la conexión MQTT
   */
  const test_mqtt_connection = async () => {
    if (!config) return;
    
    set_testing_mqtt(true);
    try {
      const response = await fetch('http://localhost:2221/api/test/mqtt', {
        method: 'POST',
        headers: auth_header,
        body: JSON.stringify(config.mqtt)
      });
      
      if (response.ok) {
        toast({
          title: 'MQTT OK',
          description: 'Conexión MQTT exitosa'
        });
      } else {
        throw new Error('Error de conexión');
      }
    } catch (error) {
      toast({
        title: 'Error MQTT',
        description: 'No se pudo conectar al servidor MQTT',
        variant: 'destructive'
      });
    } finally {
      set_testing_mqtt(false);
    }
  };
  
  /**
   * Prueba la conexión con Frigate
   */
  const test_frigate_connection = async () => {
    if (!config) return;
    
    set_testing_frigate(true);
    try {
      const response = await fetch('http://localhost:2221/api/test/frigate', {
        method: 'POST',
        headers: auth_header,
        body: JSON.stringify(config.frigate)
      });
      
      if (response.ok) {
        toast({
          title: 'Frigate OK',
          description: 'Conexión con Frigate exitosa'
        });
      } else {
        throw new Error('Error de conexión');
      }
    } catch (error) {
      toast({
        title: 'Error Frigate',
        description: 'No se pudo conectar al servidor Frigate',
        variant: 'destructive'
      });
    } finally {
      set_testing_frigate(false);
    }
  };
  
  /**
   * Guarda la configuración
   */
  const handle_save = async () => {
    if (!config) return;
    
    const success = await save_config(config);
    if (success) {
      on_close();
    }
  };
  
  if (!config) {
    return (
      <Dialog open={is_open} onOpenChange={on_close}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configuración del Sistema LPR</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-8 w-8 animate-spin" />
            <span className="ml-2">Cargando configuración...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  return (
    <Dialog open={is_open} onOpenChange={on_close}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración del Sistema LPR
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="mqtt" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="mqtt" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              MQTT
            </TabsTrigger>
            <TabsTrigger value="frigate" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              Frigate
            </TabsTrigger>
            <TabsTrigger value="cameras" className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Cámaras
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Base de Datos
            </TabsTrigger>
            <TabsTrigger value="retention" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Retención
            </TabsTrigger>
            <TabsTrigger value="docker" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Docker
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="mqtt" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuración MQTT</CardTitle>
              </CardHeader>
              <CardContent>
                <MqttConfigSection
                  config={config.mqtt}
                  on_change={(mqtt_config: mqtt_config) => set_config({ ...config, mqtt: mqtt_config })}
                  on_test={test_mqtt_connection}
                  testing={testing_mqtt}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="frigate" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuración Frigate</CardTitle>
              </CardHeader>
              <CardContent>
                <FrigateConfigSection
                  config={config.frigate}
                  on_change={(frigate_config: frigate_config) => set_config({ ...config, frigate: frigate_config })}
                  on_test={test_frigate_connection}
                  testing={testing_frigate}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="cameras" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuración de Cámaras LPR</CardTitle>
              </CardHeader>
              <CardContent>
                <CamerasConfigSection
                  cameras={config.cameras}
                  available_cameras={available_cameras}
                  on_change={(cameras: Record<string, camera_config>) => set_config({ ...config, cameras })}
                  on_refresh_cameras={load_cameras}
                  loading_cameras={loading_cameras}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="database" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Configuración de Base de Datos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DatabaseConfigSection
                  config={config.database}
                  on_change={(database_config: database_config) => set_config({ ...config, database: database_config })}
                />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="retention" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Gestión de Retención de Datos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <RetentionConfigSection
                  config={config.retention}
                  on_change={(retention_config: retention_config) => set_config({ ...config, retention: retention_config })}
                />
              </CardContent>
            </Card>
            
            {/* Configuración adicional del sistema */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuración Avanzada del Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Eventos máximos por cámara</Label>
                  <Input
                    type="number"
                    min="100"
                    max="10000"
                    value={config.max_events_per_camera}
                    onChange={(e) => set_config({ 
                      ...config, 
                      max_events_per_camera: parseInt(e.target.value) || 1000 
                    })}
                  />
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="text-sm font-medium">Funcionalidades Avanzadas</h4>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Detección de falsos positivos</Label>
                        <p className="text-sm text-muted-foreground">
                          Usa IA para detectar automáticamente lecturas incorrectas
                        </p>
                      </div>
                      <Switch
                        checked={config.enable_false_positive_detection}
                        onCheckedChange={(checked) => set_config({
                          ...config,
                          enable_false_positive_detection: checked
                        })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Cálculo de velocidad</Label>
                        <p className="text-sm text-muted-foreground">
                          Estima la velocidad del vehículo basándose en el movimiento
                        </p>
                      </div>
                      <Switch
                        checked={config.enable_speed_calculation}
                        onCheckedChange={(checked) => set_config({
                          ...config,
                          enable_speed_calculation: checked
                        })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Detección de semáforos</Label>
                        <p className="text-sm text-muted-foreground">
                          Analiza el estado de los semáforos en la imagen
                        </p>
                      </div>
                      <Switch
                        checked={config.enable_traffic_light_detection}
                        onCheckedChange={(checked) => set_config({
                          ...config,
                          enable_traffic_light_detection: checked
                        })}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Modo debug</Label>
                        <p className="text-sm text-muted-foreground">
                          Registra información adicional para troubleshooting
                        </p>
                      </div>
                      <Switch
                        checked={config.debug_mode}
                        onCheckedChange={(checked) => set_config({
                          ...config,
                          debug_mode: checked
                        })}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="system" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Configuración del Sistema (Obsoleta)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Esta pestaña se mantiene por compatibilidad. Usa las pestañas "Base de Datos" y "Retención" para la nueva configuración.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Tab de gestión Docker */}
          <TabsContent value="docker" className="space-y-4">
            <div className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Gestión de Servicios Docker:</strong> Controla el estado del contenedor LPR backend 
                  desde esta interfaz. Requiere Docker y Docker Compose instalados.
                </AlertDescription>
              </Alert>
              
              <DockerServiceManager 
                service_name="lpr-backend"
                show_logs={true}
                auto_refresh={true}
              />
            </div>
          </TabsContent>
        </Tabs>
        
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={on_close}>
            Cancelar
          </Button>
          
          <Button onClick={handle_save} disabled={saving}>
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Guardar Configuración
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}