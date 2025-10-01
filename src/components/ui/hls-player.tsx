'use client';

import React, { useRef, useEffect, useState } from 'react';
import MJPEGConnectionPool from '@/lib/mjpeg-pool';

const connectionPool = MJPEGConnectionPool.getInstance();

interface HlsPlayerProps {
  camera: string;
  quality: 'hd' | 'sd';
  autoPlay?: boolean;
  muted?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function HlsPlayer({
  camera,
  quality,
  autoPlay = true,
  muted = true,
  className = '',
  style
}: HlsPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [connectionGranted, setConnectionGranted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [preloadSnapshot, setPreloadSnapshot] = useState<string>('');

  // Función para obtener snapshot de preload
  const getSnapshotUrl = () => {
    return `http://10.1.1.252:5000/api/${camera}/latest.jpg?${Date.now()}`;
  };

  // Preload snapshot mientras esperamos conexión MJPEG
  useEffect(() => {
    if (!connectionGranted) {
      const updateSnapshot = () => {
        setPreloadSnapshot(getSnapshotUrl());
      };
      
      // Snapshot inicial
      updateSnapshot();
      
      // Actualizar snapshot cada 3 segundos mientras esperamos
      const snapshotInterval = setInterval(updateSnapshot, 3000);
      
      return () => clearInterval(snapshotInterval);
    }
  }, [camera, connectionGranted]);

  // Intersection Observer para detectar visibilidad
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsVisible(entry.isIntersecting);
        
        // Notificar al pool sobre la visibilidad para priorización
        if (entry.isIntersecting) {
          connectionPool.updateVisibility(camera, true);
        } else {
          connectionPool.updateVisibility(camera, false);
        }
      },
      {
        threshold: [0, 0.1, 0.5, 1],
        rootMargin: '50px' // Empezar a cargar un poco antes de ser visible
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [camera, isVisible]);

  useEffect(() => {
    // Reset states
    setIsLoading(true);
    setHasError(false);
    setConnectionGranted(false);
    
    console.log(`🎯 Using optimized MJPEG with connection pool for ${camera}`);

    // Solicitar conexión al pool con prioridad basada en visibilidad
    const imgElement = document.createElement('img');
    const priority = isVisible ? 3 : 1;
    const granted = connectionPool.requestConnection(camera, imgElement, priority);
    
    if (granted) {
      setConnectionGranted(true);
    } else {
      console.log(`🔄 ${camera} added to MJPEG connection queue (priority: ${priority})`);
    }
    
    // Listener para cuando se otorgue la conexión MJPEG
    const handleConnectionReady = (event: CustomEvent) => {
      if (event.detail.cameraId === camera) {
        console.log(`🔓 MJPEG Connection granted for ${camera}`);
        setConnectionGranted(true);
      }
    };
    
    window.addEventListener('mjpegConnectionReady', handleConnectionReady as any);
    
    return () => {
      // Liberar conexión al desmontar
      connectionPool.releaseConnection(camera);
      window.removeEventListener('mjpegConnectionReady', handleConnectionReady as any);
    };

  }, [camera, quality, isVisible]);

  const handleVideoLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleVideoError = () => {
    setIsLoading(false);
    setHasError(true);
    console.error(`❌ Failed to load MJPEG stream for ${camera}`);
  };

  const getMjpegUrl = () => {
    const stream = quality === 'hd' ? 'main' : 'sub';
    return `/api/frigate/stream/${camera}?stream=${stream}`;
  };

  // MJPEG rendering optimizado con Connection Pool
  if (connectionGranted) {
    return (
      <div 
        ref={containerRef}
        className={`relative w-full h-full ${className}`}
        style={style}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <div className="text-white text-sm">
              📡 Conectando {camera}...
            </div>
          </div>
        )}
        
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 z-10">
            <div className="text-red-400 text-sm text-center">
              ❌ Error cargando {camera}<br />
              <span className="text-xs opacity-75">MJPEG stream failed</span>
            </div>
          </div>
        )}

        <img
          src={getMjpegUrl()}
          alt={`Camera ${camera}`}
          className="w-full h-full object-cover"
          onLoad={handleVideoLoad}
          onError={handleVideoError}
          style={{
            display: hasError ? 'none' : 'block'
          }}
        />
      </div>
    );
  }

  // Estado de espera en la cola con snapshot de preload
  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full ${className}`}
      style={style}
    >
      {/* Snapshot de preload */}
      {preloadSnapshot && (
        <img
          src={preloadSnapshot}
          alt={`${camera} snapshot`}
          className="w-full h-full object-cover opacity-75"
          onError={() => console.warn(`Failed to load snapshot for ${camera}`)}
        />
      )}
      
      {/* Overlay de estado */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/40">
        <div className="text-white text-sm text-center bg-black/60 px-3 py-2 rounded">
          🔄 En cola: {camera}<br />
          <span className="text-xs opacity-75">
            {isVisible ? 'Visible - Prioridad alta' : 'Fuera de vista - Prioridad baja'}
          </span>
        </div>
      </div>
    </div>
  );
}