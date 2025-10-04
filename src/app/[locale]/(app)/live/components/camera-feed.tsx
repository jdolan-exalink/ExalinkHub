"use client";

import type { Camera } from '@/lib/types';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Maximize, Rss, X, AlertCircle, Minimize, Volume2, VolumeX } from 'lucide-react';
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
  const translate_live_camera = useTranslations('live.camera');
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentStreamQuality, setCurrentStreamQuality] = useState<'sub' | 'main' | 'proxy'>('sub');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [snapshotLoaded, setSnapshotLoaded] = useState(false);
  const [snapshotError, setSnapshotError] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  // Stream monitoring states - temporarily disabled
  // const [streamConnected, setStreamConnected] = useState(true);
  // const [lastStreamUpdate, setLastStreamUpdate] = useState<Date>(new Date());
  // const [streamMonitorInterval, setStreamMonitorInterval] = useState<NodeJS.Timeout | null>(null);
  const [streamStarted, setStreamStarted] = useState(streamDelay === 0);
  const [isMuted, setIsMuted] = useState(true); // Audio muted por defecto
  const [manualQuality, setManualQuality] = useState<'sub' | 'main'>('sub'); // Control manual de calidad
  // Estados para zoom y pan en fullscreen
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePosition, setLastMousePosition] = useState({ x: 0, y: 0 });
  const [imageEnhancement, setImageEnhancement] = useState({
    sharpness: 1.2,
    contrast: 1.1,
    brightness: 1.0,
    saturation: 1.05
  });
  const snapshotRef = useRef<HTMLImageElement>(null);
  const fullscreenVideoRef = useRef<HTMLDivElement>(null);
  
  // Función para obtener el nombre completo de la cámara con servidor
  const getDisplayName = () => {
    if (camera.server_name && camera.server_name !== 'Casa') {
      return `${camera.server_name}-${camera.name}`;
    }
    return camera.name;
  };

  // Función para obtener el identificador único de la cámara
  const getUniqueId = () => `${camera.server_id || 'default'}-${camera.id}`;
  
  // Función para cambiar calidad con logging robusto
  const handleQualityChange = useCallback(() => {
    console.log(`🔄 BEFORE: manualQuality = ${manualQuality}`);
    const displayName = getDisplayName();
    const newQuality = manualQuality === 'sub' ? 'main' : 'sub';
    console.log(`🔄 CHANGING: ${manualQuality} -> ${newQuality}`);
    
    setManualQuality(prevQuality => {
      console.log(`🔄 SETTER: prevQuality = ${prevQuality}, newQuality = ${newQuality}`);
      return newQuality;
    });
  }, [manualQuality]);
  
  // Estado para forzar re-render
  const [forceRender, setForceRender] = useState(0);
  
  // Funciones para zoom y pan
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!isFullscreen) return;
    
    // No usar preventDefault en eventos wheel pasivos
    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
    // Limitar zoom mínimo a 1.0 (imagen original) y máximo a 3.0
    const newZoom = Math.max(1.0, Math.min(3, zoomLevel + zoomDelta));
    
    // Solo actualizar si realmente cambia el zoom
    if (newZoom === zoomLevel) return;
    
    setZoomLevel(newZoom);
    
    // Ajustar filtros según el nivel de zoom para mejor calidad
    if (newZoom > 2.0) {
      setImageEnhancement({
        sharpness: 1.4,
        contrast: 1.15,
        brightness: 1.02,
        saturation: 1.08
      });
    } else if (newZoom > 1.5) {
      setImageEnhancement({
        sharpness: 1.3,
        contrast: 1.12,
        brightness: 1.01,
        saturation: 1.06
      });
    } else {
      setImageEnhancement({
        sharpness: 1.2,
        contrast: 1.1,
        brightness: 1.0,
        saturation: 1.05
      });
    }
    
    // Si volvemos a zoom 1, resetear posición
    if (newZoom === 1) {
      setPanPosition({ x: 0, y: 0 });
    }
    
    const timestamp = new Date().toLocaleTimeString('es-ES', { hour12: false, fractionalSecondDigits: 3 });
    console.log(`🔍 [${timestamp}] Zoom: ${zoomLevel.toFixed(1)} → ${newZoom.toFixed(1)} (Enhanced: ${newZoom > 1 ? 'ON' : 'OFF'})`);
  }, [isFullscreen, zoomLevel]);
  
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isFullscreen || zoomLevel <= 1) return;
    
    setIsPanning(true);
    setLastMousePosition({ x: e.clientX, y: e.clientY });
    // Prevenir selección de texto durante el pan
    e.preventDefault();
  }, [isFullscreen, zoomLevel]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !isFullscreen || zoomLevel <= 1) return;
    
    const deltaX = e.clientX - lastMousePosition.x;
    const deltaY = e.clientY - lastMousePosition.y;
    
    // Limitar el pan para no salir de los bordes de la imagen
    const maxPanX = (window.innerWidth * (zoomLevel - 1)) / 2;
    const maxPanY = (window.innerHeight * (zoomLevel - 1)) / 2;
    
    setPanPosition(prev => ({
      x: Math.max(-maxPanX, Math.min(maxPanX, prev.x + deltaX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, prev.y + deltaY))
    }));
    
    setLastMousePosition({ x: e.clientX, y: e.clientY });
    e.preventDefault();
  }, [isPanning, lastMousePosition, isFullscreen, zoomLevel]);
  
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);
  
  // Reset zoom cuando se cierra fullscreen
  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
    setIsPanning(false);
    setImageEnhancement({
      sharpness: 1.2,
      contrast: 1.1,
      brightness: 1.0,
      saturation: 1.05
    });
  }, []);
  
  // Stream monitoring functions - temporarily disabled
  /*
  const updateStreamStatus = useCallback(() => {
    setLastStreamUpdate(new Date());
    if (!streamConnected) {
      setStreamConnected(true);
      console.log(`Stream ${camera.id}: Reconnected`);
    }
  }, [streamConnected, camera.id]);

  const startStreamMonitoring = useCallback(() => {
    if (streamMonitorInterval) {
      clearInterval(streamMonitorInterval);
    }

    const monitor = setInterval(() => {
      const now = new Date();
      const timeSinceLastUpdate = now.getTime() - lastStreamUpdate.getTime();
      const CONNECTION_TIMEOUT = 45000; // 45 seconds

      if (timeSinceLastUpdate > CONNECTION_TIMEOUT && streamConnected) {
        setStreamConnected(false);
        console.warn(`Stream ${camera.id}: Disconnected (no updates for ${timeSinceLastUpdate}ms)`);
      }
    }, 5000); // Check every 5 seconds

    setStreamMonitorInterval(monitor);
  }, [lastStreamUpdate, streamConnected, camera.id, streamMonitorInterval]);

  const stopStreamMonitoring = useCallback(() => {
    if (streamMonitorInterval) {
      clearInterval(streamMonitorInterval);
      setStreamMonitorInterval(null);
    }
  }, [streamMonitorInterval]);
  */
  
  // Determinar calidad inicial - siempre SD para optimizar
  const getOptimalQuality = (): 'sub' | 'main' | 'proxy' => {
    // Por defecto siempre SD para optimizar vistas
    return 'sub';
  };
  
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `grid-camera-${getUniqueId()}`,
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

  // Cleanup monitoring on unmount - temporarily disabled
  /*
  useEffect(() => {
    return () => {
      stopStreamMonitoring();
    };
  }, [stopStreamMonitoring]);
  */

  // useEffect para logging cambios de calidad manual (solo cambios importantes)
  useEffect(() => {
    console.log(`🎛️ Manual quality: ${getDisplayName()} → ${manualQuality === 'main' ? 'HD' : 'SD'}`);
  }, [manualQuality, camera.name]);

  // Log inicial del componente  
  useEffect(() => {
    console.log(`🏁 CameraFeed mounted: ${getDisplayName()} (initial: ${manualQuality})`);
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
    console.log(`Opening fullscreen for ${getDisplayName()} with HD quality`);
    // Notificar que vamos a pantalla completa (forzar HD temporal)
    if (onQualitySwitch) {
      onQualitySwitch(camera.id, 'main');
    }
    setIsFullscreen(true);
  };
  
  const handleCloseFullscreen = (open: boolean) => {
    setIsFullscreen(open);
    // Si cerramos pantalla completa, resetear zoom
    if (!open) {
      resetZoom();
    }
    // Si cerramos pantalla completa y no estaba en HD antes, volver a SD
    if (!open && !isHdCamera && onQualitySwitch) {
      console.log(`Closing fullscreen for ${getDisplayName()}, returning to SD`);
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
    
    // Update stream status for monitoring (temporarily disabled)
    // updateStreamStatus();
    // startStreamMonitoring();
    
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
    // Temporarily disable stream monitoring
    // setStreamConnected(false);
    // stopStreamMonitoring();
  };

  const renderVideoContent = () => {
    if (hasError && snapshotError) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-secondary/50">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
            <div className="text-sm font-medium">Stream no disponible</div>
            <div className="text-xs text-muted-foreground mt-1">{getDisplayName()}</div>
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
            alt={`Snapshot from ${getDisplayName()}`}
            className={cn(
              "absolute inset-0 w-full h-full object-contain pointer-events-none transition-opacity duration-500",
              snapshotLoaded && !isLoading && streamStarted ? "opacity-0" : "opacity-100"
            )}
            style={{
              objectFit: 'contain', // Mantener proporción sin recortar
              objectPosition: 'center'
            }}
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
                {!streamStarted ? "{translate_live_camera('loading.preparing')}" : "{translate_live_camera('loading.connecting_hls')}"}
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
            style={{
              objectFit: 'contain'
            }}
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
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={cn(
            "overflow-hidden group w-full h-full relative cursor-grab active:cursor-grabbing",
            isDragging && "opacity-50 z-50"
        )}
      >
        {/* Controls permanentes en la esquina superior izquierda */}
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
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
            title="{translate_live_camera('actions.close_stream')}"
          >
            <X className="h-4 w-4" />
          </Button>
          
          {/* Badge sutil del nombre servidor-cámara */}
          <Badge className="bg-black/50 text-white/80 border-white/10 text-[10px] px-1 py-0 h-4 font-normal">
            {getDisplayName()}
          </Badge>
          
          {/* Stream status indicator - temporarily disabled */}
          {false && (
            <Badge 
              variant="destructive" 
              className="text-[10px] px-1 py-0 h-4 font-normal animate-pulse"
              title="{translate_live_camera('alerts.stream_disconnected')}"
            >
              DESCONECTADO
            </Badge>
          )}
        </div>

        {/* Botón de expandir en la esquina superior derecha */}
        <div className="absolute top-2 right-2 z-10" onPointerDown={(e) => e.stopPropagation()}>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 bg-black/70 hover:bg-green-600 text-white hover:text-white backdrop-blur-sm rounded"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsFullscreen(true);
            }}
            title="{translate_live_camera('actions.maximize_camera')}"
          >
            <Maximize className="h-4 w-4" />
          </Button>
        </div>

        {/* Área de video */}
        <div 
          className={cn(
            "w-full h-full bg-secondary relative cursor-pointer select-none flex items-center justify-center",
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
          <div className="absolute bottom-2 right-2 flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
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
            <DialogTitle className="text-white text-lg font-semibold">EXALINK \\ {getDisplayName()}</DialogTitle>
          </DialogHeader>
          
          {/* Controles superiores derechos */}
          <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
            {/* Controles de imagen (solo visible cuando hay zoom) */}
            {zoomLevel > 1 && (
              <div className="flex items-center gap-1 bg-black/70 rounded px-2 py-1 backdrop-blur-sm">
                <div className="text-xs text-white/70">🎨</div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-white hover:bg-white/20"
                  onClick={() => {
                    setImageEnhancement(prev => ({
                      ...prev,
                      sharpness: prev.sharpness === 1.5 ? 1.0 : 1.5
                    }));
                  }}
                  title="{translate_live_camera('actions.toggle_sharpness')}"
                >
                  <span className="text-xs">S</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-white hover:bg-white/20"
                  onClick={() => {
                    setImageEnhancement(prev => ({
                      ...prev,
                      contrast: prev.contrast === 1.2 ? 1.0 : 1.2
                    }));
                  }}
                  title="{translate_live_camera('actions.toggle_contrast')}"
                >
                  <span className="text-xs">C</span>
                </Button>
              </div>
            )}
            
            {/* Badge clickeable de calidad - SIN texto de audio muted */}
            <Badge 
              className={`cursor-pointer transition-all duration-200 ${manualQuality === 'main' ? 'bg-green-500 border-green-500 hover:bg-green-600' : 'bg-blue-500 border-blue-500 hover:bg-blue-600'} text-white text-sm font-medium`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const timestamp = new Date().toLocaleTimeString('es-ES', { hour12: false, fractionalSecondDigits: 3 });
                console.log(`🖱️ [${timestamp}] Badge clicked! Current state: ${manualQuality} → ${manualQuality === 'sub' ? 'main' : 'sub'}`);
                handleQualityChange();
                setForceRender(prev => prev + 1); // Forzar re-render
              }}
              title={`Click para cambiar a ${manualQuality === 'sub' ? 'Main (HD)' : 'Sub (SD)'}`}
            >
              {manualQuality === 'main' ? 'HD' : 'SD'} • LIVE
            </Badge>
            
            {/* Botón de audio - SOLO visible en main stream */}
            {manualQuality === 'main' && (
              <Button 
                variant="ghost" 
                size="icon" 
                className={`h-8 w-8 bg-black/70 hover:bg-blue-600 text-white hover:text-white backdrop-blur-sm rounded ${!isMuted ? 'ring-2 ring-blue-400' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const timestamp = new Date().toLocaleTimeString('es-ES', { hour12: false, fractionalSecondDigits: 3 });
                  console.log(`🔊 [${timestamp}] Audio toggle: ${isMuted ? 'OFF' : 'ON'} → ${!isMuted ? 'OFF' : 'ON'} (main stream only)`);
                  setIsMuted(!isMuted);
                }}
                title={isMuted ? "{translate_live_camera('actions.unmute_audio')}" : "{translate_live_camera('actions.mute_audio')}"}
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
          
          <div 
            ref={fullscreenVideoRef}
            className="w-full h-[90vh] bg-black relative overflow-hidden"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              cursor: zoomLevel > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in',
              touchAction: 'none' // Prevenir comportamientos de touch por defecto
            }}
          >
            {/* Para fullscreen usamos UnlimitedPlayer con calidad manual - key fuerza remount */}
            <div
              style={{
                transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`,
                transformOrigin: 'center center',
                transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                width: '100%',
                height: '100%',
                // Filtros CSS para mejorar la imagen con zoom
                filter: `
                  contrast(${imageEnhancement.contrast})
                  brightness(${imageEnhancement.brightness})
                  saturate(${imageEnhancement.saturation})
                  ${zoomLevel > 1 ? `
                    drop-shadow(0 0 1px rgba(255,255,255,0.1))
                    ${imageEnhancement.sharpness > 1.2 ? 'url(#sharpen)' : ''}
                  ` : ''}
                `.replace(/\s+/g, ' ').trim(),
                // Configuración de imagen para mejor calidad en zoom
                imageRendering: zoomLevel > 1.5 ? 'crisp-edges' : 'auto',
              }}
            >
              <UnlimitedPlayer
                key={`${camera.id}-${manualQuality}-fullscreen-stable`}
                camera={camera.id}
                quality={manualQuality === 'main' ? 'hd' : 'sd'}
                isFullscreen={true}
                disableAdaptive={true} // Deshabilitar adaptive quality para control manual
                refreshRate={15} // 15fps para fullscreen
                className="w-full h-full"
                onLoad={handleHlsLoad}
                onError={handleHlsError}
                onFpsChange={onFpsChange}
                style={{
                  // Anti-aliasing mejorado para zoom
                  WebkitFontSmoothing: 'antialiased',
                  MozOsxFontSmoothing: 'grayscale',
                  backfaceVisibility: 'hidden',
                  perspective: '1000px'
                }}
              />
            </div>
            
            {/* Filtro SVG para sharpening */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <defs>
                <filter id="sharpen">
                  <feConvolveMatrix
                    order="3"
                    kernelMatrix="0 -1 0 -1 5 -1 0 -1 0"
                    preserveAlpha="true"
                  />
                </filter>
              </defs>
            </svg>
            
            {/* Indicador de zoom mejorado */}
            {zoomLevel !== 1 && (
              <div className="absolute bottom-4 left-4 z-20">
                <div className="flex flex-col gap-1">
                  <Badge className="bg-black/70 text-white border-white/20">
                    🔍 {zoomLevel.toFixed(1)}x
                  </Badge>
                  {zoomLevel > 1 && (
                    <div className="text-xs text-white/70 bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
                      <div>Sharp: {imageEnhancement.sharpness.toFixed(1)}x</div>
                      <div>Contrast: {imageEnhancement.contrast.toFixed(1)}x</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {/* Instrucciones de uso mejoradas */}
            <div className="absolute bottom-4 right-4 z-20">
              <div className="text-xs text-white/70 bg-black/50 px-2 py-1 rounded backdrop-blur-sm">
                <div>🖱️ Rueda: Zoom (1x-3x) • {zoomLevel > 1 ? 'Arrastrar: Pan' : 'Zoom para Pan'}</div>
                {zoomLevel > 1 && (
                  <div className="mt-1 text-white/50">🎨 S: Sharpness • C: Contrast</div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}