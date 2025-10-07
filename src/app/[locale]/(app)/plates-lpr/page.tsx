/**
 * Página principal del sistema LPR (License Plate Recognition)
 * 
 * Sistema único de reconocimiento de matrículas integrado con ExalinkHub.
 * Incluye configuración completa de MQTT, cámaras y gestión avanzada de eventos.
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Settings, Shield, ServerCrash, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

// Importar el panel LPR principal
import { LPRPanel } from '@/components/lpr/lpr-panel';

// Componente para mostrar cuando el sistema no está disponible
function LPRSystemUnavailable() {
  const [is_checking, set_is_checking] = useState(false);
  
  const check_again = async () => {
    set_is_checking(true);
    try {
      const response = await fetch('http://localhost:2221/health', {
        signal: AbortSignal.timeout(3000)
      });
      if (response.ok) {
        window.location.reload();
      }
    } catch (error) {
      // El sistema sigue no disponible
    } finally {
      set_is_checking(false);
    }
  };
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center py-12">
        <ServerCrash className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold mb-2">Sistema LPR No Disponible</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          El servicio backend del sistema LPR no está ejecutándose. 
          Por favor, inicia el servidor para acceder a las funcionalidades avanzadas.
        </p>
        
        <div className="space-y-4 max-w-3xl mx-auto">
          <Alert className="text-left">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Para iniciar el sistema LPR:</strong>
              <div className="mt-2 space-y-1 text-sm">
                <div>1. Abre una terminal/PowerShell</div>
                <div>2. Navega a la carpeta: <code className="bg-muted px-1 rounded">cd lpr_backend/</code></div>
                <div>3. Instala dependencias: <code className="bg-muted px-1 rounded">pip install -r requirements.txt</code></div>
                <div>4. Inicia el servidor: <code className="bg-muted px-1 rounded">python -m app.main</code></div>
                <div>5. El servidor estará disponible en: <code className="bg-muted px-1 rounded">http://localhost:2221</code></div>
              </div>
            </AlertDescription>
          </Alert>
          
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <strong>Requisitos del sistema:</strong>
              <div className="mt-2 space-y-1 text-sm">
                <div>• Python 3.11 o superior instalado</div>
                <div>• Servidor MQTT funcionando (ej: Mosquitto)</div>
                <div>• Frigate funcionando con eventos habilitados</div>
                <div>• Puerto 2221 disponible en el sistema</div>
              </div>
            </AlertDescription>
          </Alert>
          
          <div className="flex gap-4 justify-center">
            <Button 
              onClick={check_again} 
              disabled={is_checking}
              variant="default"
              className="flex items-center gap-2"
            >
              {is_checking ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Verificando...
                </>
              ) : (
                <>
                  <Shield className="h-4 w-4" />
                  Verificar Conexión
                </>
              )}
            </Button>
            
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
            >
              Recargar Página
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Componente para mostrar durante la carga
function LPRSystemLoading() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold mb-2">Conectando al Sistema LPR</h2>
        <p className="text-muted-foreground">
          Verificando disponibilidad del servicio...
        </p>
      </div>
    </div>
  );
}

export default function PlatesLPRPage() {
  const [system_status, set_system_status] = useState<'loading' | 'available' | 'unavailable'>('loading');
  const [system_info, set_system_info] = useState<any>(null);
  const [show_demo_mode, set_show_demo_mode] = useState(false);
  const [connectivity_status, set_connectivity_status] = useState<any>(null);
  const [testing_connectivity, set_testing_connectivity] = useState(false);
  
  // Ref para mantener la referencia al estado actual
  const system_status_ref = useRef(system_status);
  const [is_manual_checking, set_is_manual_checking] = useState(false);
  
  // Actualizar ref cuando cambie el estado
  useEffect(() => {
    system_status_ref.current = system_status;
  }, [system_status]);
  
  // Función para verificación manual
  const manual_check_system = async () => {
    set_is_manual_checking(true);
    
    try {
      // Verificar conectividad MQTT y Frigate desde la configuración
      const connectivity_response = await fetch('/api/config/backend/connectivity', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (connectivity_response.ok) {
        const connectivity_data = await connectivity_response.json();
        set_connectivity_status(connectivity_data.data);
        
        // Si el sistema está bien configurado, intentar conectar al backend LPR
        if (connectivity_data.data.system_ready) {
          try {
            const controller = new AbortController();
            const timeout_id = setTimeout(() => controller.abort(), 3000);
            
            const health_response = await fetch('http://localhost:2221/health', {
              signal: controller.signal,
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              }
            });
            
            clearTimeout(timeout_id);
            
            if (health_response.ok) {
              const health_data = await health_response.json();
              set_system_info(health_data);
              set_system_status('available');
              toast({
                title: 'Sistema LPR disponible',
                description: 'Conexión exitosa con el backend LPR.',
              });
            } else {
              set_system_status('unavailable');
              toast({
                title: 'Backend LPR no disponible',
                description: 'El servidor LPR no responde correctamente.',
                variant: 'destructive',
              });
            }
          } catch (error) {
            set_system_status('unavailable');
            toast({
              title: 'Backend LPR no accesible',
              description: 'No se puede conectar al servidor LPR en el puerto 2221.',
              variant: 'destructive',
            });
          }
        } else {
          set_system_status('unavailable');
          const issues_text = connectivity_data.data.issues.join(', ');
          toast({
            title: 'Sistema no configurado',
            description: `Problemas: ${issues_text}`,
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Error in manual check:', error);
      toast({
        title: 'Error de verificación',
        description: 'No se pudo verificar el estado del sistema.',
        variant: 'destructive',
      });
    } finally {
      set_is_manual_checking(false);
    }
  };
  
  // Función para probar conectividad completa
  const test_connectivity = async () => {
    set_testing_connectivity(true);
    
    try {
      const response = await fetch('/api/config/backend/connectivity', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const test_data = await response.json();
        const results = test_data.data;
        
        if (results.overall_status === 'success') {
          toast({
            title: 'Conectividad exitosa',
            description: 'MQTT y Frigate están funcionando correctamente.',
          });
        } else if (results.overall_status === 'partial') {
          toast({
            title: 'Conectividad parcial',
            description: `Algunos servicios tienen problemas: ${results.issues.join(', ')}`,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Error de conectividad',
            description: `Problemas detectados: ${results.issues.join(', ')}`,
            variant: 'destructive',
          });
        }
        
        // Actualizar estado de conectividad
        const connectivity_response = await fetch('/api/config/backend/connectivity', {
          method: 'GET'
        });
        
        if (connectivity_response.ok) {
          const connectivity_data = await connectivity_response.json();
          set_connectivity_status(connectivity_data.data);
        }
      }
    } catch (error) {
      console.error('Error testing connectivity:', error);
      toast({
        title: 'Error en prueba de conectividad',
        description: 'No se pudo realizar la prueba de conectividad.',
        variant: 'destructive',
      });
    } finally {
      set_testing_connectivity(false);
    }
  };
  
  // Verificar estado del sistema LPR
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let is_initial_check = true;
    
    const check_lpr_system = async () => {
      try {
        // Solo mostrar loading en la verificación inicial
        if (is_initial_check) {
          set_system_status('loading');
        }
        
        // Verificar conectividad MQTT y Frigate desde la configuración
        const connectivity_response = await fetch('/api/config/backend/connectivity', {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (connectivity_response.ok) {
          const connectivity_data = await connectivity_response.json();
          set_connectivity_status(connectivity_data.data);
          
          // Si el sistema está bien configurado, intentar conectar al backend LPR
          if (connectivity_data.data.system_ready) {
            try {
              // Verificar health del sistema con timeout más corto
              const controller = new AbortController();
              const timeout_id = setTimeout(() => controller.abort(), 3000); // 3 segundos
              
              const health_response = await fetch('http://localhost:2221/health', {
                signal: controller.signal,
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
                }
              });
              
              clearTimeout(timeout_id);
              
              if (health_response.ok) {
                const health_data = await health_response.json();
                set_system_info(health_data);
                set_system_status('available');
              } else {
                console.warn('LPR Health check failed:', health_response.status);
                set_system_status('unavailable');
              }
            } catch (error) {
              console.info('Backend LPR no disponible:', error instanceof Error ? error.message : 'Error de conexión');
              set_system_status('unavailable');
            }
          } else {
            // Sistema no configurado correctamente
            set_system_status('unavailable');
          }
        } else {
          console.error('Error checking connectivity:', connectivity_response.status);
          set_system_status('unavailable');
        }
      } catch (error) {
        console.error('Error verificando sistema LPR:', error);
        set_system_status('unavailable');
      }
      
      is_initial_check = false;
    };
    
    // Ejecutar verificación inicial
    check_lpr_system();
    
    // Configurar intervalo para verificaciones periódicas menos frecuentes
    interval = setInterval(() => {
      // Solo verificar nuevamente si el sistema no está disponible
      // Y reducir la frecuencia para evitar spam
      if (system_status_ref.current === 'unavailable') {
        check_lpr_system();
      }
    }, 60000); // Cambiar a 60 segundos para reducir carga
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, []); // Sin dependencias para evitar el loop infinito
  
  // Escuchar evento para activar modo demo
  useEffect(() => {
    const handle_demo_mode = (event: any) => {
      if (event.detail === true) {
        set_show_demo_mode(true);
      }
    };
    
    window.addEventListener('lpr-demo-mode', handle_demo_mode);
    
    return () => {
      window.removeEventListener('lpr-demo-mode', handle_demo_mode);
    };
  }, []);
  
  // Renderizar según el estado del sistema
  if (system_status === 'loading') {
    return <LPRSystemLoading />;
  }
  
  if (system_status === 'unavailable' && !show_demo_mode) {
    return <LPRSystemUnavailable />;
  }
  
  // Sistema disponible - mostrar panel principal
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header del sistema */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Sistema LPR
          </h1>
          <p className="text-muted-foreground mt-1">
            Reconocimiento y gestión avanzada de matrículas
          </p>
        </div>
        
        {/* Indicador de estado del sistema */}
        <div className="flex items-center gap-4">
          {/* Botón de verificación manual del sistema */}
          <Button
            variant="outline"
            size="sm"
            onClick={manual_check_system}
            disabled={is_manual_checking}
            className="text-green-600 border-green-300 hover:bg-green-50"
          >
            {is_manual_checking ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Verificar Sistema
              </>
            )}
          </Button>
          
          {/* Botón de prueba de conectividad */}
          <Button
            variant="outline"
            size="sm"
            onClick={test_connectivity}
            disabled={testing_connectivity}
            className="text-blue-600 border-blue-300 hover:bg-blue-50"
          >
            {testing_connectivity ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Probando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Probar Conexiones
              </>
            )}
          </Button>
          
          {system_info && system_status === 'available' && (
            <div className="text-right text-sm">
              <div className="flex items-center gap-2 text-green-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Sistema Operativo
              </div>
              <div className="text-muted-foreground">
                v{system_info.version || '1.0.0'}
              </div>
            </div>
          )}
          
          {system_status === 'unavailable' && show_demo_mode && (
            <div className="text-right text-sm">
              <div className="flex items-center gap-2 text-orange-600">
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                Modo Sin Conexión
              </div>
              <div className="text-muted-foreground">
                Funcionalidad limitada
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Alertas de estado del sistema */}
      {system_status === 'unavailable' && show_demo_mode && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Sistema Backend No Disponible:</strong> Funcionando en modo sin conexión. 
            Algunas funcionalidades no estarán disponibles hasta que se inicie el servicio backend.
          </AlertDescription>
        </Alert>
      )}
      
      {connectivity_status && !connectivity_status.lpr_enabled && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Sistema LPR Deshabilitado:</strong> El sistema de reconocimiento de matrículas está deshabilitado. 
            Actívalo en la configuración del backend.
          </AlertDescription>
        </Alert>
      )}
      
      {connectivity_status && connectivity_status.mqtt_status !== 'configured' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>MQTT Desconectado:</strong> El sistema no puede recibir eventos de Frigate. 
            Verifica la configuración MQTT en las preferencias del sistema.
          </AlertDescription>
        </Alert>
      )}
      
      {connectivity_status && connectivity_status.frigate_status !== 'configured' && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Frigate No Accesible:</strong> No se puede conectar con el servidor Frigate. 
            Verifica que esté ejecutándose y la configuración sea correcta.
          </AlertDescription>
        </Alert>
      )}
      
      {connectivity_status && connectivity_status.issues.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Problemas de Configuración:</strong>
            <ul className="mt-2 space-y-1">
              {connectivity_status.issues.map((issue: string, index: number) => (
                <li key={index} className="text-sm">• {issue}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      
      {system_info && system_info.last_event_time && (
        new Date().getTime() - new Date(system_info.last_event_time).getTime() > 3600000 // 1 hora
      ) && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Sin Actividad Reciente:</strong> No se han detectado eventos en la última hora. 
            Verifica que las cámaras estén configuradas correctamente.
          </AlertDescription>
        </Alert>
      )}
      
      {/* Panel principal LPR */}
      <LPRPanel />
      
      {/* Información del sistema en pie de página */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Estado del Sistema
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <strong>Backend:</strong>
              <p className={`${system_status === 'available' ? 'text-green-600' : 'text-red-600'}`}>
                {system_status === 'available' ? 'Conectado' : 'Desconectado'}
              </p>
            </div>
            <div>
              <strong>MQTT:</strong>
              <p className={`${connectivity_status?.mqtt_status === 'configured' ? 'text-green-600' : 'text-red-600'}`}>
                {connectivity_status?.mqtt_status === 'configured' ? 'Configurado' : 'No Configurado'}
              </p>
            </div>
            <div>
              <strong>Frigate:</strong>
              <p className={`${connectivity_status?.frigate_status === 'configured' ? 'text-green-600' : 'text-red-600'}`}>
                {connectivity_status?.frigate_status === 'configured' ? 'Configurado' : 'No Configurado'}
              </p>
            </div>
            <div>
              <strong>Sistema LPR:</strong>
              <p className={`${connectivity_status?.lpr_enabled ? 'text-green-600' : 'text-red-600'}`}>
                {connectivity_status?.lpr_enabled ? 'Habilitado' : 'Deshabilitado'}
              </p>
            </div>
            <div>
              <strong>Estado General:</strong>
              <p className={`${connectivity_status?.system_ready ? 'text-green-600' : 'text-red-600'}`}>
                {connectivity_status?.system_ready ? 'Listo' : 'Con Errores'}
              </p>
            </div>
            <div>
              <strong>Último Evento:</strong>
              <p className="text-muted-foreground">
                {system_info?.last_event_time 
                  ? new Date(system_info.last_event_time).toLocaleString()
                  : 'Sin eventos'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}