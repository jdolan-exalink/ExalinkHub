"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Camera } from '@/lib/types';
import { useDroppable, type DragEndEvent } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { useDragContext } from '@/contexts/drag-context';
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
import { LayoutGrid, Maximize2, Minimize2, Settings2, X, Save } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import SimpleViewEditor from '@/components/ui/simple-view-editor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const gridLayouts = {
  '1x1': 'grid-cols-1 grid-rows-1',        // Single/Full screen
  '2x2': 'grid-cols-2 grid-rows-2',        // Quad - 4 divisiones
  '3x3': 'grid-cols-3 grid-rows-3',        // 9 divisiones
  '4x4': 'grid-cols-4 grid-rows-4',        // 16 divisiones
  '5x5': 'grid-cols-5 grid-rows-5',        // 25 divisiones  
  '6x6': 'grid-cols-6 grid-rows-6',        // 36 divisiones
  '1+5': 'mosaic-layout-6',                 // Mosaic 1+5 (1 grande + 5 pequeñas)
  '1+12': 'mosaic-layout-13',               // Mosaic 1+12 (1 grande + 12 pequeñas)
};

type GridCell = {
  id: number;
  camera: Camera | null;
};

type LiveViewProps = {
  cameras: Camera[];
};

function DroppableCell({ cell, onRemove, onFpsChange, children }: { 
  cell: GridCell, 
  onRemove: (cameraId: string) => void, 
  onFpsChange?: (cameraId: string, fps: number) => void,
  children: React.ReactNode 
}) {
  const { isOver, setNodeRef, active } = useDroppable({
    id: `cell-${cell.id}`,
  });

  // Determinar el tipo de operación de drag
  const dragType = active?.data.current?.type;
  const isServerDrag = dragType === 'server';
  const isCameraDrag = dragType === 'camera';

  if (isOver) {
    console.log(`DroppableCell ${cell.id} - isOver detected:`, {
      dragType,
      isServerDrag,
      isCameraDrag,
      activeData: active?.data.current
    });
  }

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
          "bg-secondary/20 flex items-center justify-center relative transition-all duration-300 border-2 border-dashed w-full",
          "grid-cell-16x9 camera-container", // Clases CSS personalizadas para 16:9
          isOver && isCameraDrag && "ring-4 ring-primary ring-inset bg-primary/20 border-primary scale-[1.02] shadow-lg shadow-primary/20",
          isOver && isServerDrag && "ring-4 ring-blue-500 ring-inset bg-blue-500/20 border-blue-500 scale-[1.02] shadow-lg shadow-blue-500/20",
          cell.camera ? "border-border bg-card" : "border-muted-foreground/30 hover:border-primary/50 hover:bg-secondary/40"
        )}
        style={{
          aspectRatio: '16/9' // Garantizar 16:9 en todos los navegadores
        }}
      >
        {/* Indicador visual para drop de servidor */}
        {isOver && isServerDrag && (
          <div className="absolute inset-0 flex items-center justify-center bg-blue-500/10 z-10 pointer-events-none">
            <div className="text-blue-600 text-xs font-medium bg-blue-100 px-2 py-1 rounded-md shadow-sm">
              Servidor: {active?.data.current?.server?.name}
            </div>
          </div>
        )}
        
        {/* Indicador visual para drop de cámara */}
        {isOver && isCameraDrag && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/10 z-10 pointer-events-none">
            <div className="text-primary text-xs font-medium bg-background px-2 py-1 rounded-md shadow-sm">
              {active?.data.current?.camera?.name}
            </div>
          </div>
        )}

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
                "text-4xl mb-2 transition-all duration-300",
                isOver ? "text-primary scale-110 animate-bounce" : "text-muted-foreground/50"
              )}>
                📹
              </div>
              <span className={cn(
                "text-sm font-medium transition-all duration-300",
                isOver ? "text-primary font-bold scale-105" : "text-muted-foreground"
              )}>
                {isOver ? "¡Soltar aquí!" : "Arrastra una cámara"}
              </span>
              {isOver && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-2 text-xs text-primary/70 font-medium"
                >
                  Iniciará streaming automáticamente
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}


// Componente para layouts mosaic con celdas de diferente tamaño
function MosaicLayout({ 
  layout, 
  gridCells, 
  onRemoveCamera, 
  onFpsChange, 
  streamDelays, 
  hdCameraId, 
  onQualitySwitch 
}: {
  layout: string;
  gridCells: GridCell[];
  onRemoveCamera: (cameraId: string) => void;
  onFpsChange?: (cameraId: string, fps: number) => void;
  streamDelays: Record<number, number>;
  hdCameraId: string | null;
  onQualitySwitch: (cameraId: string, newQuality: 'sub' | 'main') => void;
}) {
  const isMosaic6 = layout === '1+5';
  const isMosaic13 = layout === '1+12';

  return (
    <div className="w-full h-full p-0.5">
      {isMosaic6 ? (
        // Layout Mosaic 1+5: Cámara grande arriba-izquierda + 5 pequeñas llenando el resto
        <div className="grid grid-cols-3 grid-rows-3 gap-0.5 h-full">
          {/* Celda grande (posición 0) - ocupa 2x2 en esquina superior izquierda */}
          <motion.div
            className="col-span-2 row-span-2"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            layout
          >
            <DroppableCell 
              cell={gridCells[0] || { id: 0, camera: null }} 
              onRemove={onRemoveCamera} 
              onFpsChange={onFpsChange}
            >
              {gridCells[0]?.camera ? (
                <CameraFeed 
                  camera={gridCells[0].camera} 
                  onRemove={onRemoveCamera} 
                  gridCellId={0} 
                  streamDelay={streamDelays[0] || 0}
                  onQualitySwitch={onQualitySwitch}
                  isHdCamera={hdCameraId === gridCells[0].camera.id}
                  onFpsChange={onFpsChange}
                />
              ) : (
                <span className="text-sm text-muted-foreground">Cámara principal</span>
              )}
            </DroppableCell>
          </motion.div>

          {/* Celda 1: Superior derecha */}
          <motion.div
            className="col-span-1 row-span-1 col-start-3 row-start-1"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: 0.1 }}
            layout
          >
            <DroppableCell 
              cell={gridCells[1] || { id: 1, camera: null }} 
              onRemove={onRemoveCamera} 
              onFpsChange={onFpsChange}
            >
              {gridCells[1]?.camera ? (
                <CameraFeed 
                  camera={gridCells[1].camera} 
                  onRemove={onRemoveCamera} 
                  gridCellId={1} 
                  streamDelay={streamDelays[1] || 0}
                  onQualitySwitch={onQualitySwitch}
                  isHdCamera={hdCameraId === gridCells[1].camera.id}
                  onFpsChange={onFpsChange}
                />
              ) : (
                <span className="text-xs text-muted-foreground">Cam 1</span>
              )}
            </DroppableCell>
          </motion.div>

          {/* Celda 2: Media derecha */}
          <motion.div
            className="col-span-1 row-span-1 col-start-3 row-start-2"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: 0.2 }}
            layout
          >
            <DroppableCell 
              cell={gridCells[2] || { id: 2, camera: null }} 
              onRemove={onRemoveCamera} 
              onFpsChange={onFpsChange}
            >
              {gridCells[2]?.camera ? (
                <CameraFeed 
                  camera={gridCells[2].camera} 
                  onRemove={onRemoveCamera} 
                  gridCellId={2} 
                  streamDelay={streamDelays[2] || 0}
                  onQualitySwitch={onQualitySwitch}
                  isHdCamera={hdCameraId === gridCells[2].camera.id}
                  onFpsChange={onFpsChange}
                />
              ) : (
                <span className="text-xs text-muted-foreground">Cam 2</span>
              )}
            </DroppableCell>
          </motion.div>

          {/* Celda 3: Inferior izquierda */}
          <motion.div
            className="col-span-1 row-span-1 col-start-1 row-start-3"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: 0.3 }}
            layout
          >
            <DroppableCell 
              cell={gridCells[3] || { id: 3, camera: null }} 
              onRemove={onRemoveCamera} 
              onFpsChange={onFpsChange}
            >
              {gridCells[3]?.camera ? (
                <CameraFeed 
                  camera={gridCells[3].camera} 
                  onRemove={onRemoveCamera} 
                  gridCellId={3} 
                  streamDelay={streamDelays[3] || 0}
                  onQualitySwitch={onQualitySwitch}
                  isHdCamera={hdCameraId === gridCells[3].camera.id}
                  onFpsChange={onFpsChange}
                />
              ) : (
                <span className="text-xs text-muted-foreground">Cam 3</span>
              )}
            </DroppableCell>
          </motion.div>

          {/* Celda 4: Inferior centro */}
          <motion.div
            className="col-span-1 row-span-1 col-start-2 row-start-3"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: 0.4 }}
            layout
          >
            <DroppableCell 
              cell={gridCells[4] || { id: 4, camera: null }} 
              onRemove={onRemoveCamera} 
              onFpsChange={onFpsChange}
            >
              {gridCells[4]?.camera ? (
                <CameraFeed 
                  camera={gridCells[4].camera} 
                  onRemove={onRemoveCamera} 
                  gridCellId={4} 
                  streamDelay={streamDelays[4] || 0}
                  onQualitySwitch={onQualitySwitch}
                  isHdCamera={hdCameraId === gridCells[4].camera.id}
                  onFpsChange={onFpsChange}
                />
              ) : (
                <span className="text-xs text-muted-foreground">Cam 4</span>
              )}
            </DroppableCell>
          </motion.div>

          {/* Celda 5: Inferior derecha */}
          <motion.div
            className="col-span-1 row-span-1 col-start-3 row-start-3"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2, delay: 0.5 }}
            layout
          >
            <DroppableCell 
              cell={gridCells[5] || { id: 5, camera: null }} 
              onRemove={onRemoveCamera} 
              onFpsChange={onFpsChange}
            >
              {gridCells[5]?.camera ? (
                <CameraFeed 
                  camera={gridCells[5].camera} 
                  onRemove={onRemoveCamera} 
                  gridCellId={5} 
                  streamDelay={streamDelays[5] || 0}
                  onQualitySwitch={onQualitySwitch}
                  isHdCamera={hdCameraId === gridCells[5].camera.id}
                  onFpsChange={onFpsChange}
                />
              ) : (
                <span className="text-xs text-muted-foreground">Cam 5</span>
              )}
            </DroppableCell>
          </motion.div>
        </div>
      ) : isMosaic13 ? (
        // Layout Mosaic 1+12: Cámara grande arriba-izquierda + 12 pequeñas llenando todo el resto
        <div className="grid grid-cols-4 grid-rows-4 gap-0.5 h-full">
          {/* Celda grande (posición 0) - ocupa 2x2 en esquina superior izquierda */}
          <motion.div
            className="col-span-2 row-span-2 col-start-1 row-start-1"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            layout
          >
            <DroppableCell 
              cell={gridCells[0] || { id: 0, camera: null }} 
              onRemove={onRemoveCamera} 
              onFpsChange={onFpsChange}
            >
              {gridCells[0]?.camera ? (
                <CameraFeed 
                  camera={gridCells[0].camera} 
                  onRemove={onRemoveCamera} 
                  gridCellId={0} 
                  streamDelay={streamDelays[0] || 0}
                  onQualitySwitch={onQualitySwitch}
                  isHdCamera={hdCameraId === gridCells[0].camera.id}
                  onFpsChange={onFpsChange}
                />
              ) : (
                <span className="text-sm text-muted-foreground">Cámara principal</span>
              )}
            </DroppableCell>
          </motion.div>

          {/* 12 celdas pequeñas llenando todo el espacio restante */}
          {/* Fila 1 - columnas 3 y 4 */}
          {[1, 2].map((cellIndex) => (
            <motion.div
              key={cellIndex}
              className={`col-span-1 row-span-1 col-start-${cellIndex + 2} row-start-1`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: cellIndex * 0.05 }}
              layout
            >
              <DroppableCell 
                cell={gridCells[cellIndex] || { id: cellIndex, camera: null }} 
                onRemove={onRemoveCamera} 
                onFpsChange={onFpsChange}
              >
                {gridCells[cellIndex]?.camera ? (
                  <CameraFeed 
                    camera={gridCells[cellIndex].camera} 
                    onRemove={onRemoveCamera} 
                    gridCellId={cellIndex} 
                    streamDelay={streamDelays[cellIndex] || 0}
                    onQualitySwitch={onQualitySwitch}
                    isHdCamera={hdCameraId === gridCells[cellIndex].camera.id}
                    onFpsChange={onFpsChange}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Cam {cellIndex}</span>
                )}
              </DroppableCell>
            </motion.div>
          ))}

          {/* Fila 2 - columnas 3 y 4 */}
          {[3, 4].map((cellIndex) => (
            <motion.div
              key={cellIndex}
              className={`col-span-1 row-span-1 col-start-${cellIndex - 2 + 2} row-start-2`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: cellIndex * 0.05 }}
              layout
            >
              <DroppableCell 
                cell={gridCells[cellIndex] || { id: cellIndex, camera: null }} 
                onRemove={onRemoveCamera} 
                onFpsChange={onFpsChange}
              >
                {gridCells[cellIndex]?.camera ? (
                  <CameraFeed 
                    camera={gridCells[cellIndex].camera} 
                    onRemove={onRemoveCamera} 
                    gridCellId={cellIndex} 
                    streamDelay={streamDelays[cellIndex] || 0}
                    onQualitySwitch={onQualitySwitch}
                    isHdCamera={hdCameraId === gridCells[cellIndex].camera.id}
                    onFpsChange={onFpsChange}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Cam {cellIndex}</span>
                )}
              </DroppableCell>
            </motion.div>
          ))}

          {/* Fila 3 - todas las columnas */}
          {[5, 6, 7, 8].map((cellIndex) => (
            <motion.div
              key={cellIndex}
              className={`col-span-1 row-span-1 col-start-${cellIndex - 4} row-start-3`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: cellIndex * 0.05 }}
              layout
            >
              <DroppableCell 
                cell={gridCells[cellIndex] || { id: cellIndex, camera: null }} 
                onRemove={onRemoveCamera} 
                onFpsChange={onFpsChange}
              >
                {gridCells[cellIndex]?.camera ? (
                  <CameraFeed 
                    camera={gridCells[cellIndex].camera} 
                    onRemove={onRemoveCamera} 
                    gridCellId={cellIndex} 
                    streamDelay={streamDelays[cellIndex] || 0}
                    onQualitySwitch={onQualitySwitch}
                    isHdCamera={hdCameraId === gridCells[cellIndex].camera.id}
                    onFpsChange={onFpsChange}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Cam {cellIndex}</span>
                )}
              </DroppableCell>
            </motion.div>
          ))}

          {/* Fila 4 - todas las columnas */}
          {[9, 10, 11, 12].map((cellIndex) => (
            <motion.div
              key={cellIndex}
              className={`col-span-1 row-span-1 col-start-${cellIndex - 8} row-start-4`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: cellIndex * 0.05 }}
              layout
            >
              <DroppableCell 
                cell={gridCells[cellIndex] || { id: cellIndex, camera: null }} 
                onRemove={onRemoveCamera} 
                onFpsChange={onFpsChange}
              >
                {gridCells[cellIndex]?.camera ? (
                  <CameraFeed 
                    camera={gridCells[cellIndex].camera} 
                    onRemove={onRemoveCamera} 
                    gridCellId={cellIndex} 
                    streamDelay={streamDelays[cellIndex] || 0}
                    onQualitySwitch={onQualitySwitch}
                    isHdCamera={hdCameraId === gridCells[cellIndex].camera.id}
                    onFpsChange={onFpsChange}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">Cam {cellIndex}</span>
                )}
              </DroppableCell>
            </motion.div>
          ))}
        </div>
      ) : null}
    </div>
  );
}


export default function LiveView({ cameras }: { cameras: Camera[] }) {
  const { toast } = useToast();
  const dragContext = useDragContext();
  const [layout, setLayout] = useState<keyof typeof gridLayouts>('2x2'); // Cambiar por defecto a 2x2
  const [gridCells, setGridCells] = useState<GridCell[]>([]);
  const [isLoadingView, setIsLoadingView] = useState(false); // Para vistas guardadas
  const [streamDelays, setStreamDelays] = useState<Record<number, number>>({}); // Delays por celda
  const [hdCameraId, setHdCameraId] = useState<string | null>(null); // Solo 1 cámara en HD
  const [activeFpsMap, setActiveFpsMap] = useState<Map<string, number>>(new Map()); // Track FPS per camera
  const [lastTotalFps, setLastTotalFps] = useState<number>(0); // Para evitar actualizaciones innecesarias
  const [lastBandwidth, setLastBandwidth] = useState<string>('0 KB/s'); // Para evitar actualizaciones innecesarias
  const [isGridFullscreen, setIsGridFullscreen] = useState(false); // Estado para pantalla completa de grilla
  const [showSaveDialog, setShowSaveDialog] = useState(false); // Dialog para guardar vista
  const [newViewName, setNewViewName] = useState(''); // Nombre de la nueva vista
  const [isSavingView, setIsSavingView] = useState(false); // Estado de guardado

  /**
   * Activa el modo pantalla completa del navegador (equivalente a presionar F11).
   * Esta función utiliza la Fullscreen API del navegador para maximizar la ventana completa.
   * Compatible con navegadores modernos que soportan requestFullscreen().
   */
  const request_fullscreen = () => {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen();
    }
  };

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
            title: "Vista restaurada",
            description: `Configuración recuperada: ${restoredCells.filter(c => c.camera !== null).length} cámaras en layout ${viewState.layout}`,
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
              title: "Cámara ya en vista", 
              description: `${camera.name} ya está en el grid.`, 
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
            title: "Grid lleno", 
            description: "No hay celdas vacías disponibles para añadir la cámara.", 
            variant: 'destructive' 
          });
        }, 0);
        return currentCells;
      }
    });
  };

  /**
   * Función para agregar múltiples cámaras al layout
   * Útil cuando se arrastra un servidor completo
   */
  const addMultipleCamerasToGrid = (camerasToAdd: Camera[], startFromIndex: number = 0) => {
    console.log('addMultipleCamerasToGrid called with:', camerasToAdd.length, 'cameras, starting from index:', startFromIndex);
    setGridCells(currentCells => {
      const newCells = [...currentCells];
      const availableSlots = newCells.length;
      let addedCount = 0;
      
      console.log('Current grid has', availableSlots, 'slots');
      
      // Filtrar cámaras que no estén ya en el grid
      const uniqueCameras = camerasToAdd.filter(camera => 
        !newCells.some(cell => cell.camera?.id === camera.id)
      );
      
      console.log('Unique cameras to add:', uniqueCameras.length, uniqueCameras.map(c => c.name));
      
      // Colocar cámaras empezando desde el índice especificado
      uniqueCameras.forEach((camera, idx) => {
        const targetIndex = (startFromIndex + idx) % availableSlots;
        if (targetIndex < availableSlots) {
          newCells[targetIndex] = { ...newCells[targetIndex], camera: camera };
          addedCount++;
          console.log(`Placed camera ${camera.name} at index ${targetIndex}`);
        }
      });
      
      console.log(`Added ${addedCount} cameras to grid`);
      return newCells;
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
          title: "Vista cargada",
          description: `${delayIndex} cámaras cargándose. Tiempo estimado: ${delayIndex} segundos.`,
          duration: 3000,
          variant: "default"
        });
      } catch (error) {
        console.error('Error loading saved view:', error);
        setIsLoadingView(false);
        toast({
          title: "Error",
          description: "No se pudo cargar la vista guardada.",
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
    
    // Escuchar eventos de doble-click en servidores
    const handleAddServerToGrid = (event: Event) => {
      console.log('handleAddServerToGrid called with event:', event);
      const customEvent = event as CustomEvent;
      const { server, cameras } = customEvent.detail;
      
      console.log('Adding server to grid:', server.name, 'cameras:', cameras.length);
      
      // Usar la función existente para agregar múltiples cámaras
      addMultipleCamerasToGrid(cameras, 0);
      
      // Mostrar notificación
      setTimeout(() => {
        toast({
          title: "Servidor agregado",
          description: `${cameras.length} cámaras de ${server.name} agregadas al layout`,
          duration: 4000,
        });
      }, 100);
    };
    
    window.addEventListener('addServerToGrid', handleAddServerToGrid);
    
    return () => {
      window.removeEventListener('loadSavedView', handleLoadSavedView as any);
      window.removeEventListener('requestSaveView', handleSaveRequest);
      window.removeEventListener('addServerToGrid', handleAddServerToGrid);
    };
  }, [toast]);

  const getGridSize = (layout: keyof typeof gridLayouts): number => {
    switch (layout) {
      case '1x1': return 1;        // Single/Full screen
      case '2x2': return 4;        // Quad
      case '3x3': return 9;        // 9 divisiones
      case '4x4': return 16;       // 16 divisiones
      case '5x5': return 25;       // 25 divisiones
      case '6x6': return 36;       // 36 divisiones
      case '1+5': return 6;        // Mosaic 1+5 (1 grande + 5 pequeñas)
      case '1+12': return 13;      // Mosaic 1+12 (1 grande + 12 pequeñas)
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
  
  const handleLayoutChange = (newLayout: keyof typeof gridLayouts) => {
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

  /**
   * Cerrar todas las cámaras activas en el grid actual
   * @description Establece camera: null en todas las celdas del grid, 
   * limpia delays de stream y resetea el estado de cámara HD
   */
  const close_all_cameras = () => {
    const active_cameras_count = gridCells.filter(cell => cell.camera !== null).length;
    
    if (active_cameras_count === 0) {
      toast({
        title: "Sin cámaras activas",
        description: "No hay cámaras para cerrar.",
        variant: "default"
      });
      return;
    }

    setGridCells(currentCells => currentCells.map(cell => ({
      ...cell,
      camera: null
    })));
    
    // Limpiar todos los delays de stream
    setStreamDelays({});
    
    // Resetear cámara HD
    setHdCameraId(null);
    
    toast({
      title: "Cámaras cerradas",
      description: `Se cerraron ${active_cameras_count} cámaras.`,
      variant: "default"
    });
  };

  /**
   * Guardar la vista actual con el layout y disposición de cámaras
   * @description Captura el estado actual del grid y lo guarda via API
   */
  const save_current_view = async (view_name: string) => {
    if (!view_name.trim()) {
      toast({
        title: "Nombre requerido",
        description: "Por favor ingresa un nombre para la vista.",
        variant: "destructive"
      });
      return;
    }

    const active_cameras = gridCells.filter(cell => cell.camera !== null);
    
    if (active_cameras.length === 0) {
      toast({
        title: "Vista vacía",
        description: "No hay cámaras en el grid para guardar.",
        variant: "destructive"
      });
      return;
    }

    setIsSavingView(true);
    
    try {
      const view_data = {
        name: view_name.trim(),
        layout: layout,
        cameras: gridCells.map((cell, index) => ({
          position: index,
          camera_id: cell.camera?.id || null
        })).filter(c => c.camera_id !== null)
      };

      const response = await fetch('/api/views', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(view_data),
      });

      if (!response.ok) {
        throw new Error('Failed to save view');
      }

      const saved_view = await response.json();
      
      toast({
        title: 'Vista guardada',
        description: `La vista "${view_name}" se guardó correctamente.`,
        variant: "default"
      });

      // Notificar al sidebar que se guardó una nueva vista
      const save_view_event = new CustomEvent('viewSaved', { 
        detail: saved_view
      });
      window.dispatchEvent(save_view_event);

      // Cerrar dialog y limpiar nombre
      setShowSaveDialog(false);
      setNewViewName('');
      
    } catch (error) {
      console.error('Error saving view:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la vista. Inténtalo nuevamente.',
        variant: "destructive"
      });
    } finally {
      setIsSavingView(false);
    }
  };
  
  // Función para cambiar calidad de una cámara
  const handleQualitySwitch = (cameraId: string, newQuality: 'sub' | 'main') => {
    if (newQuality === 'main') {
      // Si queremos HD, verificar que no haya otra cámara en HD
      if (hdCameraId && hdCameraId !== cameraId) {
        toast({
          title: "Solo 1 cámara en HD",
          description: "Solo puedes tener una cámara en HD a la vez. La anterior se cambió a SD.",
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

  /**
   * Maneja el final del drag and drop
   * Soporta tanto cámaras individuales como servidores completos
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { over, active } = event;
    
    console.log('=== DRAG END DEBUG ===');
    console.log('Drag end event:', { over, active }); // Debug log
    
    if (!over) {
      console.log('WARNING: No drop target detected');
      return;
    }
    
    const dragData = active.data.current;
    const dragType = dragData?.type;
    
    console.log('Drag data extracted:', dragData);
    console.log('Drag type identified:', dragType);
    
    if (dragType === 'server') {
      console.log('Handling server drop...');
      handleServerDrop(dragData, over);
    } else if (dragType === 'camera') {
      console.log('Handling camera drop...');
      handleCameraDrop(dragData, over);
    } else {
      console.log('ERROR: Unknown drag type:', dragType);
    }
  };

  /**
   * Maneja el drop de una cámara individual
   */
  const handleCameraDrop = (dragData: any, over: any) => {
    const camera = dragData?.camera as Camera;
    if (!camera) return;

    const targetCellId = parseInt(over.id.toString().replace('cell-', ''), 10);

    setGridCells(currentCells => {
      const newCells = [...currentCells];
      const targetCellIndex = newCells.findIndex(c => c.id === targetCellId);
      if (targetCellIndex === -1) return currentCells;

      const sourceOrigin = dragData?.from;
      const sourceCellId = dragData?.gridCellId;

      console.log('Camera drag details:', { sourceOrigin, sourceCellId, targetCellId, camera }); // Debug log

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
            
            // Notificar swap dentro del grid
            setTimeout(() => {
              toast({
                title: "Cámaras intercambiadas",
                description: `${sourceCamera?.name || 'Cámara'} ↔ ${targetCamera?.name || 'Cámara'}`,
                duration: 2000,
              });
            }, 0);
        }
      } else { // Dragging from sidebar
        const targetCamera = newCells[targetCellIndex].camera;
        
        if (existingCameraIndex !== -1) {
            // If camera exists, swap with target
            const existingCamera = newCells[existingCameraIndex].camera;
            newCells[targetCellIndex] = { ...newCells[targetCellIndex], camera: camera };
            newCells[existingCameraIndex] = { ...newCells[existingCameraIndex], camera: targetCamera };
            
            // Notificar swap desde sidebar
            setTimeout(() => {
              toast({
                title: "Cámara movida",
                description: `${camera.name} reemplazó a ${existingCamera?.name} en la posición ${targetCellId + 1}`,
                duration: 3000,
              });
            }, 0);
        } else {
            // If camera doesn't exist, place it, displacing the existing one if any
            const wasEmpty = !targetCamera;
            newCells[targetCellIndex] = { ...newCells[targetCellIndex], camera: camera };
            
            // Notificar colocación desde sidebar
            setTimeout(() => {
              if (wasEmpty) {
                toast({
                  title: "Cámara agregada",
                  description: `${camera.name} iniciando streaming en posición ${targetCellId + 1}`,
                  duration: 3000,
                });
              } else {
                toast({
                  title: "Cámara reemplazada",
                  description: `${camera.name} reemplazó a ${targetCamera?.name} en posición ${targetCellId + 1}`,
                  duration: 3000,
                });
              }
            }, 0);
        }
      }
      
      console.log('New grid state:', newCells); // Debug log
      // Limpiar delays cuando se hace drag and drop
      setStreamDelays({});
      return newCells;
    });
  };

  /**
   * Maneja el drop de un servidor completo
   * Distribuye automáticamente las cámaras del servidor en el layout
   */
  const handleServerDrop = (dragData: any, over: any) => {
    console.log('=== SERVER DROP DEBUG ===');
    console.log('dragData received:', dragData);
    console.log('over target:', over);
    
    const server = dragData?.server;
    const serverCameras = dragData?.cameras as Camera[];
    
    console.log('server extracted:', server);
    console.log('serverCameras extracted:', serverCameras);
    
    if (!server || !serverCameras || serverCameras.length === 0) {
      console.log('ERROR: Missing server or cameras data');
      toast({
        title: "Sin cámaras disponibles",
        description: `El servidor ${server?.name || 'desconocido'} no tiene cámaras habilitadas`,
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    const targetCellId = parseInt(over.id.toString().replace('cell-', ''), 10);
    console.log('targetCellId calculated:', targetCellId);
    
    setGridCells(currentCells => {
      console.log('Current grid cells before update:', currentCells);
      const newCells = [...currentCells];
      const totalCells = newCells.length;
      const camerasToPlace = serverCameras.slice(0, totalCells); // Limitar al tamaño del grid
      
      console.log('totalCells:', totalCells);
      console.log('camerasToPlace:', camerasToPlace);
      
      // Si se arrastra sobre una celda específica, empezar desde esa posición
      let startIndex = targetCellId;
      
      // Colocar cámaras secuencialmente desde la posición objetivo
      camerasToPlace.forEach((camera, idx) => {
        const cellIndex = (startIndex + idx) % totalCells;
        console.log(`Placing camera ${camera.name} at cellIndex ${cellIndex}`);
        newCells[cellIndex] = { ...newCells[cellIndex], camera: camera };
      });
      
      console.log('Updated grid cells:', newCells);
      
      // Mostrar notificación
      setTimeout(() => {
        const placedCount = camerasToPlace.length;
        const totalServerCameras = serverCameras.length;
        
        toast({
          title: "Servidor agregado",
          description: `${placedCount} de ${totalServerCameras} cámaras de ${server.name} colocadas en el layout`,
          duration: 4000,
        });
      }, 0);
      
      console.log('Server drop - New grid state:', newCells); // Debug log
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
        title: "Vista Guardada",
        description: `La vista "${viewName}" ha sido guardada exitosamente.`,
      });
      
      console.log("View saved:", savedView);
      
      // Notificar al sidebar que se guardó una nueva vista
      const saveViewEvent = new CustomEvent('viewSaved', { 
        detail: savedView
      });
      window.dispatchEvent(saveViewEvent);
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar la vista. Inténtalo de nuevo.",
        variant: "destructive",
      });
      console.error("Error saving view:", error);
    }
  };

  // Registrar handlers en el layout usando contexto
  useEffect(() => {
    console.log('=== REGISTERING HANDLERS ===');
    console.log('Registering drag and double-click handlers...');
    console.log('dragContext available:', !!dragContext);
    
    if (dragContext.registerDoubleClickHandler) {
      console.log('Registering double-click handler via context');
      dragContext.registerDoubleClickHandler(addCameraToFirstEmptyCell);
    } else {
      console.log('❌ dragContext.registerDoubleClickHandler is not available');
    }
    
    if (dragContext.registerDragEndHandler) {
      console.log('Registering drag-end handler via context');
      dragContext.registerDragEndHandler(handleDragEnd);
    } else {
      console.log('❌ dragContext.registerDragEndHandler is not available');
    }
    
    // TAMBIÉN escuchar eventos de dragEnd del window
    const handleWindowDragEnd = (event: Event) => {
      console.log('=== WINDOW DRAG END RECEIVED ===');
      const customEvent = event as CustomEvent;
      console.log('Window drag end event detail:', customEvent.detail);
      handleDragEnd(customEvent.detail);
    };
    
    window.addEventListener('dragEnd', handleWindowDragEnd);
    
    return () => {
      window.removeEventListener('dragEnd', handleWindowDragEnd);
    };
  }, [dragContext]);

  console.log('🔵 LIVE VIEW COMPONENT RENDERING');

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between flex-shrink-0 px-1 py-1">
              <h1 className="font-headline text-lg sm:text-2xl font-bold tracking-tight">Live View</h1>
              <div className="flex items-center gap-1 sm:gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs sm:text-sm bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
                    onClick={close_all_cameras}
                    title="Cerrar todas las cámaras"
                  >
                    <X className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Cerrar Todo</span>
                    <span className="sm:hidden">Cerrar</span>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
                    onClick={() => setShowSaveDialog(true)}
                    title="Guardar vista actual"
                  >
                    <Save className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Guardar Vista</span>
                    <span className="sm:hidden">Guardar</span>
                  </Button>
                  <SimpleViewEditor
                    currentLayout={layout}
                    currentCameras={gridCells}
                    onSaveView={handleSaveView}
                  >
                    <Button variant="outline" size="sm" className="text-xs sm:text-sm bg-purple-600 hover:bg-purple-700 text-white border-purple-600">
                        <Settings2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Layout Manager</span>
                        <span className="sm:hidden">Layouts</span>
                    </Button>
                  </SimpleViewEditor>
                  <div className="flex items-center gap-1 sm:gap-2">
                      <LayoutGrid className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
                      <Select value={layout} onValueChange={(value) => handleLayoutChange(value as keyof typeof gridLayouts)}>
                          <SelectTrigger className="w-[80px] sm:w-[100px] h-7 sm:h-8 text-xs sm:text-sm bg-green-600 hover:bg-green-700 text-white border-green-600">
                              <SelectValue placeholder="Grid" />
                          </SelectTrigger>
                          <SelectContent>
                              {Object.keys(gridLayouts).map(key => (
                                  <SelectItem key={key} value={key} className="text-xs sm:text-sm">{key.replace('x', '×')}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
              </div>
        </div>

        <div className="flex-1 w-full overflow-hidden">
          {(layout === '1+5' || layout === '1+12') ? (
            // Render mosaic layouts with custom positioning
            <MosaicLayout 
              layout={layout}
              gridCells={gridCells}
              onRemoveCamera={handleRemoveCamera}
              onFpsChange={handleFpsChange}
              streamDelays={streamDelays}
              hdCameraId={hdCameraId}
              onQualitySwitch={handleQualitySwitch}
            />
          ) : (
            // Render standard grid layouts
            <motion.div 
              className={cn('grid gap-0.5 w-full h-full p-0.5 content-start', gridLayouts[layout])}
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
          )}
        </div>

        {/* Botón flotante para maximizar grilla completa */}
        <div className="fixed bottom-4 right-4 z-50">
          <Button 
            variant="default" 
            size="icon" 
            className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-black/70 hover:bg-green-600 text-white"
            onClick={() => {
              setIsGridFullscreen(true);
              request_fullscreen();
            }}
            title="Maximizar grilla completa"
          >
            <Maximize2 className="h-6 w-6" />
          </Button>
        </div>

        {/* Modal de grilla en pantalla completa */}
        <Dialog open={isGridFullscreen} onOpenChange={(open) => {
          setIsGridFullscreen(open);
          // Si se cierra el modal, también salir de F11
          if (!open && document.fullscreenElement) {
            document.exitFullscreen();
          }
        }}>
          <DialogContent className="p-0 sm:max-w-[100vw] md:max-w-[100vw] lg:max-w-[100vw] border-0 bg-black max-h-[100vh] w-full h-full">
            <DialogHeader className="absolute top-2 left-2 z-10 bg-black/70 p-3 rounded-lg">
              <DialogTitle className="text-white text-lg">Vista Completa - Todas las Cámaras</DialogTitle>
            </DialogHeader>
            
            {/* Botón de salir en pantalla completa */}
            <div className="absolute top-2 right-2 z-10">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 bg-black/70 hover:bg-red-600 text-white hover:text-white backdrop-blur-sm rounded" 
                onClick={() => {
                  setIsGridFullscreen(false);
                  // Salir de F11 también
                  if (document.fullscreenElement) {
                    document.exitFullscreen();
                  }
                }}
                title="Salir de pantalla completa"
              >
                <Minimize2 className="h-4 w-4" />
              </Button>
            </div>
            
            {/* Grilla completa en fullscreen */}
            <div className="w-full h-full bg-black p-4">
              {(layout === '1+5' || layout === '1+12') ? (
                // Render mosaic layouts in fullscreen
                <MosaicLayout 
                  layout={layout}
                  gridCells={gridCells}
                  onRemoveCamera={handleRemoveCamera}
                  onFpsChange={handleFpsChange}
                  streamDelays={streamDelays}
                  hdCameraId={hdCameraId}
                  onQualitySwitch={handleQualitySwitch}
                />
              ) : (
                // Render standard grid layouts in fullscreen
                <motion.div 
                  className={cn('grid gap-4 h-full w-full', gridLayouts[layout])}
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
                          Celda vacía
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              )}

              {/* Botón flotante de salida en esquina inferior derecha */}
              <div className="fixed bottom-4 right-4 z-50">
                <Button 
                  variant="default" 
                  size="icon" 
                  className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 bg-black/70 hover:bg-red-600 text-white"
                  onClick={() => {
                    setIsGridFullscreen(false);
                    // Salir de F11 también
                    if (document.fullscreenElement) {
                      document.exitFullscreen();
                    }
                  }}
                  title="Salir de pantalla completa"
                >
                  <Minimize2 className="h-6 w-6" />
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog para guardar vista */}
        <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Save className="h-5 w-5" />
                Guardar Vista
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="view-name">Nombre de la vista</Label>
                <Input
                  id="view-name"
                  placeholder="Ej: Vista Principal, Entrada y Parking..."
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newViewName.trim() && !isSavingView) {
                      save_current_view(newViewName);
                    }
                  }}
                  maxLength={50}
                  className="mt-1"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Layout actual: <span className="font-medium">{layout}</span><br />
                Cámaras activas: <span className="font-medium">{gridCells.filter(cell => cell.camera !== null).length}</span>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSaveDialog(false);
                    setNewViewName('');
                  }}
                  disabled={isSavingView}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => save_current_view(newViewName)}
                  disabled={!newViewName.trim() || isSavingView}
                >
                  {isSavingView ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
    </div>
  );
}