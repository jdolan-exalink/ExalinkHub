/**
 * Componente para gestión de servicios Docker LPR
 * Permite controlar el estado del contenedor desde la interfaz
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Settings, 
  Activity, 
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap
} from 'lucide-react';

// Tipos
interface ServiceStatus {
  service_name: string;
  status: 'running' | 'stopped' | 'error' | 'unknown';
  container_id?: string;
  uptime?: string;
  health?: 'healthy' | 'unhealthy' | 'unknown';
  ports?: string[];
}

interface DockerServiceResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

interface DockerServiceManagerProps {
  service_name?: string;
  show_logs?: boolean;
  auto_refresh?: boolean;
}

/**
 * Gestor de servicios Docker LPR
 */
export function DockerServiceManager({ 
  service_name = 'lpr-backend',
  show_logs = true,
  auto_refresh = true
}: DockerServiceManagerProps) {
  // Estados
  const [service_status, set_service_status] = useState<ServiceStatus | null>(null);
  const [is_loading, set_is_loading] = useState(false);
  const [last_action, set_last_action] = useState<string | null>(null);
  const [logs, set_logs] = useState<string>('');
  const [error_message, set_error_message] = useState<string | null>(null);
  
  /**
   * Obtiene el estado actual del servicio
   */
  const fetch_service_status = async () => {
    try {
      const response = await fetch(`/api/docker/lpr?service=${service_name}`);
      const data: DockerServiceResponse = await response.json();
      
      if (data.success) {
        set_service_status(data.data);
        set_error_message(null);
      } else {
        set_error_message(data.error || 'Error obteniendo estado');
      }
    } catch (error) {
      set_error_message('Error de conexión con la API');
      console.error('Error fetching service status:', error);
    }
  };
  
  /**
   * Controla el servicio (start/stop/restart)
   */
  const control_service = async (action: string) => {
    set_is_loading(true);
    set_last_action(action);
    set_error_message(null);
    
    try {
      const response = await fetch('/api/docker/lpr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          service_name
        })
      });
      
      const data: DockerServiceResponse = await response.json();
      
      if (data.success) {
        // Esperar un momento y actualizar estado
        setTimeout(() => {
          fetch_service_status();
        }, 2000);
      } else {
        set_error_message(data.error || `Error ejecutando ${action}`);
      }
    } catch (error) {
      set_error_message(`Error ejecutando ${action}`);
      console.error(`Error controlling service:`, error);
    } finally {
      set_is_loading(false);
      set_last_action(null);
    }
  };
  
  /**
   * Obtiene los logs del servicio
   */
  const fetch_logs = async () => {
    try {
      const response = await fetch(`/api/docker/lpr?service=${service_name}&action=logs`);
      const data: DockerServiceResponse = await response.json();
      
      if (data.success && data.data.stdout) {
        set_logs(data.data.stdout);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    }
  };
  
  // Efecto para cargar estado inicial
  useEffect(() => {
    fetch_service_status();
    
    if (auto_refresh) {
      const interval = setInterval(fetch_service_status, 10000); // Cada 10 segundos
      return () => clearInterval(interval);
    }
  }, [service_name, auto_refresh]);
  
  // Efecto para cargar logs
  useEffect(() => {
    if (show_logs && service_status?.status === 'running') {
      fetch_logs();
      const interval = setInterval(fetch_logs, 15000); // Cada 15 segundos
      return () => clearInterval(interval);
    }
  }, [show_logs, service_status?.status]);
  
  /**
   * Renderiza el badge de estado
   */
  const render_status_badge = () => {
    if (!service_status) return null;
    
    const status_config = {
      running: { color: 'bg-green-500', icon: CheckCircle, text: 'Ejecutándose' },
      stopped: { color: 'bg-gray-500', icon: Square, text: 'Detenido' },
      error: { color: 'bg-red-500', icon: AlertCircle, text: 'Error' },
      unknown: { color: 'bg-yellow-500', icon: Clock, text: 'Desconocido' }
    };
    
    const config = status_config[service_status.status];
    const Icon = config.icon;
    
    return (
      <Badge variant="outline" className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };
  
  /**
   * Renderiza el badge de salud
   */
  const render_health_badge = () => {
    if (!service_status?.health || service_status.status !== 'running') return null;
    
    const health_config = {
      healthy: { color: 'bg-green-500', text: 'Saludable' },
      unhealthy: { color: 'bg-red-500', text: 'No Saludable' },
      unknown: { color: 'bg-yellow-500', text: 'Desconocido' }
    };
    
    const config = health_config[service_status.health];
    
    return (
      <Badge variant="outline" className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        <Activity className="h-3 w-3" />
        {config.text}
      </Badge>
    );
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Gestión del Servicio Docker
          </div>
          {render_status_badge()}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Error message */}
        {error_message && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error_message}</AlertDescription>
          </Alert>
        )}
        
        {/* Información del servicio */}
        {service_status && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <strong>Servicio:</strong>
              <p className="text-muted-foreground">{service_status.service_name}</p>
            </div>
            <div>
              <strong>Estado:</strong>
              <p className="text-muted-foreground">{service_status.status}</p>
            </div>
            {service_status.container_id && (
              <div>
                <strong>Contenedor:</strong>
                <p className="text-muted-foreground font-mono text-xs">
                  {service_status.container_id.substring(0, 12)}...
                </p>
              </div>
            )}
            {service_status.uptime && (
              <div>
                <strong>Tiempo Activo:</strong>
                <p className="text-muted-foreground">{service_status.uptime}</p>
              </div>
            )}
          </div>
        )}
        
        {/* Badges adicionales */}
        <div className="flex gap-2 flex-wrap">
          {render_health_badge()}
          {service_status?.ports && service_status.ports.length > 0 && (
            <Badge variant="outline">
              Puertos: {service_status.ports.join(', ')}
            </Badge>
          )}
        </div>
        
        <Separator />
        
        {/* Controles del servicio */}
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => control_service('start')}
            disabled={is_loading || service_status?.status === 'running'}
            size="sm"
            variant="default"
          >
            {is_loading && last_action === 'start' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Play className="mr-2 h-4 w-4" />
            )}
            Iniciar
          </Button>
          
          <Button
            onClick={() => control_service('stop')}
            disabled={is_loading || service_status?.status === 'stopped'}
            size="sm"
            variant="destructive"
          >
            {is_loading && last_action === 'stop' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Square className="mr-2 h-4 w-4" />
            )}
            Detener
          </Button>
          
          <Button
            onClick={() => control_service('restart')}
            disabled={is_loading}
            size="sm"
            variant="outline"
          >
            {is_loading && last_action === 'restart' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="mr-2 h-4 w-4" />
            )}
            Reiniciar
          </Button>
          
          <Button
            onClick={() => control_service('build')}
            disabled={is_loading}
            size="sm"
            variant="secondary"
          >
            {is_loading && last_action === 'build' ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Settings className="mr-2 h-4 w-4" />
            )}
            Rebuild
          </Button>
          
          <Button
            onClick={fetch_service_status}
            disabled={is_loading}
            size="sm"
            variant="ghost"
          >
            <Activity className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>
        
        {/* Logs del servicio */}
        {show_logs && logs && (
          <div className="space-y-2">
            <Separator />
            <div className="flex items-center justify-between">
              <strong className="text-sm">Logs Recientes:</strong>
              <Button onClick={fetch_logs} size="sm" variant="ghost">
                Actualizar Logs
              </Button>
            </div>
            <div className="bg-black text-green-400 p-3 rounded-lg font-mono text-xs max-h-48 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{logs}</pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}