"use client";

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { format } from 'date-fns';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Download,
  Maximize,
  RotateCcw,
  ZoomIn,
  X
} from 'lucide-react';
import {
  IconUser, IconCar, IconTruck, IconBike, IconMotorbike, IconBus,
  IconDog, IconCat, IconPackage, IconQuestionMark, IconSearch
} from '@tabler/icons-react';
import type { FrigateEvent } from '@/lib/frigate-api';

interface EventPlayerProps {
  event: FrigateEvent | null;
  onPreviousEvent?: () => void;
  onNextEvent?: () => void;
  onDownload?: (event: FrigateEvent) => void;
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
  person: 'text-blue-600',
  car: 'text-green-600',
  truck: 'text-orange-600',
  bicycle: 'text-purple-600',
  motorcycle: 'text-red-600',
  bus: 'text-yellow-600',
  cat: 'text-pink-600',
  dog: 'text-amber-600',
  bird: 'text-sky-600',
  package: 'text-gray-600',
  license_plate: 'text-green-600',
  lpr: 'text-green-600',
  vehicle: 'text-green-600',
  unknown: 'text-slate-600'
};

export default function EventPlayer({ 
  event, 
  onPreviousEvent, 
  onNextEvent, 
  onDownload,
  className 
}: EventPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const translate_player = useTranslations('events.player');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [showImageModal, setShowImageModal] = useState(false);
  const [imageModalUrl, setImageModalUrl] = useState<string>('');

  const IconComponent = event ? (OBJECT_ICONS[event.label] || OBJECT_ICONS.unknown) : IconSearch;
  const colorClass = event ? (OBJECT_COLORS[event.label] || OBJECT_COLORS.unknown) : OBJECT_COLORS.unknown;

  // Load event clip when event changes
  useEffect(() => {
    if (event) {
      if (event.has_clip) {
        loadEventClip();
      } else {
        // Solo mostrar snapshot si no hay clip
        setShowThumbnail(true);
        setIsPlaying(false);
        setError(null);
      }
    }
  }, [event?.id]);

  const loadEventClip = async () => {
    if (!event || !videoRef.current) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const clipUrl = `/api/frigate/events/${event.id}/clip.mp4`;
      console.log('EventPlayer: Loading clip for event:', event.id, clipUrl);
      
      // Test if clip is available with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const testResponse = await fetch(clipUrl, { 
          method: 'HEAD',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (testResponse.ok) {
          videoRef.current.src = clipUrl;
          setShowThumbnail(true); // Show thumbnail until user clicks play
          console.log('EventPlayer: Clip loaded successfully for event:', event.id);
        } else {
          console.warn('EventPlayer: Clip not available for event:', event.id, 'Status:', testResponse.status);
          setError('Video clip not available for this event');
          setShowThumbnail(true);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.warn('EventPlayer: Clip load timeout for event:', event.id);
          setError('Clip load timeout - server may be busy');
        } else {
          console.error('EventPlayer: Fetch error for event:', event.id, fetchError);
          setError('Failed to check clip availability');
        }
        setShowThumbnail(true);
      }
      
    } catch (err: any) {
      console.error('EventPlayer: Unexpected error loading clip for event:', event.id, err);
      setError('Failed to load event clip');
      setShowThumbnail(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = () => {
    if (!videoRef.current || !event?.has_clip) return;
    
    if (showThumbnail) {
      setShowThumbnail(false);
    }
    
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
      videoRef.current.volume = volume;
      setIsMuted(false);
    } else {
      videoRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const handleDownload = () => {
    if (event && onDownload) {
      onDownload(event);
    }
  };

  const handleEnlargeSnapshot = () => {
    if (event?.thumbnail) {
      setImageModalUrl(event.thumbnail);
      setShowImageModal(true);
    }
  };

  const getSnapshotUrl = () => {
    if (!event) return '';
    return event.thumbnail || `/api/frigate/events/${event.id}/snapshot.jpg`;
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  const handleReplay = () => {
    if (!videoRef.current) return;
    
    videoRef.current.currentTime = 0;
    setShowThumbnail(false);
    videoRef.current.play();
    setIsPlaying(true);
  };

  if (!event) {
    return (
      <div className={`bg-card border rounded-lg ${className}`}>
        <div className="aspect-video bg-black rounded-t-lg flex items-center justify-center">
          <div className="text-center text-white">
            <div className="text-4xl mb-4">👁️</div>
            <div className="text-lg">{translate_player('no_event_selected')}</div>
            <div className="text-sm text-gray-400 mt-2">
              {translate_player('select_event_prompt')}
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="text-sm text-muted-foreground text-center">
            {translate_player('events_will_appear')}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-card border rounded-lg overflow-hidden ${className}`}>
      {/* Video/Thumbnail Area */}
      <div className="relative aspect-video bg-black">
        {/* Thumbnail */}
        {showThumbnail && event.has_snapshot && (
          <div className="relative w-full h-full">
            <Image
              src={getSnapshotUrl()}
              alt={`${event.label} detection`}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 50vw"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQwIiBoZWlnaHQ9IjM2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMTExODI3Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzZiNzI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFNuYXBzaG90PC90ZXh0Pjwvc3ZnPg==';
              }}
            />
            
            {/* Enlarge Button Overlay */}
            <div className="absolute top-4 right-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleEnlargeSnapshot}
                className="bg-black/80 hover:bg-black/90 text-white border-white/20"
                title="Ampliar imagen"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Video Element */}
        <video
          ref={videoRef}
          className={`w-full h-full object-contain ${showThumbnail ? 'hidden' : 'block'}`}
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
          onEnded={() => {
            setIsPlaying(false);
            setShowThumbnail(true);
          }}
          onError={() => {
            setError('Failed to play event clip');
            setShowThumbnail(true);
          }}
        />

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-white">{translate_player('loading_clip')}</div>
          </div>
        )}

        {/* Error Overlay */}
        {error && (
          <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white text-center p-4">
            <div>
              <div className="text-2xl mb-2">⚠️</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        )}

        {/* Play Button Overlay - Solo si hay clip */}
        {showThumbnail && event.has_clip && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <Button
              size="lg"
              className="bg-white/90 hover:bg-white text-black"
              onClick={handlePlayPause}
            >
              <Play className="h-6 w-6 mr-2" />
              {translate_player('play_video')}
            </Button>
          </div>
        )}
        
        {/* No Video Available Message */}
        {showThumbnail && !event.has_clip && event.has_snapshot && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="bg-black/80 text-white px-4 py-2 rounded-lg text-center">
              <div className="text-sm font-medium mb-1">{translate_player('snapshot_only')}</div>
              <div className="text-xs text-gray-300">{translate_player('click_to_enlarge')}</div>
            </div>
          </div>
        )}

        {/* Event Info Overlay */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
          <Badge className="bg-black/80 text-white border-white/20">
            <span className="mr-1"><IconComponent size={16} /></span>
            {event.label}
          </Badge>
          <div className="text-white text-sm bg-black/80 px-2 py-1 rounded">
            {format(new Date(event.start_time * 1000), 'HH:mm:ss')}
          </div>
        </div>
      </div>

      {/* Event Details */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <IconComponent size={20} className={colorClass} />
              {event.label} {translate_player('detection')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {event.camera} • {format(new Date(event.start_time * 1000), 'PPP p')}
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">{translate_player('duration')}</div>
            <div className="font-mono">
              {event.end_time ? Math.round(event.end_time - event.start_time) : '?'}s
            </div>
          </div>
        </div>

        {/* Capabilities */}
        <div className="flex gap-2">
          {event.has_clip && (
            <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
              {translate_player('video_available')}
            </Badge>
          )}
          {event.has_snapshot && (
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
              {translate_player('snapshot_available')}
            </Badge>
          )}
          {!event.has_clip && !event.has_snapshot && (
            <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
              {translate_player('no_media')}
            </Badge>
          )}
        </div>
      </div>
      
      {/* Controls */}
      <div className="bg-gray-900 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPreviousEvent}
              className="text-white hover:bg-gray-800"
              disabled={!onPreviousEvent}
              title={translate_player('previous_event')}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePlayPause}
              className="text-white hover:bg-gray-800"
              disabled={!event.has_clip}
              title={event.has_clip ? (isPlaying ? translate_player('pause') : translate_player('play')) : translate_player('no_video_available')}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleReplay}
              className="text-white hover:bg-gray-800"
              disabled={!event.has_clip}
              title={event.has_clip ? translate_player('replay') : translate_player('no_video_available')}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onNextEvent}
              className="text-white hover:bg-gray-800"
              disabled={!onNextEvent}
              title={translate_player('next_event')}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            
            {/* Enlarge snapshot button for events without video */}
            {!event.has_clip && event.has_snapshot && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEnlargeSnapshot}
                className="text-white hover:bg-gray-800 border border-gray-600"
                title={translate_player('enlarge_snapshot')}
              >
                <ZoomIn className="h-4 w-4 mr-1" />
                {translate_player('enlarge')}
              </Button>
            )}
          </div>
          
          {/* Volume Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMute}
              className="text-white hover:bg-gray-800"
              disabled={!event.has_clip}
              title={event.has_clip ? (isMuted ? translate_player('unmute') : translate_player('mute')) : translate_player('no_audio_available')}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="text-white hover:bg-gray-800"
              disabled={!event.has_clip}
              title={event.has_clip ? translate_player('download_video') : translate_player('no_video_to_download')}
            >
              <Download className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFullscreen}
              className="text-white hover:bg-gray-800"
              disabled={showThumbnail || !event.has_clip}
              title={event.has_clip ? translate_player('fullscreen') : translate_player('not_available')}
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Snapshot Enlargement Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-4xl w-full h-[90vh] p-0 bg-black border-gray-700">
          <div className="relative w-full h-full">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 z-10 bg-black/80 hover:bg-black/90 text-white"
            >
              <X className="h-4 w-4" />
            </Button>
            
            {/* Event Info Header */}
            <div className="absolute top-4 left-4 z-10 bg-black/80 text-white px-3 py-2 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <IconComponent size={16} />
                <span className="font-medium">{event?.label}</span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-300">{event?.camera}</span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-300">
                  {event && format(new Date(event.start_time * 1000), 'PPP p')}
                </span>
              </div>
            </div>
            
            {/* Full Size Image */}
            {imageModalUrl && (
              <Image
                src={imageModalUrl}
                alt={`${event?.label} detection - Full size`}
                fill
                className="object-contain"
                sizes="90vw"
                priority
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}