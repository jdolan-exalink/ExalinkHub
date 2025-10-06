"use client";

import type { Camera } from '@/lib/types';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Minimize2, Rss, X, AlertCircle, Minimize, Volume2, VolumeX } from 'lucide-react';
import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState, useRef, useEffect, useCallback } from 'react';
import UnlimitedPlayer from '@/components/ui/unlimited-player';

type CameraFeedProps = {
  camera: Camera;
  onRemove: (cameraId: string) => void;
  gridCellId: number;
  streamDelay?: number; // Delay en ms antes de iniciar el stream
  onQualitySwitch?: (cameraId: string, newQuality: 'sub' | 'main') => void;
  isHdCamera?: boolean; // Si esta cámara está en HD
  onFpsChange?: (cameraId: string, fps: number) => void; // Callback para cambios de FPS
};

export default function CameraFeed({ camera, onRemove, gridCellId, streamDelay = 0, onQualitySwitch, isHdCamera = false, onFpsChange }: CameraFeedProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStreamQuality, setCurrentStreamQuality] = useState<'sub' | 'main' | 'proxy'>('sub');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [snapshotLoaded, setSnapshotLoaded] = useState(false);
  const [snapshotError, setSnapshotError] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [streamStarted, setStreamStarted] = useState(streamDelay === 0);
  const [isMuted, setIsMuted] = useState(true); // Audio muted por defecto
  const [manualQuality, setManualQuality] = useState<'sub' | 'main'>('sub'); // Control manual de calidad
  const snapshotRef = useRef<HTMLImageElement>(null);
  
  // Función para cambiar calidad con logging robusto
  const handleQualityChange = useCallback(() => {
    console.log(`🔄 BEFORE: manualQuality = ${manualQuality}`);
    const newQuality = manualQuality === 'sub' ? 'main' : 'sub';
    console.log(`🔄 CHANGING: ${manualQuality} -> ${newQuality}`);
    
    setManualQuality(prevQuality => {
      console.log(`🔄 SETTER: prevQuality = ${prevQuality}, newQuality = ${newQuality}`);
      return newQuality;
    });
  }, [manualQuality]);
  
  // Estado para forzar re-render
  const [forceRender, setForceRender] = useState(0);
  
  // Determinar calidad inicial - siempre SD para optimizar
  const getOptimalQuality = (): 'sub' | 'main' | 'proxy' => {
    // Por defecto siempre SD para optimizar vistas
    return 'sub';
  };
  
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `grid-camera-${camera.id}`,
    data: { camera, from: 'grid', gridCellId },
  });

  // URL del snapshot estático
  const getSnapshotUrl = () => {
    return `http://10.1.1.252:5000/api/${camera.id}/latest.jpg?${Date.now()}`;
  };
  
  useEffect(() => {
    // Reset state when camera changes
    setHasError(false);
    setIsLoading(true);
    const optimalQuality = getOptimalQuality();
    setCurrentStreamQuality(optimalQuality); // Usar calidad óptima
    setSnapshotLoaded(false);
    setSnapshotError(false);
    setStreamStarted(streamDelay === 0);
    
    // Clear previous timeout
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
    }
    
    const streamNumber = Math.floor(streamDelay / 2000) + 1;
    console.log(`🔄 Resetting stream state for camera ${camera.id}, delay: ${streamDelay}ms (${streamDelay > 0 ? `#${streamNumber} in sequence` : 'immediate'}), quality: ${optimalQuality}`);
    
    // Si hay delay, esperar antes de iniciar el stream
    if (streamDelay > 0) {
      const delayTimeout = setTimeout(() => {
        console.log(`⏱️ Starting delayed stream #${streamNumber} for camera ${camera.id}`);
        setStreamStarted(true);
        
        // Set timeout for loading (15 seconds) después del delay
        const timeout = setTimeout(() => {
          console.warn(`⏰ Loading timeout for camera ${camera.id}`);
          setIsLoading(false);
          setHasError(true);
        }, 15000);
        
        setLoadingTimeout(timeout);
      }, streamDelay);
      
      return () => {
        clearTimeout(delayTimeout);
        if (loadingTimeout) clearTimeout(loadingTimeout);
      };
    } else {
      // Sin delay, configurar timeout inmediatamente
      const timeout = setTimeout(() => {
        console.warn(`⏰ Loading timeout for camera ${camera.id}`);
        setIsLoading(false);
        setHasError(true);
      }, 15000);
      
      setLoadingTimeout(timeout);
      
      return () => {
        if (timeout) clearTimeout(timeout);
      };
    }
  }, [camera.id]);

  // useEffect para logging cambios de calidad manual (solo cambios importantes)
  useEffect(() => {
    console.log(`🎛️ Manual quality: ${camera.name} → ${manualQuality === 'main' ? 'HD' : 'SD'}`);
  }, [manualQuality, camera.name]);

  // Log inicial del componente  
  useEffect(() => {
    console.log(`🏁 CameraFeed mounted: ${camera.name} (initial: ${manualQuality})`);
  }, [camera.name]); // Solo al montar o cambiar cámara

  // Escuchar cambios de calidad forzados
  useEffect(() => {
    const handleForceQualityChange = (event: CustomEvent) => {
      const { cameraId, quality } = event.detail;
      if (cameraId === camera.id) {
        console.log(`🔄 Forced quality change for ${camera.id}: ${quality}`);
        setCurrentStreamQuality(quality);
      }
    };
    
    window.addEventListener('forceQualityChange', handleForceQualityChange as any);
    
    return () => {
      window.removeEventListener('forceQualityChange', handleForceQualityChange as any);
    };
  }, [camera.id]);

  useEffect(() => {
    // No necesitamos actualizar src manualmente con HLS - el componente HLS se encarga
  }, [currentStreamQuality, camera.id, streamStarted]);

  const handleDoubleClick = () => {
    console.log(`Opening fullscreen for ${camera.name} with HD quality`);
    // Notificar que vamos a pantalla completa (forzar HD temporal)
    if (onQualitySwitch) {
      onQualitySwitch(camera.id, 'main');
    }
    setIsFullscreen(true);
  };
  
  const handleCloseFullscreen = (open: boolean) => {
    setIsFullscreen(open);
    // Si cerramos pantalla completa y no estaba en HD antes, volver a SD
    if (!open && !isHdCamera && onQualitySwitch) {
      console.log(`Closing fullscreen for ${camera.name}, returning to SD`);
      onQualitySwitch(camera.id, 'sub');
    }
  };

  const handleSnapshotLoad = () => {
    console.log(`✅ Snapshot loaded for ${camera.id}`);
    setSnapshotLoaded(true);
    setSnapshotError(false);
  };

  const handleSnapshotError = () => {
    console.warn(`❌ Snapshot failed for ${camera.id}`);
    setSnapshotError(true);
  };

  const handleHlsLoad = () => {
    console.log(`✅ HLS stream loaded for ${camera.id} with quality ${currentStreamQuality}`);
    setIsLoading(false);
    setHasError(false);
    
    // Clear loading timeout
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
      setLoadingTimeout(null);
    }
  };

  const handleHlsError = () => {
    console.warn(`❌ HLS stream failed for ${camera.id} with quality ${currentStreamQuality}`);
    setIsLoading(false);
    setHasError(true);
  };

  const renderVideoContent = () => {
    if (hasError && snapshotError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-secondary/50">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <div className="text-sm font-medium">Stream no disponible</div>
            <div className="text-xs text-muted-foreground mt-1">{camera.name}</div>
          </div>
        </div>
      );
    }

    return (
      <>
        {/* Snapshot de carga rápida */}
        {!snapshotError && (
          <img
            ref={snapshotRef}
            src={getSnapshotUrl()}
            alt={`Snapshot from ${camera.name}`}
            className={cn(
              "absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-500",
              snapshotLoaded && !isLoading && streamStarted ? "opacity-0" : "opacity-100"
            )}
            onLoad={handleSnapshotLoad}
            onError={handleSnapshotError}
          />
        )}

        {/* Indicador de carga mejorado */}
        {(isLoading || !streamStarted) && !snapshotLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-secondary/50 z-10">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <div className="text-sm">
                {!streamStarted ? "Preparando stream..." : "Conectando HLS..."}
              </div>
            </div>
          </div>
        )}

        {/* Indicador de espera cuando snapshot está cargado pero stream no ha iniciado */}
        {snapshotLoaded && !streamStarted && streamDelay > 0 && (
          <div className="absolute bottom-2 left-2 z-10">
            <Badge variant="secondary" className="gap-1 text-xs animate-pulse">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              Stream #{Math.floor(streamDelay/2000) + 1} en cola
            </Badge>
          </div>
        )}

        {/* Unlimited Player optimizado - 5 FPS grid, 15 FPS fullscreen */}
        {streamStarted && (
          <UnlimitedPlayer
            camera={camera.id}
            quality={currentStreamQuality === 'main' ? 'hd' : 'sd'}
            isFullscreen={isFullscreen}
            className={cn(
              "absolute inset-0 transition-opacity duration-500",
              isLoading ? "opacity-0" : "opacity-100"
            )}
            onLoad={handleHlsLoad}
            onError={handleHlsError}
            onFpsChange={onFpsChange}
          />
        )}
      </>
    );
  };

  return (
    <>
      <Card 
        className={cn(
            "overflow-hidden group w-full h-full relative",
            isDragging && "opacity-50 z-50"
        )}
      >
        {/* Controls permanentes en la esquina superior izquierda */}
        <div className="absolute top-2 left-2 z-10">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 bg-black/70 hover:bg-destructive/80 text-white hover:text-white backdrop-blur-sm rounded" 
            onClick={(e) => {
              e.stopPropagation();
              // Limpiar timeout si existe
              if (loadingTimeout) {
                clearTimeout(loadingTimeout);
                setLoadingTimeout(null);
              }
              // Cerrar el stream - limpiar la celda
              onRemove(camera.id);
            }}
            title="Cerrar stream"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Botón de expandir en la esquina superior derecha */}
        <div className="absolute top-2 right-2 z-10">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 bg-black/70 hover:bg-green-600 text-white hover:text-white backdrop-blur-sm rounded"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsFullscreen(true);
            }}
            title="Maximizar cámara"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Área de video */}
        <div 
          className={cn(
            "w-full h-full bg-secondary relative cursor-pointer select-none",
            isHdCamera && "ring-2 ring-green-500" // Indicador visual para cámara HD
          )}
          onDoubleClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDoubleClick();
          }}
        >
          {renderVideoContent()}
          
          {/* Badge de estado y calidad */}
          <div className="absolute bottom-2 right-2 flex items-center gap-2">
            <Badge variant={hasError ? "destructive" : camera.enabled ? "default" : "secondary"} className="gap-1 text-xs">
              <Rss className="h-3 w-3" />
              {hasError ? 'ERROR' : 
               !streamStarted ? 'WAITING' :
               camera.enabled ? 'LIVE' : 'OFF'}
            </Badge>
            {camera.enabled && !hasError && (
              <Badge 
                variant="outline" 
                className={cn(
                  "text-xs font-medium cursor-pointer hover:scale-110 transition-transform",
                  currentStreamQuality === 'sub' ? 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600' : 
                  currentStreamQuality === 'main' ? 'bg-green-500 text-white border-green-500 hover:bg-green-600' : 
                  'bg-yellow-500 text-white border-yellow-500 hover:bg-yellow-600'
                )}
                title={`Click para cambiar calidad (actual: ${currentStreamQuality === 'sub' ? 'SD' : 'HD'})`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onQualitySwitch) {
                    const newQuality = currentStreamQuality === 'sub' ? 'main' : 'sub';
                    onQualitySwitch(camera.id, newQuality);
                  }
                }}
              >
                {currentStreamQuality === 'sub' ? 'SD' : 
                 currentStreamQuality === 'main' ? 'HD' : 'PROXY'}
                {streamDelay > 0 && ` #${Math.floor(streamDelay/2000) + 1}`}
              </Badge>
            )}
          </div>
        </div>
      </Card>
      
      {/* Modal de pantalla completa */}
      <Dialog open={isFullscreen} onOpenChange={handleCloseFullscreen}>
        <DialogContent className="p-0 sm:max-w-[95vw] md:max-w-[98vw] lg:max-w-[99vw] border-0 bg-black max-h-[95vh] w-full">
          <DialogHeader className="absolute top-2 left-2 z-10">
            <DialogTitle className="text-white text-lg font-semibold">FRIGATE \\ {camera.name}</DialogTitle>
          </DialogHeader>
          
          {/* Controles superiores derechos */}
          <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
            {/* Badge clickeable de calidad */}
            <Badge 
              className={`cursor-pointer transition-all duration-200 ${manualQuality === 'main' ? 'bg-green-500 border-green-500 hover:bg-green-600' : 'bg-blue-500 border-blue-500 hover:bg-blue-600'} text-white text-sm font-medium`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log(`�️ Badge clicked! Current state: ${manualQuality}`);
                handleQualityChange();
                setForceRender(prev => prev + 1); // Forzar re-render
              }}
              title={`Click para cambiar a ${manualQuality === 'sub' ? 'Main (HD)' : 'Sub (SD)'}`}
            >
              {manualQuality === 'main' ? 'HD' : 'SD'} • LIVE{manualQuality === 'main' && !isMuted ? ' • AUDIO' : ''}
            </Badge>
            
            {/* Botón de audio solo disponible en main stream */}
            {manualQuality === 'main' && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 bg-black/70 hover:bg-blue-600 text-white hover:text-white backdrop-blur-sm rounded" 
                onClick={() => setIsMuted(!isMuted)}
                title={isMuted ? "Activar audio" : "Silenciar audio"}
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 bg-black/70 hover:bg-red-600 text-white hover:text-white backdrop-blur-sm rounded" 
              onClick={() => setIsFullscreen(false)}
              title="Salir de pantalla completa"
            >
              <Minimize className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="w-full h-[90vh] bg-black relative">
            {/* Para fullscreen usamos UnlimitedPlayer con calidad manual - key fuerza remount */}
            <UnlimitedPlayer
              key={`${camera.id}-${manualQuality}-fullscreen`}
              camera={camera.id}
              quality={manualQuality === 'main' ? 'hd' : 'sd'}
              isFullscreen={true}
              disableAdaptive={true} // Deshabilitar adaptive quality para control manual
              refreshRate={15} // 15fps para fullscreen
              className="w-full h-full"
              onLoad={handleHlsLoad}
              onError={handleHlsError}
              onFpsChange={onFpsChange}
            />
            
            {/* Audio solo disponible en main stream */}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
