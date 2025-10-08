'use client';

import { useState } from 'react';
import { Download, Eye, Video, Camera, Clock, Gauge, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfidenceLight, ConfidenceBadge } from '@/components/ui/confidence-light';
import { cn } from '@/lib/utils';
import type { LPREvent } from '@/lib/types';

interface LPRTableProps {
  events: LPREvent[];
  isLoading?: boolean;
  onViewSnapshot: (event: LPREvent) => void;
  onViewClip: (event: LPREvent) => void;
  onDownloadSnapshot: (event: LPREvent) => void;
  onDownloadClip: (event: LPREvent) => void;
}

export function LPRTable({ 
  events, 
  isLoading = false, 
  onViewSnapshot,
  onViewClip,
  onDownloadSnapshot,
  onDownloadClip
}: LPRTableProps) {

  const formatDateTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return {
      date: date.toLocaleDateString('es-ES'),
      time: date.toLocaleTimeString('es-ES', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      })
    };
  };

  const getVehicleIcon = (vehicleType?: string) => {
    switch (vehicleType) {
      case 'car': return '🚗';
      case 'truck': return '🚛';
      case 'motorcycle': return '🏍️';
      case 'bus': return '🚌';
      default: return '🚗';
    }
  };

  const getSpeedBadgeColor = (speed?: number) => {
    if (!speed) return 'secondary';
    if (speed > 80) return 'destructive';
    if (speed > 60) return 'default';
    return 'secondary';
  };

  const generateThumbnailUrl = (event: LPREvent) => {
    // URL para el snapshot (miniatura)
    return `/api/frigate/lpr/snapshot?server=${event.serverId}&event=${event.id}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Buscando eventos...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No se encontraron eventos
          </h3>
          <p className="text-gray-500">
            Intenta ajustar los filtros de búsqueda o ampliar el rango de fechas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Detecciones de Matrículas
          <Badge variant="outline" className="ml-2">
            {events.length} evento{events.length !== 1 ? 's' : ''}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Imagen</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Cámara</TableHead>
                <TableHead>Fecha y Hora</TableHead>
                <TableHead className="text-center">Velocidad</TableHead>
                <TableHead className="text-center">Confianza</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            
            <TableBody>
              {events.map((event) => {
                const dateTime = formatDateTime(event.timestamp);
                const thumbnailUrl = generateThumbnailUrl(event);
                
                return (
                  <TableRow key={event.id} className="hover:bg-gray-50">
                    {/* Miniatura */}
                    <TableCell className="p-2">
                      <div className="relative group">
                        <div
                          className="w-16 h-12 bg-gray-200 rounded cursor-pointer overflow-hidden border hover:border-blue-300 transition-colors"
                          onClick={() => onViewSnapshot(event)}
                        >
                          <img
                            src={thumbnailUrl}
                            alt={`Matrícula ${event.plate}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              // Fallback en caso de error cargando la imagen
                              const target = e.target as HTMLImageElement;
                              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA2NCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjQ4IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yOCAyMEgzNlYyOEgyOFYyMFoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+';
                            }}
                          />
                        </div>
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity rounded flex items-center justify-center">
                          <Eye className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </TableCell>

                    {/* Matrícula */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-lg">
                          {event.plate}
                        </span>
                        <span className="text-sm">{getVehicleIcon(event.vehicleType)}</span>
                      </div>
                    </TableCell>

                    {/* Cámara */}
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{event.camera}</span>
                        <span className="text-xs text-gray-500">{event.serverName}</span>
                      </div>
                    </TableCell>

                    {/* Fecha y Hora */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{dateTime.date}</span>
                          <span className="text-xs text-gray-500">{dateTime.time}</span>
                        </div>
                      </div>
                    </TableCell>

                    {/* Velocidad */}
                    <TableCell className="text-center">
                      {event.speed ? (
                        <Badge variant={getSpeedBadgeColor(event.speed)} className="flex items-center gap-1 w-fit mx-auto">
                          <Gauge className="h-3 w-3" />
                          {event.speed} km/h
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </TableCell>

                    {/* Confianza */}
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <ConfidenceLight 
                          confidence={event.confidence} 
                          size="sm"
                          showValue={true}
                        />
                      </div>
                    </TableCell>

                    {/* Acciones */}
                    <TableCell className="text-center">
                      <div className="flex items-center gap-1 justify-center">
                        {/* Ver Snapshot */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onViewSnapshot(event)}
                          className="h-8 w-8 p-0"
                          title="Ver imagen"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>

                        {/* Ver Clip */}
                        {event.has_clip && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewClip(event)}
                            className="h-8 w-8 p-0"
                            title="Ver video"
                          >
                            <Video className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Descargar Snapshot */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDownloadSnapshot(event)}
                          className="h-8 w-8 p-0"
                          title="Descargar imagen"
                        >
                          <Download className="h-4 w-4" />
                        </Button>

                        {/* Descargar Clip */}
                        {event.has_clip && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDownloadClip(event)}
                            className="h-8 w-8 p-0"
                            title="Descargar video"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}