"use client";

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
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

// Colors for different object types - theme aware
const getObjectColors = (theme: string | undefined) => {
  const isDark = theme === 'dark';
  return {
    person: isDark ? 'text-blue-400' : 'text-blue-600',
    car: isDark ? 'text-green-400' : 'text-green-600',
    truck: isDark ? 'text-orange-400' : 'text-orange-600',
    bicycle: isDark ? 'text-purple-400' : 'text-purple-600',
    motorcycle: isDark ? 'text-red-400' : 'text-red-600',
    bus: isDark ? 'text-yellow-400' : 'text-yellow-600',
    cat: isDark ? 'text-pink-400' : 'text-pink-600',
    dog: isDark ? 'text-amber-400' : 'text-amber-600',
    bird: isDark ? 'text-sky-400' : 'text-sky-600',
    package: isDark ? 'text-gray-400' : 'text-gray-600',
    license_plate: isDark ? 'text-green-400' : 'text-green-600',
    lpr: isDark ? 'text-green-400' : 'text-green-600',
    vehicle: isDark ? 'text-green-400' : 'text-green-600',
    unknown: isDark ? 'text-slate-400' : 'text-slate-600'
  };
};

export default function EventPlayer({ 
  event, 
  onPreviousEvent, 
  onNextEvent, 
  onDownload,
  className 
}: EventPlayerProps) {
  const t = useTranslations('eventPlayer');
  const { theme } = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
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
  const [userInteractionRequired, setUserInteractionRequired] = useState(false);
  const [imageEnhancement, setImageEnhancement] = useState({
    sharpness: 1.0,
    contrast: 1.0,
    brightness: 1.0,
    saturation: 1.0
  });

  const IconComponent = event ? (OBJECT_ICONS[event.label] || OBJECT_ICONS.unknown) : IconSearch;
  const objectColors = getObjectColors(theme);
  const colorClass = event ? (objectColors[event.label as keyof typeof objectColors] || objectColors.unknown) : objectColors.unknown;

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
      // Reset user interaction state when event changes
      setUserInteractionRequired(false);
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
          console.log('EventPlayer: Clip HEAD request successful, Content-Type:', testResponse.headers.get('Content-Type'));
          
          // Reset video element before setting new source
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
          videoRef.current.src = '';
          videoRef.current.load(); // Reset video element state
          
          // Set new source with cache-busting parameter
          const timestamp = Date.now();
          videoRef.current.src = `${clipUrl}?t=${timestamp}`;
          
          setShowThumbnail(true); // Show thumbnail until user clicks play
          console.log('EventPlayer: Clip URL set successfully for event:', event.id);
        } else {
          console.warn('EventPlayer: Clip not available for event:', event.id, 'Status:', testResponse.status);
          setError(t('clipUnavailable', { status: testResponse.status }));
          setShowThumbnail(true);
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError.name === 'AbortError') {
          console.warn('EventPlayer: Clip load timeout for event:', event.id);
          setError(t('timeoutError'));
        } else {
          console.error('EventPlayer: Fetch error for event:', event.id, fetchError);
          setError(t('verificationError'));
        }
        setShowThumbnail(true);
      }
      
    } catch (err: any) {
      console.error('EventPlayer: Unexpected error loading clip for event:', event.id, err);
      setError(t('unexpectedError'));
      setShowThumbnail(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayPause = async () => {
    if (!videoRef.current || !event?.has_clip) return;
    
    if (showThumbnail) {
      setShowThumbnail(false);
    }
    
    try {
      if (isPlaying) {
        videoRef.current.pause();
        setUserInteractionRequired(false);
      } else {
        // Ensure video is ready to play
        if (videoRef.current.readyState < 2) {
          console.log('EventPlayer: Video not ready, waiting for metadata...');
          setIsLoading(true);
          await new Promise((resolve, reject) => {
            const video = videoRef.current!;
            const timeout = setTimeout(() => {
              reject(new Error('Video load timeout'));
            }, 5000);
            
            const onLoadedData = () => {
              clearTimeout(timeout);
              video.removeEventListener('loadeddata', onLoadedData);
              video.removeEventListener('error', onError);
              resolve(void 0);
            };
            
            const onError = () => {
              clearTimeout(timeout);
              video.removeEventListener('loadeddata', onLoadedData);
              video.removeEventListener('error', onError);
              reject(new Error('Video load error'));
            };
            
            video.addEventListener('loadeddata', onLoadedData);
            video.addEventListener('error', onError);
            
            if (video.readyState >= 2) {
              onLoadedData();
            }
          });
          setIsLoading(false);
        }
        
        await videoRef.current.play();
        console.log('EventPlayer: Video playback started successfully');
        setUserInteractionRequired(false);
      }
      setIsPlaying(!isPlaying);
    } catch (playError: any) {
      console.error('EventPlayer: Play error:', playError);
      
      // Handle NotAllowedError specifically
      if (playError.name === 'NotAllowedError') {
        console.warn('EventPlayer: Autoplay blocked - user interaction required');
        setUserInteractionRequired(true);
        setError(t('clickToPlay'));
        setShowThumbnail(true);
        setIsPlaying(false);
      } else {
        setError(t('playbackError', { message: playError.message }));
        setShowThumbnail(true);
        setIsPlaying(false);
      }
      setIsLoading(false);
    }
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

  const handleReplay = async () => {
    if (!videoRef.current) return;
    
    videoRef.current.currentTime = 0;
    setShowThumbnail(false);
    
    try {
      await videoRef.current.play();
      setIsPlaying(true);
      setUserInteractionRequired(false);
    } catch (playError: any) {
      console.error('EventPlayer: Replay error:', playError);
      
      if (playError.name === 'NotAllowedError') {
        console.warn('EventPlayer: Replay blocked - user interaction required');
        setUserInteractionRequired(true);
        setError(t('clickToPlay'));
        setShowThumbnail(true);
        setIsPlaying(false);
      } else {
        setError(t('playbackError', { message: playError.message }));
        setShowThumbnail(true);
        setIsPlaying(false);
      }
    }
  };

  const toggleSharpness = () => {
    setImageEnhancement(prev => {
      const newSharpness = prev.sharpness === 1.0 ? 1.8 : 1.0;
      console.log('EventPlayer: Sharpness toggled:', prev.sharpness, '->', newSharpness);
      return {
        ...prev,
        sharpness: newSharpness
      };
    });
  };

  const toggleContrast = () => {
    setImageEnhancement(prev => {
      const newContrast = prev.contrast === 1.0 ? 1.4 : 1.0;
      console.log('EventPlayer: Contrast toggled:', prev.contrast, '->', newContrast);
      return {
        ...prev,
        contrast: newContrast
      };
    });
  };

  // Helper function to build CSS filter string
  const buildFilterString = () => {
    const filters = [];
    if (imageEnhancement.contrast !== 1.0) filters.push(`contrast(${imageEnhancement.contrast})`);
    if (imageEnhancement.brightness !== 1.0) filters.push(`brightness(${imageEnhancement.brightness})`);
    if (imageEnhancement.saturation !== 1.0) filters.push(`saturate(${imageEnhancement.saturation})`);
    if (imageEnhancement.sharpness > 1.0) filters.push('url(#sharpen)');
    
    const filterString = filters.join(' ');
    console.log('EventPlayer: Built filter string:', filterString, 'from:', imageEnhancement);
    return filterString;
  };

  if (!event) {
    return (
      <div className={`bg-background rounded-lg ${className}`}>
        <div className="w-full h-full bg-black rounded-lg flex items-center justify-center">
          <div className="text-center text-foreground">
            <div className="text-4xl mb-4">👁️</div>
            <div className="text-lg">{t('noEventSelected')}</div>
            <div className="text-sm text-muted-foreground mt-2">
              {t('selectEventMessage')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-black rounded-lg overflow-hidden ${className}`}>
      {/* Video/Thumbnail Area */}
      <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
        {/* Thumbnail */}
        {showThumbnail && event.has_snapshot && (
          <div className="relative w-full h-full">
            <Image
              src={getSnapshotUrl()}
              alt={`${event.label} ${t('detection')}`}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 70vw"
              style={{
                filter: buildFilterString()
              }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQwIiBoZWlnaHQ9IjM2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMTExODI3Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzZiNzI4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIFNuYXBzaG90PC90ZXh0Pjwvc3ZnPg==';
              }}
            />
            
            {/* Enlarge Button Overlay */}
            <div className="absolute top-2 lg:top-4 right-2 lg:right-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleEnlargeSnapshot}
                className="bg-black/80 hover:bg-black/90 text-white border-white/20 h-6 w-6 p-0 lg:h-8 lg:w-8"
                title={t('enlargeImage')}
              >
                <ZoomIn className="h-3 w-3 lg:h-4 lg:w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Video Element */}
        <video
          ref={videoRef}
          className={`w-full h-full object-contain ${showThumbnail ? 'hidden' : 'block'}`}
          preload="metadata"
          playsInline
          style={{
            filter: buildFilterString()
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
              console.log('EventPlayer: Video metadata loaded, duration:', videoRef.current.duration);
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
          onError={(e) => {
            console.error('EventPlayer: Video error:', e);
            const video = e.target as HTMLVideoElement;
            if (video.error) {
              console.error('EventPlayer: Video error details:', {
                code: video.error.code,
                message: video.error.message,
                MEDIA_ERR_ABORTED: video.error.MEDIA_ERR_ABORTED,
                MEDIA_ERR_NETWORK: video.error.MEDIA_ERR_NETWORK,
                MEDIA_ERR_DECODE: video.error.MEDIA_ERR_DECODE,
                MEDIA_ERR_SRC_NOT_SUPPORTED: video.error.MEDIA_ERR_SRC_NOT_SUPPORTED,
                source: video.src
              });
              
              let errorMsg = t('playbackError', { message: 'Unknown' });
              switch (video.error.code) {
                case video.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
                  errorMsg = t('unsupportedFormat');
                  break;
                case video.error.MEDIA_ERR_NETWORK:
                  errorMsg = t('networkError');
                  break;
                case video.error.MEDIA_ERR_DECODE:
                  errorMsg = t('decodeError');
                  break;
                case video.error.MEDIA_ERR_ABORTED:
                  errorMsg = t('interruptedLoad');
                  break;
              }
              setError(errorMsg);
            } else {
              setError(t('unknownPlaybackError'));
            }
            setShowThumbnail(true);
            setIsPlaying(false);
          }}
          onLoadStart={() => {
            console.log('EventPlayer: Video load started');
          }}
          onCanPlay={() => {
            console.log('EventPlayer: Video can play');
          }}
          onCanPlayThrough={() => {
            console.log('EventPlayer: Video can play through');
          }}
        />

        {/* SVG filter for sharpening */}
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

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="text-white">{t('loadingClip')}</div>
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
              {userInteractionRequired ? t('clickToPlay') : t('playVideo')}
            </Button>
          </div>
        )}
        
        {/* No Video Available Message */}
        {showThumbnail && !event.has_clip && event.has_snapshot && (
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
            <div className="bg-black/80 text-white px-4 py-2 rounded-lg text-center">
              <div className="text-sm font-medium mb-1">{t('snapshotOnly')}</div>
              <div className="text-xs text-gray-300">{t('clickToEnlarge')}</div>
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
        {/* Controls Overlay - Estilo Frigate */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4">
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onPreviousEvent}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              disabled={!onPreviousEvent}
              title={t('previousEvent')}
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePlayPause}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              disabled={!event.has_clip}
              title={event.has_clip ? (isPlaying ? t('pause') : t('play')) : t('noVideoAvailable')}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleReplay}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              disabled={!event.has_clip}
              title={event.has_clip ? t('replayVideo') : t('noVideoAvailable')}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onNextEvent}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              disabled={!onNextEvent}
              title={t('nextEvent')}
            >
              <SkipForward className="h-4 w-4" />
            </Button>

            {/* Enlarge snapshot button for events without video */}
            {!event.has_clip && event.has_snapshot && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEnlargeSnapshot}
                className="text-white hover:bg-white/20 border border-white/20 text-xs px-2 py-1 h-8"
                title={t('enlargeSnapshot')}
              >
                <ZoomIn className="h-4 w-4 mr-1" />
                <span className="hidden lg:inline">{t('enlarge')}</span>
              </Button>
            )}
            
            {/* Volume Controls */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMute}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              disabled={!event.has_clip}
              title={event.has_clip ? (isMuted ? t('enableSound') : t('mute')) : t('noAudioAvailable')}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            
            {/* Action Buttons */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              disabled={!event.has_clip}
              title={event.has_clip ? t('downloadVideo') : t('noVideoToDownload')}
            >
              <Download className="h-4 w-4" />
            </Button>
            
            {/* Theme Controls */}
            <div className="flex items-center gap-1 bg-black/70 rounded px-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleSharpness}
                className="text-white hover:bg-white/20 h-6 w-6 p-0 text-xs"
                title={t('toggleSharpness')}
              >
                S
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleContrast}
                className="text-white hover:bg-white/20 h-6 w-6 p-0 text-xs"
                title={t('toggleContrast')}
              >
                C
              </Button>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleFullscreen}
              className="text-white hover:bg-white/20 h-8 w-8 p-0"
              disabled={showThumbnail || !event.has_clip}
              title={event.has_clip ? t('fullscreen') : t('notAvailable')}
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Snapshot Enlargement Modal */}
      <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
        <DialogContent className="max-w-4xl w-full h-[90vh] p-0 bg-background border-gray-700">
          <div className="relative w-full h-full">
            {/* Close Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 z-10 bg-card/80 hover:bg-card/90 text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
            
            {/* Event Info Header */}
            <div className="absolute top-4 left-4 z-10 bg-card/80 text-foreground px-3 py-2 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <IconComponent size={16} />
                <span className="font-medium">{event?.label}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">{event?.camera}</span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">
                  {event && format(new Date(event.start_time * 1000), 'PPP p')}
                </span>
              </div>
            </div>
            
            {/* Full Size Image */}
            {imageModalUrl && (
              <Image
                src={imageModalUrl}
                alt={`${event?.label} ${t('detection')} - ${t('fullSize')}`}
                fill
                className="object-contain"
                sizes="90vw"
                priority
                style={{
                  filter: buildFilterString()
                }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}