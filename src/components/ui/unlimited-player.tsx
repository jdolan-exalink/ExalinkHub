'use client';

import React, { useEffect, useRef, useState } from 'react';

interface UnlimitedPlayerProps {
  camera: string;
  quality: 'hd' | 'sd';
  refreshRate?: number; // FPS de actualización
  isFullscreen?: boolean; // Para determinar FPS óptimos
  disableAdaptive?: boolean; // Para deshabilitar adaptive quality y usar calidad fija
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onFpsChange?: (camera: string, fps: number) => void; // Callback para reportar FPS
}

// Cache global de imágenes por cámara
const imageCache = new Map<string, {
  lastValidImage: string;
  timestamp: number;
}>();

const UnlimitedPlayer: React.FC<UnlimitedPlayerProps> = ({ 
  camera,
  quality,
  refreshRate, // Si no se especifica, se calcula automático
  isFullscreen = false,
  disableAdaptive = false, // Nueva prop
  className = '', 
  style,
  onLoad,
  onError,
  onFpsChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const img1Ref = useRef<HTMLImageElement>(null);
  const img2Ref = useRef<HTMLImageElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastStreamRef = useRef<string>(''); // Para tracking de cambios de stream
  const [currentImg, setCurrentImg] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [frameCount, setFrameCount] = useState(0);
  const [actualFps, setActualFps] = useState(0);
  const [adaptiveQuality, setAdaptiveQuality] = useState<'hd' | 'sd'>('sd');
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'fair' | 'poor'>('good');
  const [currentFps, setCurrentFps] = useState(5); // FPS inicial por defecto

  // Detectar calidad de conexión basada en tiempo de carga de imágenes
  const detectConnectionQuality = (loadTime: number) => {
    if (loadTime < 200) {
      setConnectionQuality('good');
    } else if (loadTime < 500) {
      setConnectionQuality('fair');
    } else {
      setConnectionQuality('poor');
    }
  };

  // Adaptive bitrate: determinar calidad óptima basada en contexto
  const getAdaptiveQuality = (): 'hd' | 'sd' => {
    // En fullscreen, priorizar calidad si la conexión es buena
    if (isFullscreen) {
      if (connectionQuality === 'good') return 'hd';
      if (connectionQuality === 'fair') return quality === 'hd' ? 'hd' : 'sd';
      return 'sd'; // Conexión pobre, usar SD
    }
    
    // En grid, usar calidad especificada pero degradar si hay problemas
    if (connectionQuality === 'poor') return 'sd';
    return quality;
  };

  // Calcular FPS óptimos según el modo y conexión
  const getOptimalFps = () => {
    if (refreshRate) return refreshRate; // FPS manual especificado
    
    // Adaptive FPS basado en calidad de conexión
    if (isFullscreen) {
      return connectionQuality === 'good' ? 15 : connectionQuality === 'fair' ? 10 : 8;
    } else {
      return connectionQuality === 'good' ? 5 : connectionQuality === 'fair' ? 3 : 2;
    }
  };

  // Usar la calidad adaptativa del estado (no calcular directamente) O calidad fija
  const currentQuality = disableAdaptive ? quality : adaptiveQuality;
  
  // Log para debugging de currentQuality
  useEffect(() => {
    console.log(`🎯 currentQuality updated: ${currentQuality} (disableAdaptive: ${disableAdaptive}, quality prop: ${quality}, adaptiveQuality: ${adaptiveQuality})`);
  }, [currentQuality, disableAdaptive, quality, adaptiveQuality]);

  // useEffect para inicializar calidad adaptativa basada en props iniciales (solo si adaptive está habilitado)
  useEffect(() => {
    if (!disableAdaptive) {
      const initialQuality = getAdaptiveQuality();
      setAdaptiveQuality(initialQuality);
    } else {
      // Si adaptive está deshabilitado, usar la calidad pasada como prop
      setAdaptiveQuality(quality);
      console.log(`🔒 Adaptive disabled, using fixed quality: ${quality}`);
    }
  }, [disableAdaptive, quality]); // Agregar quality a las dependencias

  // useEffect para inicializar FPS y reportar cambios al componente padre
  useEffect(() => {
    const optimalFps = getOptimalFps();
    if (optimalFps !== currentFps) {
      setCurrentFps(optimalFps);
    }
    onFpsChange?.(camera, currentFps);
  }, [camera, connectionQuality, isFullscreen, refreshRate]); // Dependencias para recalcular FPS

  // useEffect para actualizar calidad adaptativa cuando cambie la conexión o fullscreen (solo si adaptive está habilitado)
  useEffect(() => {
    if (!disableAdaptive) {
      const newAdaptiveQuality = getAdaptiveQuality();
      if (newAdaptiveQuality !== adaptiveQuality) {
        setAdaptiveQuality(newAdaptiveQuality);
        console.log(`📊 Adaptive quality changed: ${adaptiveQuality} → ${newAdaptiveQuality} (connection: ${connectionQuality}, fullscreen: ${isFullscreen})`);
      }
    }
  }, [connectionQuality, isFullscreen, quality, adaptiveQuality, disableAdaptive]);

  const getStreamUrl = () => {
    const stream = currentQuality === 'hd' ? 'main' : 'sub';
    const timestamp = Date.now();
    const url = `http://10.1.1.252:5000/api/${camera}/latest.jpg?stream=${stream}&t=${timestamp}`;
    // Solo log la primera vez o cuando cambie la calidad para evitar spam
    if (lastStreamRef.current !== stream) {
      console.log(`🌐 Stream quality changed: currentQuality=${currentQuality}, stream=${stream}`);
      lastStreamRef.current = stream;
    }
    return url;
  };

  const getCacheKey = () => `${camera}_${currentQuality}`;

  const updateImageCache = (imageUrl: string) => {
    const cacheKey = getCacheKey();
    imageCache.set(cacheKey, {
      lastValidImage: imageUrl,
      timestamp: Date.now()
    });
  };

  const getLastValidImage = () => {
    const cacheKey = getCacheKey();
    const cached = imageCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < 30000) { // Cache válido por 30 segundos
      return cached.lastValidImage;
    }
    return null;
  };

  useEffect(() => {
    let mounted = true;

    const startUnlimitedStream = () => {
      try {
        setIsLoading(true);
        setHasError(false);
        setErrorMessage('');
        setFrameCount(0);

        console.log(`🔄 Starting ${isFullscreen ? 'fullscreen' : 'grid'} stream for ${camera} (${quality}) at ${currentFps}fps`);

        // Cleanup previous interval
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        let frameIndex = 0;
        let successfulFrames = 0;
        let startTime = Date.now();

        const updateFrame = () => {
          if (!mounted) return;

          frameIndex++;
          const nextImg = currentImg === 1 ? 2 : 1;
          const nextImgRef = nextImg === 1 ? img1Ref.current : img2Ref.current;

          if (!nextImgRef) return;

          // Obtener nueva imagen con cache fallback
          const newUrl = getStreamUrl();
          const loadStartTime = Date.now();
          
          const onImageLoad = () => {
            if (!mounted) return;
            
            // Medir tiempo de carga para adaptive quality
            const loadTime = Date.now() - loadStartTime;
            detectConnectionQuality(loadTime);
            
            successfulFrames++;
            
            // Actualizar cache con imagen exitosa
            updateImageCache(newUrl);
            
            // Intercambiar elementos visibles
            setCurrentImg(nextImg);
            setFrameCount(frameIndex);
            
            // Calcular FPS real
            const elapsedSeconds = (Date.now() - startTime) / 1000;
            const realFps = Math.round(successfulFrames / elapsedSeconds);
            setActualFps(realFps);
            
            if (frameIndex === 1) {
              setIsLoading(false);
              onLoad?.();
            }
          };

          const onImageError = () => {
            if (!mounted) return;
            
            // Medir tiempo de error para adaptive quality (penalizar errores)
            const loadTime = Date.now() - loadStartTime;
            detectConnectionQuality(loadTime + 500); // Penalizar errores con 500ms extra
            
            console.warn(`⚠️ Frame load error for ${camera}, frame ${frameIndex}, load time: ${loadTime}ms`);
            
            // Intentar usar imagen del cache
            const cachedImage = getLastValidImage();
            if (cachedImage && nextImgRef.src !== cachedImage) {
              console.log(`🔄 Using cached image for ${camera}`);
              nextImgRef.src = cachedImage;
              return;
            }
            
            // Solo mostrar error si es el primer frame o muchos errores consecutivos
            if (frameIndex === 1 || frameIndex % 10 === 0) {
              setHasError(true);
              setErrorMessage('Connection issues - trying to recover');
              if (frameIndex === 1) {
                setIsLoading(false);
                onError?.(new Error('Stream load failed'));
              }
            }
          };

          nextImgRef.onload = onImageLoad;
          nextImgRef.onerror = onImageError;
          nextImgRef.src = newUrl;
        };

        // Cargar primer frame inmediatamente
        updateFrame();

        // Configurar intervalo para frames siguientes
        const interval = 1000 / currentFps; // ms por frame
        intervalRef.current = setInterval(updateFrame, interval);

      } catch (error) {
        if (!mounted) return;
        
        console.error(`❌ Unlimited stream error for ${camera}:`, error);
        setIsLoading(false);
        setHasError(true);
        setErrorMessage(error instanceof Error ? error.message : 'Unknown stream error');
        onError?.(error instanceof Error ? error : new Error('Unknown stream error'));
      }
    };

    startUnlimitedStream();

    return () => {
      mounted = false;
      
      // Cleanup interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Cleanup images
      if (img1Ref.current) {
        img1Ref.current.onload = null;
        img1Ref.current.onerror = null;
      }
      if (img2Ref.current) {
        img2Ref.current.onload = null;
        img2Ref.current.onerror = null;
      }
    };
  }, [camera, quality, currentQuality, currentFps, isFullscreen, onLoad, onError]); // Agregado currentQuality

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full camera-container ${className}`} 
      style={{
        ...style
      }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="text-white text-sm text-center">
            🔄 Conectando Stream
            <div className="text-xs mt-1 opacity-75">
              {camera} ({quality})
            </div>
          </div>
        </div>
      )}
      
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-orange-900/20 z-10">
          <div className="text-orange-400 text-sm text-center">
            ⚠️ Recuperando conexión...<br />
            <span className="text-xs opacity-75">{errorMessage}</span>
          </div>
        </div>
      )}

      {/* Imagen 1 */}
      <img
        ref={img1Ref}
        alt={`${camera} stream`}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-100"
        style={{
          opacity: currentImg === 1 ? 1 : 0,
          display: 'block'
        }}
      />

      {/* Imagen 2 */}
      <img
        ref={img2Ref}
        alt={`${camera} stream`}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-100"
        style={{
          opacity: currentImg === 2 ? 1 : 0,
          display: 'block'
        }}
      />
    </div>
  );
};

export default UnlimitedPlayer;