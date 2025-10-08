/**
 * Componentes auxiliares del panel LPR
 */

'use client';

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  Info, 
  RefreshCw, 
  HelpCircle, 
  Settings, 
  Shield, 
  Loader2, 
  Play 
} from 'lucide-react';

// Importar el modal de configuración avanzada
import { LPRAdvancedSettings } from './lpr-advanced-settings';

// Modal de configuración principal
interface LPRSettingsModalProps {
  is_open: boolean;
  on_close: () => void;
  auth_header: Record<string, string>;
}

export function LPRSettingsModal({ is_open, on_close, auth_header }: LPRSettingsModalProps) {
  return (
    <LPRAdvancedSettings 
      is_open={is_open}
      on_close={on_close}
      auth_header={auth_header}
    />
  );
}

// Visor de imágenes
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

interface LPRImageViewerProps {
  event: PlateEvent | null;
  is_open: boolean;
  on_close: () => void;
}

export function LPRImageViewer({ event, is_open, on_close }: LPRImageViewerProps) {
  if (!event) return null;

  return (
    <Dialog open={is_open} onOpenChange={on_close}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            Imagen - {event.license_plate} ({event.camera_name})
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {event.snapshot_url ? (
            <img 
              src={event.snapshot_url} 
              alt={`Snapshot de ${event.license_plate}`}
              className="w-full rounded-lg"
            />
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">
                  No hay imagen disponible para este evento
                </p>
              </CardContent>
            </Card>
          )}
          <div className="flex justify-between">
            <div className="text-sm text-muted-foreground">
              {new Date(event.timestamp).toLocaleString()}
            </div>
            <Button onClick={on_close}>Cerrar</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Componente de carga del sistema LPR
 */
export function LPRSystemLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Iniciando Sistema LPR</h3>
              <p className="text-muted-foreground">
                Verificando conectividad con el backend...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Componente mostrado cuando el sistema LPR no está disponible
 * Incluye instrucciones de configuración y opción de modo demo
 */
export function LPRSystemUnavailable() {
  const [is_checking, set_is_checking] = useState(false);
  const [show_setup_details, set_show_setup_details] = useState(false);
  
  /**
   * Verifica nuevamente el estado del sistema LPR
   */
  const check_system_again = async () => {
    set_is_checking(true);
    try {
      const response = await fetch('http://localhost:2221/health', {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      
      if (response.ok) {
        window.location.reload(); // Recargar si ahora está disponible
      } else {
        console.warn('Sistema aún no disponible');
      }
    } catch (error) {
      console.info('Sistema LPR aún no disponible');
    } finally {
      set_is_checking(false);
    }
  };
  
  /**
   * Activa el modo demo para trabajar sin backend
   */
  const activate_demo_mode = () => {
    // Trigger demo mode through parent component
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('lpr-demo-mode', { detail: true }));
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-orange-600" />
          </div>
          <CardTitle className="text-2xl">Sistema LPR No Disponible</CardTitle>
          <CardDescription className="text-lg">
            El servicio backend LPR no está ejecutándose o no es accesible
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Estado actual */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Estado:</strong> No se puede conectar al servicio LPR en http://localhost:2221
            </AlertDescription>
          </Alert>
          
          {/* Botones de acción principales */}
          <div className="flex gap-3 justify-center">
            <Button 
              onClick={check_system_again} 
              disabled={is_checking}
              variant="default"
            >
              {is_checking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Verificar Nuevamente
                </>
              )}
            </Button>
            
            <Button 
              onClick={activate_demo_mode}
              variant="outline"
            >
              <Play className="mr-2 h-4 w-4" />
              Modo Sin Conexión
            </Button>
            
            <Button 
              onClick={() => set_show_setup_details(!show_setup_details)}
              variant="ghost"
            >
              <HelpCircle className="mr-2 h-4 w-4" />
              Instrucciones de Configuración
            </Button>
          </div>
          
          {/* Instrucciones detalladas - colapsables */}
          {show_setup_details && (
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-semibold flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Configuración del Sistema LPR Backend
              </h4>
              
              <div className="space-y-3 text-sm">
                <div className="bg-muted p-3 rounded-lg">
                  <p className="font-medium mb-2">Paso 1: Instalar dependencias Python</p>
                  <code className="block bg-black text-green-400 p-2 rounded text-xs">
                    pip install fastapi uvicorn paho-mqtt sqlite3 requests pillow
                  </code>
                </div>
                
                <div className="bg-muted p-3 rounded-lg">
                  <p className="font-medium mb-2">Paso 2: Ejecutar el servidor LPR</p>
                  <code className="block bg-black text-green-400 p-2 rounded text-xs">
                    python lpr_server.py --port 2221 --host localhost
                  </code>
                </div>
                
                <div className="bg-muted p-3 rounded-lg">
                  <p className="font-medium mb-2">Paso 3: Verificar la configuración</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>El servidor debe ejecutarse en el puerto 2221</li>
                    <li>Verificar conectividad MQTT con Frigate</li>
                    <li>Configurar las cámaras LPR en la interfaz</li>
                    <li>Probar la detección de matrículas</li>
                  </ul>
                </div>
              </div>
              
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>Modo Sin Conexión:</strong> Puedes usar la interfaz en modo limitado para 
                  configurar parámetros y explorar las funcionalidades, pero no se procesarán 
                  eventos reales hasta que el backend esté disponible.
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          {/* Enlaces útiles */}
          <div className="flex justify-center gap-4 text-sm text-muted-foreground border-t pt-4">
            <a href="#" className="hover:text-primary">📖 Documentación</a>
            <span>•</span>
            <a href="#" className="hover:text-primary">🔧 Troubleshooting</a>
            <span>•</span>
            <a href="#" className="hover:text-primary">💬 Soporte</a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}