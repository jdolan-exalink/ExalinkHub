"use client";

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import Image from 'next/image';
import type { FrigateEvent } from '@/lib/frigate-api';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Play, Download, ExternalLink, ZoomIn } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
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

// Colors for different object types - theme aware
const getObjectColors = (theme: string | undefined) => {
  const isDark = theme === 'dark';
  return {
    person: isDark ? 'bg-blue-900 text-blue-100 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200',
    car: isDark ? 'bg-green-900 text-green-100 border-green-700' : 'bg-green-100 text-green-800 border-green-200',
    truck: isDark ? 'bg-orange-900 text-orange-100 border-orange-700' : 'bg-orange-100 text-orange-800 border-orange-200',
    bicycle: isDark ? 'bg-purple-900 text-purple-100 border-purple-700' : 'bg-purple-100 text-purple-800 border-purple-200',
    motorcycle: isDark ? 'bg-red-900 text-red-100 border-red-700' : 'bg-red-100 text-red-800 border-red-200',
    bus: isDark ? 'bg-yellow-900 text-yellow-100 border-yellow-700' : 'bg-yellow-100 text-yellow-800 border-yellow-200',
    cat: isDark ? 'bg-pink-900 text-pink-100 border-pink-700' : 'bg-pink-100 text-pink-800 border-pink-200',
    dog: isDark ? 'bg-amber-900 text-amber-100 border-amber-700' : 'bg-amber-100 text-amber-800 border-amber-200',
    bird: isDark ? 'bg-sky-900 text-sky-100 border-sky-700' : 'bg-sky-100 text-sky-800 border-sky-200',
    package: isDark ? 'bg-gray-900 text-gray-100 border-gray-700' : 'bg-gray-100 text-gray-800 border-gray-200',
    unknown: isDark ? 'bg-slate-900 text-slate-100 border-slate-700' : 'bg-slate-100 text-slate-800 border-slate-200'
  };
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
  const t = useTranslations('events.sidebar');
  const { theme } = useTheme();
  const IconComponent = OBJECT_ICONS[event.label] || OBJECT_ICONS.unknown;
  const objectColors = getObjectColors(theme);
  const colorClass = objectColors[event.label as keyof typeof objectColors] || objectColors.unknown;
  const thumbnail = event.thumbnail || '/api/placeholder-image';

  return (
    <div 
      className={`border rounded-lg p-2 lg:p-3 cursor-pointer transition-all hover:shadow-md ${
        isSelected ? 'ring-2 ring-primary border-primary' : 'border-border'
      }`}
      onClick={() => onSelect?.(event)}
    >
      {/* Event Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1 lg:gap-2 min-w-0 flex-1">
          <Badge variant="outline" className={`text-xs ${colorClass} flex-shrink-0`}>
            <span className="mr-1"><IconComponent size={14} /></span>
            <span className="truncate">{event.label}</span>
          </Badge>
          <span className="text-xs text-muted-foreground font-mono truncate">
            {event.camera}
          </span>
        </div>
        <div className="text-xs text-muted-foreground flex-shrink-0 ml-1">
          {format(new Date(event.start_time * 1000), 'HH:mm')}
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
            sizes="(max-width: 768px) 50vw, 300px"
            onError={(e) => {
              // Fallback to placeholder if thumbnail fails
              const target = e.target as HTMLImageElement;
              target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY2NzM4NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFNuYXBzaG90PC90ZXh0Pjwvc3ZnPg==';
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-800 text-gray-400">
            <div className="text-center">
              <IconComponent size={20} className="mx-auto mb-1 opacity-50" />
              <div className="text-xs">{t('no_snapshot')}</div>
            </div>
          </div>
        )}
        
        {/* Media Type Indicators */}
        <div className="absolute top-1 lg:top-2 left-1 lg:left-2 flex gap-1">
          {event.has_clip && (
            <Badge variant="secondary" className="text-xs bg-red-600/90 text-white border-0 px-1">
              🎥
            </Badge>
          )}
          {event.has_snapshot && (
            <Badge variant="secondary" className="text-xs bg-blue-600/90 text-white border-0 px-1">
              📸
            </Badge>
          )}
        </div>
        
        {/* Play Overlay */}
        <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all flex items-center justify-center">
          <Button
            variant="secondary"
            size="sm"
            className="opacity-0 hover:opacity-100 transition-opacity bg-white/90 hover:bg-white text-black text-xs h-6 px-2"
            onClick={(e) => {
              e.stopPropagation();
              onPlay?.(event);
            }}
            title={event.has_clip ? t('play_video') : t('view_snapshot')}
          >
            {event.has_clip ? (
              <>
                <Play className="h-3 w-3 mr-1" />
                <span className="hidden lg:inline">{t('play_video')}</span>
              </>
            ) : (
              <>
                <ZoomIn className="h-3 w-3 mr-1" />
                <span className="hidden lg:inline">{t('view_snapshot')}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Event Actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground truncate flex-1 mr-2">
          {event.has_clip ? (
            t('duration', { duration: event.end_time ? Math.round(event.end_time - event.start_time) : '?' })
          ) : (
            t('snapshot_only')
          )}
        </div>
        <div className="flex gap-1 flex-shrink-0">
          {event.has_clip && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 w-5 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onDownload?.(event);
              }}
              title={t('download_clip')}
            >
              <Download className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`/events/${event.id}`, '_blank');
            }}
            title={t('open_new_tab')}
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
  const t = useTranslations('events.sidebar');

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
      <div className="p-2 lg:p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-base lg:text-lg font-semibold">{t('title')}</h3>
          <Badge variant="secondary" className="text-xs">{events.length}</Badge>
        </div>
      </div>

      {/* Events List */}
      <ScrollArea className="flex-1">
        <div className="p-2 lg:p-4 space-y-2 lg:space-y-4">
          {hours.length > 0 ? (
            hours.map(hour => (
              <div key={hour}>
                {/* Hour Header */}
                <div className="flex items-center gap-2 mb-2 lg:mb-3">
                  <div className="text-sm font-medium text-muted-foreground">{hour}</div>
                  <div className="flex-1 h-px bg-border"></div>
                  <Badge variant="outline" className="text-xs">
                    {groupedEvents[hour].length}
                  </Badge>
                </div>

                {/* Events for this hour */}
                <div className="space-y-2 lg:space-y-3">
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
            <div className="text-center py-6 lg:py-8 text-muted-foreground">
              <div className="text-2xl lg:text-4xl mb-2">👁️</div>
              <div className="text-sm">{t('no_events_found')}</div>
              <div className="text-xs mt-1">{t('adjust_filters_hint')}</div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer Stats */}
      <div className="p-2 lg:p-4 border-t bg-muted/20">
        <div className="grid grid-cols-2 gap-2 lg:gap-4 text-center">
          <div>
            <div className="text-base lg:text-lg font-semibold text-foreground">{events.length}</div>
            <div className="text-xs text-muted-foreground">{t('total')}</div>
          </div>
          <div>
            <div className="text-base lg:text-lg font-semibold text-foreground">
              {events.filter(e => e.has_clip).length}
            </div>
            <div className="text-xs text-muted-foreground">{t('videos')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}