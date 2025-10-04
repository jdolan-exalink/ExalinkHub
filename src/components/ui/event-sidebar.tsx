"use client";

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import Image from 'next/image';
import type { FrigateEvent } from '@/lib/frigate-api';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Play, Download, ExternalLink, ZoomIn } from 'lucide-react';
import {
  IconUser, IconCar, IconTruck, IconBike, IconMotorbike, IconBus,
  IconDog, IconCat, IconPackage, IconQuestionMark, IconSearch
} from '@tabler/icons-react';

interface EventSidebarProps {
  events: FrigateEvent[];
  selectedEvent?: FrigateEvent | null;
  onEventSelect?: (event: FrigateEvent) => void;
  onPlayEvent?: (event: FrigateEvent) => void;
  onDownloadEvent?: (event: FrigateEvent) => void;
  className?: string;
}

// Tabler Icons mapping for object types
const OBJECT_ICONS: Record<string, any> = {
  person: IconUser,
  car: IconCar,
  truck: IconTruck,
  bicycle: IconBike,
  motorcycle: IconMotorbike,
  bus: IconBus,
  cat: IconCat,
  dog: IconDog,
  package: IconPackage,
  license_plate: IconCar,
  lpr: IconCar,
  vehicle: IconCar,
  unknown: IconSearch
};

// Colors for different object types
const OBJECT_COLORS: Record<string, string> = {
  person: 'bg-blue-100 text-blue-800 border-blue-200',
  car: 'bg-green-100 text-green-800 border-green-200',
  truck: 'bg-orange-100 text-orange-800 border-orange-200',
  bicycle: 'bg-purple-100 text-purple-800 border-purple-200',
  motorcycle: 'bg-red-100 text-red-800 border-red-200',
  bus: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  cat: 'bg-pink-100 text-pink-800 border-pink-200',
  dog: 'bg-amber-100 text-amber-800 border-amber-200',
  bird: 'bg-sky-100 text-sky-800 border-sky-200',
  package: 'bg-gray-100 text-gray-800 border-gray-200',
  unknown: 'bg-slate-100 text-slate-800 border-slate-200'
};

function EventCard({ 
  event, 
  isSelected, 
  onSelect, 
  onPlay, 
  onDownload 
}: {
  event: FrigateEvent;
  isSelected: boolean;
  onSelect?: (event: FrigateEvent) => void;
  onPlay?: (event: FrigateEvent) => void;
  onDownload?: (event: FrigateEvent) => void;
}) {
  const IconComponent = OBJECT_ICONS[event.label] || OBJECT_ICONS.unknown;
  const colorClass = OBJECT_COLORS[event.label] || OBJECT_COLORS.unknown;
  const thumbnail = event.thumbnail || '/api/placeholder-image';

  return (
    <div 
      className={`border rounded-lg p-3 cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary border-primary' : 'border-border'
      }`}
      onClick={() => onSelect?.(event)}
    >
      {/* Event Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`text-xs ${colorClass}`}>
            <span className="mr-1"><IconComponent size={16} /></span>
            {event.label}
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">
            {event.camera}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {format(new Date(event.start_time * 1000), 'HH:mm:ss')}
        </div>
      </div>

      {/* Thumbnail */}
      <div className="relative aspect-video bg-black rounded overflow-hidden mb-2">
        {event.has_snapshot || event.thumbnail ? (
          <Image
            src={event.thumbnail || `/api/frigate/events/${event.id}/snapshot.jpg`}
            alt={`${event.label} detection`}
            fill
            className="object-cover"
            sizes="(max-width: 300px) 100vw, 300px"
            onError={(e) => {
              // Fallback to placeholder if thumbnail fails
              const target = e.target as HTMLImageElement;
              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzM4NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFNuYXBzaG90PC90ZXh0Pjwvc3ZnPg==';
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-800 text-gray-400">
            <div className="text-center">
              <IconComponent size={24} className="mx-auto mb-1 opacity-50" />
              <div className="text-xs">No snapshot</div>
            </div>
          </div>
        )}
        
        {/* Media Type Indicators */}
        <div className="absolute top-2 left-2 flex gap-1">
          {event.has_clip && (
            <Badge variant="secondary" className="text-xs bg-red-600/90 text-white border-0">
              🎥 Video
            </Badge>
          )}
          {event.has_snapshot && (
            <Badge variant="secondary" className="text-xs bg-blue-600/90 text-white border-0">
              📸 Foto
            </Badge>
          )}
        </div>
        
        {/* Play Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all flex items-center justify-center">
          <Button
            variant="secondary"
            size="sm"
            className="opacity-0 hover:opacity-100 transition-opacity bg-white/90 hover:bg-white text-black"
            onClick={(e) => {
              e.stopPropagation();
              onPlay?.(event);
            }}
            title={event.has_clip ? "Reproducir video" : "Ver snapshot"}
          >
            {event.has_clip ? (
              <>
                <Play className="h-4 w-4 mr-1" />
                Play
              </>
            ) : (
              <>
                <ZoomIn className="h-4 w-4 mr-1" />
                Ver
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Event Actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {event.has_clip ? (
            <>Duración: {event.end_time ? Math.round(event.end_time - event.start_time) : '?'}s</>
          ) : (
            <>Solo snapshot disponible</>
          )}
        </div>
        <div className="flex gap-1">
          {event.has_clip && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onDownload?.(event);
              }}
              title="Descargar clip"
            >
              <Download className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`/events/${event.id}`, '_blank');
            }}
            title="Abrir en nueva pestaña"
          >
            <ExternalLink className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function EventSidebar({ 
  events, 
  selectedEvent, 
  onEventSelect, 
  onPlayEvent, 
  onDownloadEvent,
  className 
}: EventSidebarProps) {
  const [loadingThumbnails, setLoadingThumbnails] = useState<Set<string>>(new Set());

  // Group events by time periods for better organization
  const groupedEvents = events.reduce((acc, event) => {
    const hour = format(new Date(event.start_time * 1000), 'HH:00');
    if (!acc[hour]) {
      acc[hour] = [];
    }
    acc[hour].push(event);
    return acc;
  }, {} as Record<string, FrigateEvent[]>);

  const hours = Object.keys(groupedEvents).sort().reverse();

  return (
    <div className={`bg-card border rounded-lg flex flex-col ${className}`}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Events</h3>
          <Badge variant="secondary">{events.length}</Badge>
        </div>
      </div>

      {/* Events List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {hours.length > 0 ? (
            hours.map(hour => (
              <div key={hour}>
                {/* Hour Header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-sm font-medium text-muted-foreground">{hour}</div>
                  <div className="flex-1 h-px bg-border"></div>
                  <Badge variant="outline" className="text-xs">
                    {groupedEvents[hour].length}
                  </Badge>
                </div>

                {/* Events for this hour */}
                <div className="space-y-3">
                  {groupedEvents[hour].map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      isSelected={selectedEvent?.id === event.id}
                      onSelect={onEventSelect}
                      onPlay={onPlayEvent}
                      onDownload={onDownloadEvent}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-4xl mb-2">👁️</div>
              <div className="text-sm">No events found</div>
              <div className="text-xs mt-1">Try adjusting your time range or filters</div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer Stats */}
      <div className="p-4 border-t bg-muted/20">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-foreground">{events.length}</div>
            <div className="text-xs text-muted-foreground">Total Events</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-foreground">
              {events.filter(e => e.has_clip).length}
            </div>
            <div className="text-xs text-muted-foreground">With Clips</div>
          </div>
        </div>
      </div>
    </div>
  );
}