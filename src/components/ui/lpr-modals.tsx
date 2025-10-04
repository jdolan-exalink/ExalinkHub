'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, X, Camera, Video, Clock, Gauge, MapPin } from 'lucide-react';
import { ConfidenceLight } from '@/components/ui/confidence-light';
import type { LPREvent } from '@/lib/types';

interface LPRSnapshotModalProps {
  event: LPREvent | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (event: LPREvent) => void;
}

export function LPRSnapshotModal({ event, isOpen, onClose, onDownload }: LPRSnapshotModalProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  if (!event) return null;

  const snapshotUrl = `/api/frigate/lpr/snapshot?server=${event.serverId}&event=${event.id}`;
  
  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('es-ES');
  };

  const handleImageLoad = () => {
    setImageLoading(false);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Snapshot - Matrícula {event.plate}
            </DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Información del evento */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <div>
                <div className="text-sm text-gray-500">Fecha/Hora</div>
                <div className="text-sm font-medium">{formatDateTime(event.timestamp)}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <div>
                <div className="text-sm text-gray-500">Cámara</div>
                <div className="text-sm font-medium">{event.camera}</div>
                <div className="text-xs text-gray-400">{event.serverName}</div>
              </div>
            </div>

            {event.speed && (
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-sm text-gray-500">Velocidad</div>
                  <Badge variant={event.speed > 80 ? 'destructive' : 'secondary'}>
                    {event.speed} km/h
                  </Badge>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div>
                <div className="text-sm text-gray-500">Confianza</div>
                <ConfidenceLight confidence={event.confidence} size="sm" />
              </div>
            </div>
          </div>

          {/* Imagen del snapshot */}
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Cargando imagen...</span>
              </div>
            )}
            
            {imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                <div className="text-center">
                  <Camera className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <div className="text-gray-600">Error cargando la imagen</div>
                </div>
              </div>
            )}

            <img
              src={snapshotUrl}
              alt={`Snapshot evento ${event.id}`}
              className="w-full h-auto max-h-96 object-contain"
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{ display: imageError ? 'none' : 'block' }}
            />
          </div>

          {/* Acciones */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-500">
              ID del evento: <code className="bg-gray-100 px-2 py-1 rounded">{event.id}</code>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onDownload(event)}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Descargar Imagen
              </Button>
              
              <Button onClick={onClose}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface LPRClipModalProps {
  event: LPREvent | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (event: LPREvent) => void;
}

export function LPRClipModal({ event, isOpen, onClose, onDownload }: LPRClipModalProps) {
  const [videoLoading, setVideoLoading] = useState(true);
  const [videoError, setVideoError] = useState(false);

  if (!event) return null;

  const clipUrl = `/api/frigate/lpr/clip?server=${event.serverId}&event=${event.id}`;
  
  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('es-ES');
  };

  const formatDuration = (start: number, end?: number) => {
    if (!end) return 'N/A';
    const duration = end - start;
    return `${duration.toFixed(1)}s`;
  };

  const handleVideoLoad = () => {
    setVideoLoading(false);
    setVideoError(false);
  };

  const handleVideoError = () => {
    setVideoLoading(false);
    setVideoError(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
        <DialogHeader className="pb-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Video - Matrícula {event.plate}
            </DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Información del evento */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-500" />
              <div>
                <div className="text-sm text-gray-500">Fecha/Hora</div>
                <div className="text-sm font-medium">{formatDateTime(event.timestamp)}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-500" />
              <div>
                <div className="text-sm text-gray-500">Cámara</div>
                <div className="text-sm font-medium">{event.camera}</div>
                <div className="text-xs text-gray-400">{event.serverName}</div>
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500">Duración</div>
              <div className="text-sm font-medium">{formatDuration(event.timestamp, event.endTime)}</div>
            </div>

            {event.speed && (
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-gray-500" />
                <div>
                  <div className="text-sm text-gray-500">Velocidad</div>
                  <Badge variant={event.speed > 80 ? 'destructive' : 'secondary'}>
                    {event.speed} km/h
                  </Badge>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <div>
                <div className="text-sm text-gray-500">Confianza</div>
                <ConfidenceLight confidence={event.confidence} size="sm" />
              </div>
            </div>
          </div>

          {/* Video del clip */}
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: '400px' }}>
            {videoLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Cargando video...</span>
              </div>
            )}
            
            {videoError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                <div className="text-center">
                  <Video className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                  <div className="text-gray-600">Error cargando el video</div>
                  <div className="text-sm text-gray-500 mt-1">Verifica que el evento tenga clip disponible</div>
                </div>
              </div>
            )}

            <video
              src={clipUrl}
              controls
              className="w-full h-auto max-h-96"
              onLoadStart={() => setVideoLoading(true)}
              onCanPlay={handleVideoLoad}
              onError={handleVideoError}
              style={{ display: videoError ? 'none' : 'block' }}
              preload="metadata"
            >
              Tu navegador no soporta la reproducción de video.
            </video>
          </div>

          {/* Acciones */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-gray-500">
              ID del evento: <code className="bg-gray-100 px-2 py-1 rounded">{event.id}</code>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onDownload(event)}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Descargar Video
              </Button>
              
              <Button onClick={onClose}>
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}