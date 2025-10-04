﻿"use client";

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import type { Camera } from '@/lib/types';
import { DndContext, useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import CameraFeed from './camera-feed';
import { LayoutGrid, Maximize2, Minimize2, Settings2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import LayoutManager from '@/components/ui/layout-manager';

const layoutDefinitions = {
  '1x1': {
    label: '1×1',
    template: 'grid-cols-1 grid-rows-1 auto-rows-fr',
    cells: 1
  },
  '2x2': {
    label: '2×2',
    template: 'grid-cols-2 grid-rows-2 auto-rows-fr',
    cells: 4
  },
  '3x3': {
    label: '3×3',
    template: 'grid-cols-3 grid-rows-3 auto-rows-fr',
    cells: 9
  },
  '4x4': {
    label: '4×4',
    template: 'grid-cols-4 grid-rows-4 auto-rows-fr',
    cells: 16
  },
  '5x5': {
    label: '5×5',
    template: 'grid-cols-5 grid-rows-5 auto-rows-fr',
    cells: 25
  },
  '6x6': {
    label: '6×6',
    template: 'grid-cols-6 grid-rows-6 auto-rows-fr',
    cells: 36
  },
  '1+5': {
    label: '1+5',
    template: 'grid-cols-3 grid-rows-3 auto-rows-fr',
    cells: 6,
    cellClass: (index: number) => {
      switch (index) {
        case 0:
          return 'col-span-2 row-span-2 col-start-1 row-start-1';
        case 1:
          return 'col-start-3 row-start-1';
        case 2:
          return 'col-start-3 row-start-2';
        case 3:
          return 'col-start-1 row-start-3';
        case 4:
          return 'col-start-2 row-start-3';
        case 5:
          return 'col-start-3 row-start-3';
        default:
          return '';
      }
    }
  },
  '1+12': {
    label: '1+12',
    template: 'grid-cols-4 grid-rows-4 auto-rows-fr',
    cells: 13,
    cellClass: (index: number) => {
      switch (index) {
        case 0:
          return 'col-span-2 row-span-2 col-start-1 row-start-1';
        case 1:
          return 'col-start-3 row-start-1';
        case 2:
          return 'col-start-4 row-start-1';
        case 3:
          return 'col-start-3 row-start-2';
        case 4:
          return 'col-start-4 row-start-2';
        case 5:
          return 'col-start-1 row-start-3';
        case 6:
          return 'col-start-2 row-start-3';
        case 7:
          return 'col-start-3 row-start-3';
        case 8:
          return 'col-start-4 row-start-3';
        case 9:
          return 'col-start-1 row-start-4';
        case 10:
          return 'col-start-2 row-start-4';
        case 11:
          return 'col-start-3 row-start-4';
        case 12:
          return 'col-start-4 row-start-4';
        default:
          return '';
      }
    }
  }
} as const;

type LayoutKey = keyof typeof layoutDefinitions;

type GridCell = {
  id: number;
  camera: Camera | null;
};

type LiveViewProps = {
  cameras: Camera[];
  onCameraDoubleClick: (camera: Camera) => void;
};

function DroppableCell({ cell, onRemove, onFpsChange, children, className }: {
  cell: GridCell;
  onRemove: (cameraId: string) => void;
  onFpsChange?: (cameraId: string, fps: number) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const translate_live = useTranslations('live');
  const { isOver, setNodeRef } = useDroppable({
    id: `cell-${cell.id}`,
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      layout
    >
      <Card
        ref={setNodeRef}
        className={cn(
          "bg-secondary/20 flex items-center justify-center relative transition-all duration-200 border-2 border-dashed w-full",
          "grid-cell-16x9 camera-container", // Clases CSS personalizadas para 16:9
          isOver && "ring-2 ring-primary ring-inset bg-primary/10 border-primary scale-[1.01]",
          cell.camera ? "border-border bg-card" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-secondary/40"
        )}
        style={{
          aspectRatio: '16/9' // Garantizar 16:9 en todos los navegadores
        }}
      >
        <AnimatePresence mode="wait">
          {cell.camera ? (
            <motion.div
              key={`camera-${cell.camera.id}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="w-full h-full"
            >
              <CameraFeed camera={cell.camera} onRemove={onRemove} gridCellId={cell.id} onFpsChange={onFpsChange} />
            </motion.div>
          ) : (
            <motion.div
              key="empty-cell"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col items-center justify-center text-center p-4"
            >
              <div className={cn(
                "text-4xl mb-2 transition-colors",
                isOver ? "text-primary" : "text-muted-foreground/50"
              )}>
                📹
              </div>
              <span className={cn(
                "text-sm font-medium transition-colors",
                isOver ? "text-primary" : "text-muted-foreground"
              )}>
                {isOver ? translate_live('grid.drop_here') : translate_live('grid.drag_prompt')}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}


export default function LiveView({ cameras }: { cameras: Camera[] }) {
  const translate_live = useTranslations('live');
  const { toast } = useToast();
  const [layout, setLayout] = useState<LayoutKey>('2x2'); // Cambiar por defecto a 2x2
  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [isLoadingView, setIsLoadingView] = useState(false); // Para vistas guardadas
  const [streamDelays, setStreamDelays] = useState<Record<number, number>>({}); // Delays por celda
  const [hdCameraId, setHdCameraId] = useState<string | null>(null); // Solo 1 cámara en HD
  const [activeFpsMap, setActiveFpsMap] = useState<Map<string, number>>(new Map()); // Track FPS per camera
  const [lastTotalFps, setLastTotalFps] = useState<number>(0); // Para evitar actualizaciones innecesarias
  const [lastBandwidth, setLastBandwidth] = useState<string>('0 KB/s'); // Para evitar actualizaciones innecesarias
  const [isGridFullscreen, setIsGridFullscreen] = useState(false); // Estado para pantalla completa de grilla

  // Funciones para persistencia de vista
  const saveViewToLocalStorage = () => {
    try {
      const viewState = {
        layout,
        gridCells: gridCells.map(cell => ({
          id: cell.id,
          camera: cell.camera ? {
            id: cell.camera.id,
            name: cell.camera.name,
            enabled: cell.camera.enabled
          } : null
        })),
        hdCameraId,
        timestamp: Date.now()
      };
      localStorage.setItem('liveViewState', JSON.stringify(viewState));
      console.log('💾 View state saved to localStorage:', {
        layout: viewState.layout,
        totalCells: viewState.gridCells.length,
        activeCameras: viewState.gridCells.filter(c => c.camera !== null).length
      });
    } catch (error) {
      console.error('Error saving view state:', error);
    }
  };

  const loadViewFromLocalStorage = () => {
    try {
      const savedState = localStorage.getItem('liveViewState');
      if (savedState) {
        const viewState = JSON.parse(savedState);
        
        // Verificar que no sea muy antiguo (máximo 7 días)
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 días en ms
        if (Date.now() - viewState.timestamp > maxAge) {
          localStorage.removeItem('liveViewState');
          return false;
        }

        console.log('📂 Loading view state from localStorage:', {
          layout: viewState.layout,
          totalCells: viewState.gridCells.length,
          activeCameras: viewState.gridCells.filter((c: any) => c.camera !== null).length
        });
        
        // Restaurar layout PRIMERO
        setLayout(viewState.layout);
        
        // Esperar a que el layout se actualice, luego restaurar cámaras
        setTimeout(() => {
          // Asegurar que el grid tenga el tamaño correcto para el layout guardado
          const requiredCells = getGridSize(viewState.layout);
          
          // Restaurar cámaras manteniendo TODAS las guardadas
          const restoredCells = Array.from({ length: requiredCells }, (_, index) => {
            const savedCell = viewState.gridCells.find((c: any) => c.id === index);
            return {
              id: index,
              camera: savedCell?.camera ? cameras.find(c => c.id === savedCell.camera.id) || null : null
            };
          });
          
          console.log('🔄 Restoring cells:', {
            required: requiredCells,
            restored: restoredCells.filter(c => c.camera !== null).length,
            cells: restoredCells.map(c => ({ id: c.id, camera: c.camera?.name || 'empty' }))
          });
          
          setGridCells(restoredCells);
          
          // Restaurar HD camera
          if (viewState.hdCameraId && cameras.find(c => c.id === viewState.hdCameraId)) {
            setHdCameraId(viewState.hdCameraId);
          }
          
          toast({
            title: translate_live('toast.view_restored.title'),
            description: translate_live('toast.view_restored.description', { count: restoredCells.filter(c => c.camera !== null).length, layout: viewState.layout }),
            duration: 4000,
          });
        }, 100); // Small delay para asegurar que el layout se actualice
        
        return true;
      }
    } catch (error) {
      console.error('Error loading view state:', error);
      localStorage.removeItem('liveViewState');
    }
    return false;
  };

  // Función para añadir cámara a primera celda libre
  const addCameraToFirstEmptyCell = (camera: Camera) => {
    setGridCells(currentCells => {
      const newCells = [...currentCells];
      const firstEmptyIndex = newCells.findIndex(c => c.camera === null);
      
      if (firstEmptyIndex !== -1) {
        // Evitar agregar cámaras duplicadas
        if (newCells.some(c => c.camera?.id === camera.id)) {
          // Programar toast para después del render
          setTimeout(() => {
            toast({ 
              title: translate_live('toast.camera_exists.title'), 
              description: translate_live('toast.camera_exists.description', { camera: camera.name }), 
              variant: 'default' 
            });
          }, 0);
          return newCells;
        }
        newCells[firstEmptyIndex] = { ...newCells[firstEmptyIndex], camera: camera };
        return newCells;
      } else {
        // Programar toast para después del render
        setTimeout(() => {
          toast({ 
            title: translate_live('toast.grid_full.title'), 
            description: translate_live('toast.grid_full.description'), 
            variant: 'destructive' 
          });
        }, 0);
        return currentCells;
      }
    });
  };

  // Registrar el handler de doble click globalmente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).addCameraToGrid = addCameraToFirstEmptyCell;
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).addCameraToGrid;
      }
    };
  }, []);

  // Cargar vista desde localStorage al inicializar
  useEffect(() => {
    if (cameras.length > 0) {
      const loaded = loadViewFromLocalStorage();
      if (!loaded) {
        // Si no hay vista guardada, inicializar grid vacío
        const size = getGridSize(layout);
        setGridCells(Array.from({ length: size }, (_, i) => ({ id: i, camera: null })));
      }
    }
  }, [cameras]); // Solo cuando las cámaras estén disponibles

  // Guardar vista en localStorage cuando cambie el estado
  useEffect(() => {
    if (gridCells.length > 0) {
      // Debounce para evitar guardado excesivo
      const saveTimeout = setTimeout(() => {
        saveViewToLocalStorage();
      }, 1000);
      
      return () => clearTimeout(saveTimeout);
    }
  }, [layout, gridCells, hdCameraId]); // Guardar cuando cambie cualquier estado relevante

  // Escuchar eventos de carga de vista guardada
  useEffect(() => {
    const handleLoadSavedView = (event: CustomEvent) => {
      const view = event.detail;
      console.log('LiveView received load view event:', view);
      console.log('Raw cameras data:', view.cameras);
      console.log('Type of cameras:', typeof view.cameras);
      console.log('View layout:', view.layout);
      console.log('Current layout before change:', layout);
      
      setIsLoadingView(true);
      
      try {
        // Parsear la configuración de cámaras guardadas si es necesario
        let savedCameras;
        if (typeof view.cameras === 'string') {
          savedCameras = JSON.parse(view.cameras);
        } else if (Array.isArray(view.cameras)) {
          savedCameras = view.cameras;
        } else {
          console.error('Invalid cameras format:', view.cameras);
          throw new Error('Formato de cámaras inválido');
        }
        
        console.log('Parsed savedCameras:', savedCameras);
        console.log('Number of saved cameras:', savedCameras.length);
        console.log('Available cameras for matching:', cameras.map(c => ({ id: c.id, name: c.name })));
        
        // Verificar si el layout guardado puede acomodar todas las cámaras
        const requiredCells = savedCameras.length;
        const savedLayoutSize = getGridSize(view.layout);
        
        if (requiredCells > savedLayoutSize) {
          console.warn(`Saved view has ${requiredCells} cameras but layout ${view.layout} only supports ${savedLayoutSize} cells`);
          
          // Sugerir un layout más grande si es necesario
          let suggestedLayout = view.layout;
          if (requiredCells <= 4) suggestedLayout = '2x2';
          else if (requiredCells <= 6) suggestedLayout = '2x3';
          else if (requiredCells <= 9) suggestedLayout = '3x3';
          else if (requiredCells <= 16) suggestedLayout = '4x4';
          
          if (suggestedLayout !== view.layout) {
            console.log(`Auto-adjusting layout from ${view.layout} to ${suggestedLayout} to accommodate ${requiredCells} cameras`);
            view.layout = suggestedLayout;
          }
        }
        
        setLayout(view.layout);
        
        // Actualizar las celdas del grid con las cámaras guardadas
        const totalCells = getGridSize(view.layout);
        const newCells: GridCell[] = Array.from({ length: totalCells }, (_, index) => {
          // Buscar cámara para esta posición - manejar diferentes formatos
          let savedCamera;
          if (savedCameras.length > 0 && typeof savedCameras[0] === 'object' && 'position' in savedCameras[0]) {
            // Formato nuevo: array de objetos con position y camera_id
            savedCamera = savedCameras.find((c: any) => c.position === index);
          } else {
            // Formato viejo: array directo de cámaras por índice
            savedCamera = savedCameras[index];
          }
          
          let camera = null;
          
          console.log(`Position ${index}:`, savedCamera);
          
          if (savedCamera) {
            if (savedCamera.camera_id) {
              // Formato nuevo
              camera = cameras.find(c => c.id === savedCamera.camera_id) || null;
            } else if (savedCamera.id) {
              // Formato viejo - cámara directa
              camera = cameras.find(c => c.id === savedCamera.id) || null;
            }
            console.log(`Found camera for position ${index}:`, camera?.name || 'null');
          }
          
          return {
            id: index,
            camera: camera,
          };
        });
        
        console.log('Final newCells:', newCells);
        setGridCells(newCells);
        
        // Calcular delays para carga secuencial - solo para cámaras que existen
        const delays: Record<number, number> = {};
        let delayIndex = 0;
        newCells.forEach((cell) => {
          if (cell.camera) {
            // Reducir delay a 1 segundo para mejor experiencia de usuario
            delays[cell.id] = delayIndex * 1000; // 1 segundo entre cada stream
            delayIndex++;
          }
        });
        
        console.log('Stream delays calculated:', delays);
        console.log(`Total cameras to load: ${delayIndex}, estimated load time: ${delayIndex} seconds`);
        setStreamDelays(delays);
        
        // Limpiar el flag de loading después de que todos los snapshots hayan tenido tiempo de cargar
        // Tiempo basado en número de cámaras: mínimo 2s, máximo 15s
        const loadingTimeout = Math.min(Math.max(delayIndex * 1000 + 2000, 2000), 15000);
        setTimeout(() => {
          setIsLoadingView(false);
          console.log(`View loading completed after ${loadingTimeout}ms`);
        }, loadingTimeout);
        
        toast({
          title: translate_live('toast.view_loaded.title'),
          description: translate_live('toast.view_loaded.description', { count: delayIndex }),
          duration: 3000,
          variant: "default"
        });
      } catch (error) {
        console.error('Error loading saved view:', error);
        setIsLoadingView(false);
        toast({
          title: translate_live('toast.error.title'),
          description: translate_live('toast.load_saved_error'),
          variant: "destructive"
        });
      }
    };

        // Escuchar eventos de carga de vista
    window.addEventListener('loadSavedView', handleLoadSavedView as any);
    
    // Escuchar solicitudes de guardar vista desde el sidebar
    const handleSaveRequest = (event: Event) => {
      const customEvent = event as CustomEvent;
      const viewName = customEvent.detail.name;
      
      // Llamar a la función local handleSaveView
      handleSaveView(viewName);
    };
    
    window.addEventListener('requestSaveView', handleSaveRequest);
    
    return () => {
      window.removeEventListener('loadSavedView', handleLoadSavedView as any);
      window.removeEventListener('requestSaveView', handleSaveRequest);
    };
  }, [toast]);

  const getGridSize = (layout: LayoutKey): number => {
    switch (layout) {
      case '1x1': return 1;   // Single/Full screen
      case '2x2': return 4;   // Quad
      case '3x3': return 9;   // 9 divisiones
      case '4x4': return 16;  // 16 divisiones
      case '5x5': return 25;  // 25 divisiones
      case '6x6': return 36;  // 36 divisiones
      default: return 4;
    }
  };

  useEffect(() => {
    const size = getGridSize(layout);
    // Preserve existing cameras when resizing grid
    setGridCells(currentCells => {
      const newCells: GridCell[] = Array.from({ length: size }, (_, i) => ({ id: i, camera: null }));
      currentCells.forEach((cell, index) => {
        if (cell.camera && index < size) {
          newCells[index] = { ...newCells[index], camera: cell.camera };
        }
      });
      return newCells;
    });
  }, [layout]);
  
  // Enviar actualizaciones de FPS activos y ancho de banda al sidebar (optimizado)
  useEffect(() => {
    // Calcular FPS total sumando todos los FPS activos
    const totalFps = Array.from(activeFpsMap.values()).reduce((sum, fps) => sum + fps, 0);
    
    // Calcular ancho de banda estimado basado en FPS total (aprox. 10KB por frame)
    const estimatedBandwidth = totalFps * 10; // KB/s basado en FPS
    let bandwidthString = '0 KB/s';
    
    if (estimatedBandwidth >= 1024) {
      bandwidthString = `${(estimatedBandwidth / 1024).toFixed(1)} MB/s`;
    } else if (estimatedBandwidth > 0) {
      bandwidthString = `${estimatedBandwidth} KB/s`;
    }

    // Solo enviar eventos si los valores han cambiado
    if (totalFps !== lastTotalFps) {
      const activeFpsEvent = new CustomEvent('activeFramesUpdate', {
        detail: { count: totalFps }
      });
      window.dispatchEvent(activeFpsEvent);
      setLastTotalFps(totalFps);
    }
    
    if (bandwidthString !== lastBandwidth) {
      const bandwidthEvent = new CustomEvent('bandwidthUpdate', {
        detail: { bandwidth: bandwidthString }
      });
      window.dispatchEvent(bandwidthEvent);
      setLastBandwidth(bandwidthString);
    }
  }, [activeFpsMap, lastTotalFps, lastBandwidth]);
  
  const handleLayoutChange = (newLayout: LayoutKey) => {
    setLayout(newLayout);
  };

  const handleRemoveCamera = (cameraId: string) => {
    setGridCells(currentCells => currentCells.map(cell => 
        cell.camera?.id === cameraId ? { ...cell, camera: null } : cell
    ));
    // Limpiar delays cuando se modifican cámaras manualmente
    setStreamDelays({});
    // Si removemos la cámara HD, limpiar el estado
    if (hdCameraId === cameraId) {
      setHdCameraId(null);
    }
  };
  
  // Función para cambiar calidad de una cámara
  const handleQualitySwitch = (cameraId: string, newQuality: 'sub' | 'main') => {
    if (newQuality === 'main') {
      // Si queremos HD, verificar que no haya otra cámara en HD
      if (hdCameraId && hdCameraId !== cameraId) {
        toast({
          title: translate_live('toast.hd_limit.title'),
          description: translate_live('toast.hd_limit.description'),
          variant: "default"
        });
        // Notificar a la cámara anterior que debe cambiar a SD
        window.dispatchEvent(new CustomEvent('forceQualityChange', {
          detail: { cameraId: hdCameraId, quality: 'sub' }
        }));
      }
      setHdCameraId(cameraId);
    } else {
      // Si cambiamos a SD, limpiar el estado HD si es esta cámara
      if (hdCameraId === cameraId) {
        setHdCameraId(null);
      }
    }
    
    // Notificar a la cámara que debe cambiar calidad
    window.dispatchEvent(new CustomEvent('forceQualityChange', {
      detail: { cameraId, quality: newQuality }
    }));
  };

  // Función para manejar cambios de FPS de las cámaras
  const handleFpsChange = useCallback((cameraId: string, fps: number) => {
    setActiveFpsMap(prev => {
      const newMap = new Map(prev);
      if (fps > 0) {
        newMap.set(cameraId, fps);
      } else {
        newMap.delete(cameraId);
      }
      return newMap;
    });
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;
    
    console.log('Drag end:', { over, active }); // Debug log
    
    if (!over) return;
    
    const camera = active.data.current?.camera as Camera;
    if (!camera) return;

    const targetCellId = parseInt(over.id.toString().replace('cell-', ''), 10);

    setGridCells(currentCells => {
      const newCells = [...currentCells];
      const targetCellIndex = newCells.findIndex(c => c.id === targetCellId);
      if (targetCellIndex === -1) return currentCells;

      const sourceOrigin = active.data.current?.from;
      const sourceCellId = active.data.current?.gridCellId;

      console.log('Drag details:', { sourceOrigin, sourceCellId, targetCellId, camera }); // Debug log

      // Check if this camera is already in the grid
      const existingCameraIndex = newCells.findIndex(c => c.camera?.id === camera.id);

      if (sourceOrigin === 'grid') { // Moving a camera within the grid
        const sourceCellIndex = newCells.findIndex(c => c.id === sourceCellId);
        if (sourceCellIndex !== -1) {
            // Swap cameras
            const sourceCamera = newCells[sourceCellIndex].camera;
            const targetCamera = newCells[targetCellIndex].camera;
            newCells[targetCellIndex] = { ...newCells[targetCellIndex], camera: sourceCamera };
            newCells[sourceCellIndex] = { ...newCells[sourceCellIndex], camera: targetCamera };
        }
      } else { // Dragging from sidebar
        if (existingCameraIndex !== -1) {
            // If camera exists, swap with target
            const targetCamera = newCells[targetCellIndex].camera;
            newCells[targetCellIndex] = { ...newCells[targetCellIndex], camera: camera };
            newCells[existingCameraIndex] = { ...newCells[existingCameraIndex], camera: targetCamera };
        } else {
            // If camera doesn't exist, place it, displacing the existing one if any
            newCells[targetCellIndex] = { ...newCells[targetCellIndex], camera: camera };
        }
      }
      
      console.log('New grid state:', newCells); // Debug log
      // Limpiar delays cuando se hace drag and drop
      setStreamDelays({});
      return newCells;
    });
  };

  const handleSaveView = async (viewName: string) => {
    try {
      const viewData = {
        name: viewName,
        layout,
        cameras: gridCells.map((cell, index) => ({ 
          position: index, 
          camera_id: cell.camera?.id || null 
        })).filter(c => c.camera_id)
      };
      
      console.log('Saving view with data:', viewData);
      console.log('GridCells state:', gridCells);
      
      const response = await fetch('/api/views', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(viewData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save view');
      }
      
      const savedView = await response.json();
      
      toast({
        title: translate_live('toast.view_saved.title'),
        description: translate_live('toast.view_saved.description', { name: viewName }),
      });
      
      console.log("View saved:", savedView);
      
      // Notificar al sidebar que se guardó una nueva vista
      const saveViewEvent = new CustomEvent('viewSaved', { 
        detail: savedView
      });
      window.dispatchEvent(saveViewEvent);
    } catch (error) {
      toast({
        title: translate_live('toast.error.title'),
        description: translate_live('toast.view_saved_error'),
        variant: "destructive",
      });
      console.error("Error saving view:", error);
    }
  };

  /**
   * Manejar la carga de vista desde Layout Manager
   */
  const handleLoadView = (view: any) => {
    try {
      // Cambiar layout si es diferente
      if (view.layout !== layout) {
        setLayout(view.layout);
      }

      // Preparar las cámaras guardadas
      let saved_cameras = view.cameras;
      if (typeof saved_cameras === 'string') {
        saved_cameras = JSON.parse(saved_cameras);
      }

      // Aplicar configuración de cámaras
      const view_grid_size = getGridSize(view.layout);
      const new_grid_cells = Array.from({ length: view_grid_size }, (_, index) => {
        const saved_cell = saved_cameras.find((c: any) => c.id === index || c.position === index);
        
        // Buscar la cámara por ID si existe
        let camera = null;
        if (saved_cell && (saved_cell.camera?.id || saved_cell.camera_id)) {
          const camera_id = saved_cell.camera?.id || saved_cell.camera_id;
          camera = cameras.find(cam => cam.id === camera_id) || null;
        }
        
        return {
          id: index,
          camera: camera
        };
      });

      setGridCells(new_grid_cells);
      saveViewToLocalStorage();

      toast({
        title: translate_live('toast.view_loaded.title'),
        description: translate_live('toast.view_loaded_confirm', { name: view.name }),
      });
    } catch (error) {
      console.error('Error loading view:', error);
      toast({
        title: translate_live('toast.error.title'),
        description: translate_live('toast.view_load_error'),
        variant: "destructive"
      });
    }
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full w-full overflow-hidden">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between flex-shrink-0 px-1 py-1">
              <h1 className="font-headline text-lg sm:text-2xl font-bold tracking-tight">{translate_live('heading')}</h1>
              <div className="flex items-center gap-1 sm:gap-2">
                  <LayoutManager
                    current_layout={layout}
                    current_cameras={gridCells}
                    on_layout_change={(new_layout) => handleLayoutChange(new_layout as LayoutKey)}
                    on_save_view={handleSaveView}
                    on_load_view={handleLoadView}
                  >
                    <Button variant="outline" size="sm" className="text-xs sm:text-sm">
                        <Settings2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Layout Manager</span>
                        <span className="sm:hidden">Layouts</span>
                    </Button>
                  </LayoutManager>
                  <div className="flex items-center gap-1 sm:gap-2">
                      <LayoutGrid className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                      <Select value={layout} onValueChange={(value) => handleLayoutChange(value as LayoutKey)}>
                          <SelectTrigger className="w-[80px] sm:w-[100px] h-7 sm:h-8 text-xs sm:text-sm">
                              <SelectValue placeholder="Grid" />
                          </SelectTrigger>
                          <SelectContent>
                              {Object.keys(layoutDefinitions).map(key => (
                                  <SelectItem key={key} value={key} className="text-xs sm:text-sm">{key.replace('x', '×')}</SelectItem>
                              ))} 
                          </SelectContent>
                      </Select>
                  </div>
              </div>
        </div>

        <div className="flex-1 w-full overflow-hidden">
          <motion.div 
            className={cn('grid gap-0.5 w-full h-full p-0.5 content-start', layoutDefinitions[layout].template)}
            style={{
              height: '100%', // Usar toda la altura disponible
              maxHeight: '100%' // No exceder la altura del contenedor
            }}
            layout
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <AnimatePresence>
              {gridCells.map(cell => (
                <DroppableCell key={cell.id} cell={cell} onRemove={handleRemoveCamera} onFpsChange={handleFpsChange}>
                  {cell.camera ? (
                    <CameraFeed 
                      camera={cell.camera} 
                      onRemove={handleRemoveCamera} 
                      gridCellId={cell.id} 
                      streamDelay={streamDelays[cell.id] || 0}
                      onQualitySwitch={handleQualitySwitch}
                      isHdCamera={hdCameraId === cell.camera.id}
                      onFpsChange={handleFpsChange}
                    />
                  ) : (
                    <span className="text-sm text-muted-foreground">Drop camera here</span>
                  )}
                </DroppableCell>
              ))}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Botón flotante para maximizar grilla completa */}
        <div className="fixed bottom-4 right-4 z-50">
          <Button 
            variant="default" 
            size="icon" 
            className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-black/70 hover:bg-green-600 text-white"
            onClick={() => setIsGridFullscreen(true)}
            title={translate_live('fullscreen.maximize_grid')}
          >
            <Maximize2 className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {/* Modal de grilla en pantalla completa */}
      <Dialog open={isGridFullscreen} onOpenChange={setIsGridFullscreen}>
        <DialogContent className="p-0 sm:max-w-[100vw] md:max-w-[100vw] lg:max-w-[100vw] border-0 bg-black max-h-[100vh] w-full h-full">
          <DialogHeader className="absolute top-2 left-2 z-10 bg-black/70 p-3 rounded-lg">
            <DialogTitle className="text-white text-lg">{translate_live('fullscreen.title')}</DialogTitle>
          </DialogHeader>
          
          {/* Botón de salir en pantalla completa */}
          <div className="absolute top-2 right-2 z-10">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 bg-black/70 hover:bg-red-600 text-white hover:text-white backdrop-blur-sm rounded" 
              onClick={() => setIsGridFullscreen(false)}
              title={translate_live('fullscreen.exit')}
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Grilla completa en fullscreen */}
          <div className="w-full h-full bg-black p-4">
            <motion.div 
              className={cn('grid gap-4 h-full w-full', layoutDefinitions[layout].template)}
              layout
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {gridCells.map(cell => (
                <div key={cell.id} className="relative">
                  {cell.camera ? (
                    <CameraFeed 
                      camera={cell.camera} 
                      onRemove={handleRemoveCamera} 
                      gridCellId={cell.id} 
                      streamDelay={streamDelays[cell.id] || 0}
                      onQualitySwitch={handleQualitySwitch}
                      isHdCamera={hdCameraId === cell.camera.id}
                      onFpsChange={handleFpsChange}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 text-sm">
                      {translate_live('grid.empty_cell')}
                    </div>
                  )}
                </div>
              ))}
            </motion.div>

            {/* Botón flotante de salida en esquina inferior derecha */}
            <div className="fixed bottom-4 right-4 z-50">
              <Button 
                variant="default" 
                size="icon" 
                className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-black/70 hover:bg-red-600 text-white"
                onClick={() => setIsGridFullscreen(false)}
                title={translate_live('fullscreen.exit')}
              >
                <Minimize2 className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}



