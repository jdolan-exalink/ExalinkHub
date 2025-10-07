/**
 * Componente de tabla para mostrar eventos LPR
 */

'use client';

import React from 'react';
import { Eye, Edit2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PlateEvent {
  id: number;
  frigate_event_id: string;
  camera_name: string;
  license_plate: string;
  timestamp: string;
  start_time: string;
  end_time?: string;
  zone?: string;
  plate_confidence?: number;
  plate_region?: string;
  vehicle_type?: string;
  vehicle_color?: string;
  speed_kmh?: number;
  direction?: string;
  traffic_light_status?: 'red' | 'yellow' | 'green' | 'unknown';
  snapshot_url?: string;
  clip_url?: string;
  false_positive: boolean;
  has_clip: boolean;
  has_snapshot: boolean;
  metadata?: any;
}

interface LPRTableProps {
  events: PlateEvent[];
  is_loading: boolean;
  on_view_image: (event: PlateEvent) => void;
  on_edit_plate: (event: PlateEvent, new_plate: string) => void;
  on_toggle_false_positive: (event: PlateEvent) => void;
}

export function LPRTable({ events, is_loading, on_view_image, on_edit_plate, on_toggle_false_positive }: LPRTableProps) {
  if (is_loading) {
    return <div className="text-center py-8">Cargando eventos...</div>;
  }

  if (events.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">No se encontraron eventos</div>;
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Matrícula</TableHead>
            <TableHead>Cámara</TableHead>
            <TableHead>Fecha/Hora</TableHead>
            <TableHead>Vehículo</TableHead>
            <TableHead>Semáforo</TableHead>
            <TableHead>Confianza</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.map((event) => (
            <TableRow key={event.id}>
              <TableCell className="font-mono">{event.license_plate}</TableCell>
              <TableCell>{event.camera_name}</TableCell>
              <TableCell>{new Date(event.timestamp).toLocaleString()}</TableCell>
              <TableCell>
                {event.vehicle_type && (
                  <Badge variant="outline">{event.vehicle_type}</Badge>
                )}
              </TableCell>
              <TableCell>
                {event.traffic_light_status && (
                  <Badge variant={
                    event.traffic_light_status === 'red' ? 'destructive' :
                    event.traffic_light_status === 'green' ? 'default' :
                    'secondary'
                  }>
                    {event.traffic_light_status === 'red' && '🔴'}
                    {event.traffic_light_status === 'yellow' && '🟡'}
                    {event.traffic_light_status === 'green' && '🟢'}
                    {event.traffic_light_status === 'unknown' && '⚪'}
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {event.plate_confidence && (
                  <Badge variant={event.plate_confidence > 0.8 ? 'default' : 'secondary'}>
                    {Math.round(event.plate_confidence * 100)}%
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                {event.false_positive ? (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Falso
                  </Badge>
                ) : (
                  <Badge variant="default">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Válido
                  </Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {event.has_snapshot && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => on_view_image(event)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => on_toggle_false_positive(event)}
                  >
                    <AlertTriangle className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}