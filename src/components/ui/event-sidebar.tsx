"use client";

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import Image from 'next/image';
import type { FrigateEvent } from '@/lib/frigate-api';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize, X } from 'lucide-react';
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
  onDownload,
  onImageClick
}: {
  event: FrigateEvent;
  isSelected: boolean;
  onSelect?: (event: FrigateEvent) => void;
  onPlay?: (event: FrigateEvent) => void;
  onDownload?: (event: FrigateEvent) => void;
  onImageClick?: (event: FrigateEvent) => void;
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
      <div className="relative aspect-video bg-black rounded overflow-hidden mb-2 cursor-pointer" onClick={() => onSelect?.(event)}>
        {event.has_snapshot || event.thumbnail ? (
          <Image
            src={event.thumbnail || `/api/frigate/events/${event.id}/snapshot.jpg`}
            alt={`${event.label} detection`}
            fill
            className="object-cover hover:opacity-90 transition-opacity"
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
        {event.has_snapshot && (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onImageClick?.(event);
            }}
            className="h-6 px-2 text-xs bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
          >
            Foto
          </Button>
        )}
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
  const translate_sidebar = useTranslations('events.sidebar');
  const [loadingThumbnails, setLoadingThumbnails] = useState<Set<string>>(new Set());
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImageEvent, setSelectedImageEvent] = useState<FrigateEvent | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Handle image click to open modal
  const handleImageClick = (event: FrigateEvent) => {
    if (event.has_snapshot) {
      setSelectedImageEvent(event);
      setImageModalOpen(true);
    }
  };

  // Video controls
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleMute = () => {
    if (!videoRef.current) return;
    
    if (isMuted) {
      videoRef.current.volume = 1;
      setIsMuted(false);
    } else {
      videoRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handleSeek = (direction: 'forward' | 'backward') => {
    if (!videoRef.current) return;
    
    const seekAmount = 10; // 10 seconds
    const newTime = direction === 'forward' 
      ? Math.min(duration, currentTime + seekAmount)
      : Math.max(0, currentTime - seekAmount);
    
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  // Reset video state when modal opens/closes
  useEffect(() => {
    if (!imageModalOpen) {
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setIsMuted(false);
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [imageModalOpen]);

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
          <h3 className="text-xl font-semibold">{translate_sidebar('title')}</h3>
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
                      onImageClick={handleImageClick}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-4xl mb-2">👁️</div>
              <div className="text-sm">{translate_sidebar('no_events_found')}</div>
              <div className="text-xs mt-1">{translate_sidebar('try_adjusting_filters')}</div>
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

      {/* Image/Video Modal */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="max-w-4xl w-full h-[90vh] p-0 bg-black border-gray-700">
          <DialogTitle className="sr-only">
            {selectedImageEvent ? `${selectedImageEvent.label} detection - ${selectedImageEvent.camera}` : 'Event Media'}
          </DialogTitle>
          <div className="relative w-full h-full flex flex-col">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setImageModalOpen(false)}
              className="absolute top-4 right-4 z-10 bg-black/80 hover:bg-black/90 text-white"
            >
              <X className="h-4 w-4" />
            </Button>
            
            {/* Event Info Header */}
            <div className="absolute top-4 left-4 z-10 bg-black/80 text-white px-3 py-2 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                {selectedImageEvent && (
                  <>
                    {(() => {
                      const IconComp = OBJECT_ICONS[selectedImageEvent.label] || OBJECT_ICONS.unknown;
                      return <IconComp size={16} />;
                    })()}
                    <span className="font-medium">{selectedImageEvent.label}</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-300">{selectedImageEvent.camera}</span>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-300">
                      {format(new Date(selectedImageEvent.start_time * 1000), 'PPP p')}
                    </span>
                  </>
                )}
              </div>
            </div>
            
            {/* Media Content */}
            <div className="flex-1 flex items-center justify-center p-4">
              {selectedImageEvent?.has_clip ? (
                <video
                  ref={videoRef}
                  className="max-w-full max-h-full object-contain"
                  src={`/api/frigate/events/${selectedImageEvent.id}/clip.mp4`}
                  onLoadedMetadata={() => {
                    if (videoRef.current) {
                      setDuration(videoRef.current.duration);
                    }
                  }}
                  onTimeUpdate={() => {
                    if (videoRef.current) {
                      setCurrentTime(videoRef.current.currentTime);
                    }
                  }}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                />
              ) : (
                selectedImageEvent && (
                  <Image
                    src={selectedImageEvent.thumbnail || `/api/frigate/events/${selectedImageEvent.id}/snapshot.jpg`}
                    alt={`${selectedImageEvent.label} detection - Full size`}
                    width={800}
                    height={600}
                    className="max-w-full max-h-full object-contain"
                    priority
                  />
                )
              )}
            </div>
            
            {/* Video Controls */}
            {selectedImageEvent?.has_clip && (
              <div className="bg-gray-900 border-t border-gray-700 px-4 py-3">
                <div className="flex items-center justify-between">
                  {/* Left - Playback Controls */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSeek('backward')}
                      className="text-white hover:bg-white/20 h-8 w-8 rounded-full"
                    >
                      <SkipBack className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePlayPause}
                      className="text-white hover:bg-white/20 h-10 w-12 rounded-lg bg-white/10 border border-white/20"
                    >
                      {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSeek('forward')}
                      className="text-white hover:bg-white/20 h-8 w-8 rounded-full"
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                    
                    {/* Volume Control */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMute}
                      className="text-white hover:bg-white/20 h-8 w-8 ml-4"
                    >
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                  </div>
                  
                  {/* Center - Time Info */}
                  <div className="flex flex-col items-center text-white">
                    <div className="text-xs text-gray-400">
                      {format(new Date(currentTime * 1000), 'mm:ss')} / {format(new Date(duration * 1000), 'mm:ss')}
                    </div>
                  </div>
                  
                  {/* Right - Fullscreen */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleFullscreen}
                      className="text-white hover:bg-white/20 h-8 w-8"
                    >
                      <Maximize className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}