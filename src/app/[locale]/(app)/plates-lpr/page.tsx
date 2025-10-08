/**
 * Página principal del sistema LPR (License Plate Recognition)
 * 
 * Sistema único de reconocimiento de matrículas integrado con ExalinkHub.
 * Incluye configuración completa de MQTT, cámaras y gestión avanzada de eventos.
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, Settings, Shield, ServerCrash, RefreshCw, Download, Play, X, Edit, Image as ImageIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Importar el panel LPR principal
import { LPRPanel } from '@/components/lpr/lpr-panel';

// Importar componente de filtros LPR
import { LPRFilters } from '@/components/ui/lpr-filters';

// Importar tipos
import type { LPRFilters as LPRFiltersType } from '@/lib/types';

// Importar datos de ejemplo
import { sampleLPRReadings, shouldShowSampleData } from '@/lib/lpr-sample-data';

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
  const [lpr_readings, set_lpr_readings] = useState<any[]>([]);
  const [loading_readings, set_loading_readings] = useState(true);
  const [showing_sample_data, set_showing_sample_data] = useState(false);
  
  // Estado para filtros LPR
  const [lpr_filters, set_lpr_filters] = useState<LPRFiltersType>({
    startDate: new Date().toISOString().split('T')[0], // Día actual
    endDate: new Date().toISOString().split('T')[0],   // Día actual
    startTime: '00:00', // Inicio del día
    endTime: '23:59',   // Fin del día
    cameras: [],        // Todas las cámaras por defecto
    plateSearch: '',    // Sin búsqueda por defecto
  });
  
  // Estado para modales
  const [video_modal_open, set_video_modal_open] = useState(false);
  const [image_modal_open, set_image_modal_open] = useState(false);
  const [selected_reading, set_selected_reading] = useState<any>(null);
  const [editing_plate, set_editing_plate] = useState<string>('');
  const [is_editing, set_is_editing] = useState(false);
  
  // Ref para mantener la referencia al estado actual
  const system_status_ref = useRef(system_status);
  const [is_manual_checking, set_is_manual_checking] = useState(false);
  
  // Actualizar ref cuando cambie el estado
  useEffect(() => {
    system_status_ref.current = system_status;
  }, [system_status]);
  
  // Función para cargar lecturas LPR con filtros
  const load_lpr_readings = async () => {
    try {
      set_loading_readings(true);
      
      // Construir URL con parámetros de filtro
      const params = new URLSearchParams();
      
      // Agregar filtros de fecha y hora
      if (lpr_filters.startDate && lpr_filters.startTime) {
        const startDateTime = new Date(`${lpr_filters.startDate}T${lpr_filters.startTime}:00`);
        params.append('after', Math.floor(startDateTime.getTime() / 1000).toString());
      }
      
      if (lpr_filters.endDate && lpr_filters.endTime) {
        const endDateTime = new Date(`${lpr_filters.endDate}T${lpr_filters.endTime}:59`);
        params.append('before', Math.floor(endDateTime.getTime() / 1000).toString());
      }
      
      // Agregar filtro de matrícula
      if (lpr_filters.plateSearch && lpr_filters.plateSearch.trim()) {
        params.append('plate', lpr_filters.plateSearch.trim());
      }
      
      // Agregar filtros de cámaras
      if (lpr_filters.cameras && lpr_filters.cameras.length > 0) {
        lpr_filters.cameras.forEach(camera => {
          params.append('camera', camera);
        });
      }
      
      // Agregar filtro de confianza mínima
      if (lpr_filters.confidenceMin !== undefined) {
        params.append('confidence_min', lpr_filters.confidenceMin.toString());
      }
      
      // Límite de resultados
      params.append('limit', '1000'); // Aumentar límite para exportación
      
      const url = `/api/lpr/readings?${params.toString()}`;
      console.log('Cargando lecturas con URL:', url);
      
      // Crear un AbortController para timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout
      
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        const realData = data.readings || [];
        
        // Verificar si hay datos reales en la base de datos (sin filtros)
        const hasRealDataInDB = data.total > 0;
        
        // Si no hay búsqueda activa y no hay datos reales, mostrar datos de ejemplo
        if (!lpr_filters.plateSearch && shouldShowSampleData(realData) && !hasRealDataInDB) {
          console.log('No hay datos reales, mostrando datos de ejemplo');
          set_lpr_readings(sampleLPRReadings);
          set_showing_sample_data(true);
        } else {
          console.log(`Cargadas ${realData.length} lecturas reales`);
          set_lpr_readings(realData);
          set_showing_sample_data(false);
        }
      } else {
        console.error('Error en respuesta:', response.status, response.statusText);
        // En caso de error, mostrar datos de ejemplo
        console.log('Error en la API, mostrando datos de ejemplo');
        set_lpr_readings(sampleLPRReadings);
        set_showing_sample_data(true);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Timeout en la petición a la API LPR');
      } else {
        console.error('Error cargando lecturas LPR:', error);
      }
      // En caso de error, mostrar datos de ejemplo
      console.log('Error de conexión, mostrando datos de ejemplo');
      set_lpr_readings(sampleLPRReadings);
      set_showing_sample_data(true);
    } finally {
      set_loading_readings(false);
    }
  };
  
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
        
        // Si el sistema está bien configurado, marcar como disponible
        if (connectivity_data.data.system_ready) {
          set_system_status('available');
          toast({
            title: 'Sistema LPR disponible',
            description: 'Conexión exitosa con el backend LPR.',
          });
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
  
  // Función para manejar cambios en filtros
  const handle_filters_change = (filters: LPRFiltersType) => {
    set_lpr_filters(filters);
  };
  
  // Función para buscar con filtros aplicados
  const handle_search = () => {
    load_lpr_readings();
  };
  
  // Función para exportar a Excel
  const export_to_excel = () => {
    if (lpr_readings.length === 0) {
      toast({
        title: 'Sin datos',
        description: 'No hay registros para exportar.',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      // Importar xlsx dinámicamente
      import('xlsx').then((XLSX) => {
        // Preparar datos para Excel
        const excelData = lpr_readings.map(reading => ({
          'Matrícula': reading.plate,
          'Cámara': reading.camera,
          'Confianza': `${(reading.confidence * 100).toFixed(1)}%`,
          'Fecha/Hora': new Date(reading.timestamp * 1000).toLocaleString(),
          'Tipo Vehículo': reading.vehicle_type || '-',
          'Velocidad': reading.speed ? `${reading.speed} km/h` : '-',
          'Dirección': reading.direction || '-',
          'Servidor': reading.server_name
        }));
        
        // Crear libro de trabajo
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(excelData);
        
        // Ajustar ancho de columnas
        const colWidths = [
          { wch: 15 }, // Matrícula
          { wch: 15 }, // Cámara
          { wch: 12 }, // Confianza
          { wch: 20 }, // Fecha/Hora
          { wch: 15 }, // Tipo Vehículo
          { wch: 12 }, // Velocidad
          { wch: 12 }, // Dirección
          { wch: 15 }  // Servidor
        ];
        ws['!cols'] = colWidths;
        
        // Agregar hoja al libro
        XLSX.utils.book_append_sheet(wb, ws, 'Lecturas LPR');
        
        // Generar nombre de archivo con fecha
        const now = new Date();
        const filename = `lecturas_lpr_${now.toISOString().split('T')[0]}_${now.toTimeString().split(' ')[0].replace(/:/g, '')}.xlsx`;
        
        // Descargar archivo
        XLSX.writeFile(wb, filename);
        
        toast({
          title: 'Exportación exitosa',
          description: `Se exportaron ${lpr_readings.length} registros a ${filename}`,
        });
      });
    } catch (error) {
      console.error('Error exportando a Excel:', error);
      toast({
        title: 'Error de exportación',
        description: 'No se pudo exportar los datos a Excel.',
        variant: 'destructive',
      });
    }
  };

  // Funciones para modales
  const open_video_modal = (reading: any) => {
    set_selected_reading(reading);
    set_video_modal_open(true);
  };

  const open_image_modal = (reading: any) => {
    set_selected_reading(reading);
    set_image_modal_open(true);
  };

  const close_modals = () => {
    set_video_modal_open(false);
    set_image_modal_open(false);
    set_selected_reading(null);
  };

  // Función para manejar doble click en matrícula
  const handle_plate_double_click = (reading: any) => {
    set_selected_reading(reading);
    set_editing_plate(reading.plate);
    set_is_editing(true);
  };

  // Función para guardar edición de matrícula
  const save_plate_edit = async () => {
    if (!selected_reading || !editing_plate.trim()) return;

    try {
      const response = await fetch(`/api/lpr/readings/${selected_reading.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ plate: editing_plate.trim() }),
      });

      if (response.ok) {
        // Actualizar la lectura en el estado local
        set_lpr_readings(prev => prev.map(reading =>
          reading.id === selected_reading.id
            ? { ...reading, plate: editing_plate.trim() }
            : reading
        ));

        toast({
          title: 'Matrícula actualizada',
          description: `La matrícula se cambió a ${editing_plate.trim()}`,
        });

        set_is_editing(false);
        set_selected_reading(null);
      } else {
        throw new Error('Error al actualizar');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la matrícula',
        variant: 'destructive',
      });
    }
  };

  // Función para cancelar edición
  const cancel_edit = () => {
    set_is_editing(false);
    set_selected_reading(null);
    set_editing_plate('');
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
          console.log('Connectivity data received:', connectivity_data);
          set_connectivity_status(connectivity_data.data);
          
          // Si el sistema está bien configurado, marcar como disponible
          // El endpoint de conectividad ya verifica el estado del backend LPR
          if (connectivity_data.data.system_ready) {
            console.log('System ready, marking as available');
            set_system_status('available');
            console.log('System status set to available');
          } else {
            console.log('System not ready, status:', connectivity_data.data);
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
  
  // Cargar lecturas LPR al montar el componente
  useEffect(() => {
    load_lpr_readings();
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
      {/* Barra de herramientas del panel LPR */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">
            Panel de Matrículas
          </h1>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                load_lpr_readings();
                window.location.reload();
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={export_to_excel}
              disabled={lpr_readings.length === 0}
            >
              <Download className="h-4 w-4 mr-2" />
              Exportar Excel
            </Button>
          </div>
        </div>
      </Card>
      
      {/* Barra de filtros LPR */}
      <LPRFilters
        filters={lpr_filters}
        onFiltersChange={handle_filters_change}
        onSearch={handle_search}
        isLoading={loading_readings}
      />
      
      {/* Grilla de base de datos de matrículas */}
      <Card className="overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">Base de Datos de Matrículas</h3>
          {showing_sample_data && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-800">Datos de ejemplo</span>
            </div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-base text-slate-700">Recorte</th>
                <th className="px-4 py-3 text-left font-bold text-base text-slate-700">Matrícula</th>
                <th className="px-4 py-3 text-left font-bold text-base text-slate-700">Fecha/Hora</th>
                <th className="px-4 py-3 text-left font-bold text-base text-slate-700">Cámara</th>
                <th className="px-4 py-3 text-left font-bold text-base text-slate-700">Velocidad</th>
                <th className="px-4 py-3 text-left font-bold text-base text-slate-700">Clip</th>
              </tr>
            </thead>
            <tbody>
              {loading_readings ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    Cargando datos...
                  </td>
                </tr>
              ) : lpr_readings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    {lpr_filters.plateSearch ? 
                      `No se encontraron resultados que contengan "${lpr_filters.plateSearch}"` :
                      'No hay registros de matrículas en la base de datos'
                    }
                  </td>
                </tr>
              ) : (
                lpr_readings.map((reading: any) => (
                  <tr key={reading.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3">
                      {reading.local_files?.crop_url ? (
                        <img
                          src={reading.local_files.crop_url}
                          alt={`Recorte ${reading.plate}`}
                          className="w-16 h-12 object-cover cursor-pointer border rounded hover:border-blue-500"
                          onClick={() => open_image_modal(reading)}
                        />
                      ) : (
                        <div className="w-16 h-12 bg-gray-200 border rounded flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {is_editing && selected_reading?.id === reading.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={editing_plate}
                            onChange={(e) => set_editing_plate(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') save_plate_edit();
                              if (e.key === 'Escape') cancel_edit();
                            }}
                            className="w-24 font-mono"
                            autoFocus
                          />
                          <Button size="sm" onClick={save_plate_edit} className="h-8 px-2">
                            ✓
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancel_edit} className="h-8 px-2">
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <span
                          className="font-mono font-medium cursor-pointer hover:bg-blue-100 px-1 rounded"
                          onDoubleClick={() => handle_plate_double_click(reading)}
                          title="Doble click para editar"
                        >
                          {reading.plate}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(reading.timestamp * 1000).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{reading.camera}</td>
                    <td className="px-4 py-3">{reading.speed ? `${reading.speed} km/h` : '-'}</td>
                    <td className="px-4 py-3">
                      {reading.local_files?.clip_url ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => open_video_modal(reading)}
                          className="flex items-center gap-1"
                        >
                          <Play className="w-4 h-4" />
                          Ver
                        </Button>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
      
      {/* Modal para reproductor de video */}
      <Dialog open={video_modal_open} onOpenChange={close_modals}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Clip de detección - {selected_reading?.plate}</span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (selected_reading?.local_files?.clip_url) {
                      const link = document.createElement('a');
                      link.href = selected_reading.local_files.clip_url;
                      link.download = `clip_${selected_reading.plate}_${selected_reading.timestamp}.mp4`;
                      link.click();
                    }
                  }}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Descargar
                </Button>
                <Button size="sm" variant="outline" onClick={close_modals}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            {selected_reading?.local_files?.clip_url ? (
              <video
                controls
                autoPlay
                className="max-w-full max-h-96 rounded-lg"
                src={selected_reading.local_files.clip_url}
              >
                Tu navegador no soporta el elemento de video.
              </video>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No hay clip disponible para esta detección</p>
              </div>
            )}
            <div className="text-sm text-muted-foreground text-center">
              <p><strong>Matrícula:</strong> {selected_reading?.plate}</p>
              <p><strong>Cámara:</strong> {selected_reading?.camera}</p>
              <p><strong>Fecha:</strong> {selected_reading ? new Date(selected_reading.timestamp * 1000).toLocaleString() : ''}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal para imagen de detección */}
      <Dialog open={image_modal_open} onOpenChange={close_modals}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Imagen de detección - {selected_reading?.plate}</span>
              <Button size="sm" variant="outline" onClick={close_modals}>
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4">
            {selected_reading?.local_files?.snapshot_url ? (
              <img
                src={selected_reading.local_files.snapshot_url}
                alt={`Detección ${selected_reading.plate}`}
                className="max-w-full max-h-96 object-contain rounded-lg"
              />
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No hay imagen disponible para esta detección</p>
              </div>
            )}
            <div className="text-sm text-muted-foreground text-center">
              <p><strong>Matrícula:</strong> {selected_reading?.plate}</p>
              <p><strong>Cámara:</strong> {selected_reading?.camera}</p>
              <p><strong>Fecha:</strong> {selected_reading ? new Date(selected_reading.timestamp * 1000).toLocaleString() : ''}</p>
              <p><strong>Confianza:</strong> {selected_reading ? `${(selected_reading.confidence * 100).toFixed(1)}%` : ''}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Panel principal LPR */}
      <LPRPanel />
    </div>
  );
}