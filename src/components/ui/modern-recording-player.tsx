"use client";

import { useEffect, useRef, useState, useCallback } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Download,
  Scissors,
  Maximize,
  RotateCcw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import {
  IconUser, IconCar, IconTruck, IconBike, IconMotorbike, IconBus,
  IconDog, IconCat, IconPackage, IconQuestionMark, IconSearch
} from '@tabler/icons-react';
import type { FrigateEvent, RecordingTimelineData } from '@/lib/frigate-api';

// Import HLS.js dynamically to avoid SSR issues
let Hls: any = null;
if (typeof window !== 'undefined') {
  import('hls.js').then((module) => {
    Hls = module.default;
  });
}

interface ModernRecordingPlayerProps {
  camera: string;
  data: RecordingTimelineData | null;
  timestamp?: number;
  onTimeSelect?: (timestamp: number) => void;
  className?: string;
}

// Minimal icons for detections
const DETECTION_ICONS: Record<string, any> = {
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

export default function ModernRecordingPlayer({ 
  camera, 
  data,
  timestamp, 
  onTimeSelect,
  className
}: ModernRecordingPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<any>(null);
  
  // Video state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  // Timeline state
  const [currentHour, setCurrentHour] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0);
  });
  const [isDragging, setIsDragging] = useState(false);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  
  // UI state
  const [activeTab, setActiveTab] = useState<'timeline' | 'events'>('timeline');

  const hourStart = Math.floor(currentHour.getTime() / 1000);
  const hourEnd = hourStart + 3600;
  
  // Speed options
  const speedOptions = [0.25, 0.5, 1, 1.5, 2, 4, 6, 8];

  // Timeline utility functions
  const timeToPixel = useCallback((timestamp: number) => {
    if (!timelineRef.current) return 0;
    const timelineWidth = timelineRef.current.offsetWidth;
    const relativeTime = timestamp - hourStart;
    return (relativeTime / 3600) * timelineWidth;
  }, [hourStart]);

  const pixelToTime = useCallback((pixel: number) => {
    if (!timelineRef.current) return hourStart;
    const timelineWidth = timelineRef.current.offsetWidth;
    const relativePixel = pixel / timelineWidth;
    return hourStart + (relativePixel * 3600);
  }, [hourStart]);

  // Generate HLS stream URL
  const getHLSUrl = (time: number) => {
    if (!camera || !time) return '';
    const duration = 300; // 5 minutes
    const start = time - 150;
    const end = time + 150;
    return `/api/frigate/recordings/hls?camera=${encodeURIComponent(camera)}&start=${start}&end=${end}`;
  };

  // Load HLS stream
  const loadHLSStream = async (streamUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!videoRef.current) {
        reject(new Error('Video element not available'));
        return;
      }

      const video = videoRef.current;

      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.onloadeddata = () => {
          setError(null);
          resolve();
        };
        video.onerror = () => reject(new Error('Failed to play native HLS stream'));
      } else if (Hls && Hls.isSupported()) {
        const hls = new Hls({ debug: false, enableWorker: false });
        hlsRef.current = hls;
        
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setError(null);
          resolve();
        });
        
        hls.on(Hls.Events.ERROR, (event: any, data: any) => {
          if (data.fatal) {
            hls.destroy();
            hlsRef.current = null;
            reject(new Error(`HLS error: ${data.type}`));
          }
        });
      } else {
        reject(new Error('HLS not supported'));
      }
    });
  };

  // Load recording
  const loadRecording = async (time: number) => {
    if (!videoRef.current || !time) return;
    
    setIsLoading(true);
    setError(null);
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    try {
      const hlsUrl = getHLSUrl(time);
      const hlsResponse = await fetch(hlsUrl);
      
      if (hlsResponse.ok) {
        const hlsData = await hlsResponse.json();
        if (hlsData.success && hlsData.streamUrl) {
          await loadHLSStream(hlsData.streamUrl);
          setIsLoading(false);
          return;
        }
      }
      
      setError('Recording not available');
    } catch (err) {
      setError('Failed to load recording');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle video playback speed
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Load recording when timestamp changes
  useEffect(() => {
    if (timestamp) {
      loadRecording(timestamp);
    }
  }, [timestamp]);

  // Timeline event handlers
  const handleTimelineClick = (event: React.MouseEvent) => {
    if (isDragging) {
      setIsDragging(false);
      return;
    }
    
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickTime = Math.floor(pixelToTime(clickX));
    
    if (event.shiftKey && selectionStart !== null) {
      const start = Math.min(selectionStart, clickTime);
      const end = Math.max(selectionStart, clickTime);
      setSelectionRange({ start, end });
      setIsSelecting(false);
      setSelectionStart(null);
    } else if (event.shiftKey) {
      setSelectionStart(clickTime);
      setIsSelecting(true);
    } else {
      onTimeSelect?.(clickTime);
      setSelectionStart(null);
      setIsSelecting(false);
    }
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    if (!timelineRef.current || event.shiftKey) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickTime = Math.floor(pixelToTime(clickX));
    
    setIsDragging(true);
    onTimeSelect?.(clickTime);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (isDragging && timelineRef.current && event.buttons === 1) {
      const rect = timelineRef.current.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const moveTime = Math.floor(pixelToTime(mouseX));
      onTimeSelect?.(moveTime);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setTimeout(() => setIsDragging(false), 10);
    }
  };

  // Navigate hours
  const navigateHour = (direction: 'prev' | 'next') => {
    const newHour = new Date(currentHour);
    if (direction === 'prev') {
      newHour.setHours(newHour.getHours() - 1);
    } else {
      newHour.setHours(newHour.getHours() + 1);
    }
    setCurrentHour(newHour);
  };

  const goToCurrentHour = () => {
    const now = new Date();
    setCurrentHour(new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0, 0));
  };

  // Get data for current hour
  const hourEvents = data?.events?.filter(event => 
    event.start_time >= hourStart && event.start_time < hourEnd
  ) || [];

  const hourSegments = data?.segments?.filter(segment => 
    segment.start_time < hourEnd && segment.end_time > hourStart
  ) || [];

  // Group nearby events
  const groupedEvents = hourEvents.reduce((groups: any[], event) => {
    const existingGroup = groups.find(group => 
      Math.abs(group.timestamp - event.start_time) < 30 // 30 seconds tolerance
    );
    
    if (existingGroup) {
      existingGroup.events.push(event);
      existingGroup.count = existingGroup.events.length;
    } else {
      groups.push({
        timestamp: event.start_time,
        events: [event],
        count: 1,
        mainLabel: event.label
      });
    }
    
    return groups;
  }, []);

  // Generate minute markers
  const getMinuteMarkers = () => {
    const markers = [];
    for (let i = 0; i <= 60; i += 5) {
      markers.push(hourStart + (i * 60));
    }
    return markers;
  };

  // Video controls
  const handlePlayPause = async () => {
    if (!videoRef.current) return;
    
    try {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        await videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    } catch (playError: any) {
      console.error('ModernRecordingPlayer: Play error:', playError);
      
      if (playError.name === 'NotAllowedError') {
        console.warn('ModernRecordingPlayer: Autoplay blocked - user interaction required');
        setError('Haz clic en el botón de reproducción para iniciar el video');
      } else {
        setError(`Error al reproducir: ${playError.message}`);
      }
    }
  };

  const handleSeek = (value: number[]) => {
    if (!videoRef.current) return;
    const seekTime = (value[0] / 100) * duration;
    videoRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const handleVolumeChange = (value: number[]) => {
    if (!videoRef.current) return;
    const newVolume = value[0] / 100;
    videoRef.current.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
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

  const handleDownloadSelection = () => {
    if (!selectionRange) return;
    
    const downloadUrl = `/api/frigate/recordings/video?camera=${encodeURIComponent(camera)}&start=${selectionRange.start}&end=${selectionRange.end}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${camera}_${format(new Date(selectionRange.start * 1000), 'yyyy-MM-dd_HH-mm-ss')}_to_${format(new Date(selectionRange.end * 1000), 'HH-mm-ss')}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const clearSelection = () => {
    setSelectionRange(null);
    setSelectionStart(null);
    setIsSelecting(false);
  };

  return (
    <div className={`h-screen flex flex-col bg-black ${className}`}>
      {/* Video Area */}
      <div className="flex-1 relative">
        <video
          ref={videoRef}
          className="w-full h-full object-contain bg-black"
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
        />
        
        {/* Loading/Error Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white">Loading recording...</div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black text-white text-center p-4">
            <div className="max-w-md">
              <div className="text-lg mb-2">📹</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        )}
        
        {!timestamp && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black text-white text-center">
            <div>
              <div className="text-2xl mb-4">📹</div>
              <div className="text-sm text-gray-400">
                Select a time on the timeline to view recording
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="bg-gray-900 border-t border-gray-700">
        {/* Main Controls Row */}
        <div className="flex items-center gap-4 px-6 py-3">
          {/* Left: Playback Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = Math.max(0, currentTime - 10);
                }
              }}
              className="text-white hover:bg-white/20 h-8 w-8"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePlayPause}
              className="text-white hover:bg-white/20 h-10 w-10 bg-white/10"
              disabled={!timestamp || error !== null}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = Math.min(duration, currentTime + 10);
                }
              }}
              className="text-white hover:bg-white/20 h-8 w-8"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            
            {/* Volume */}
            <div className="flex items-center gap-2 ml-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMute}
                className="text-white hover:bg-white/20 h-8 w-8"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              
              <Slider
                value={[isMuted ? 0 : volume * 100]}
                onValueChange={handleVolumeChange}
                max={100}
                step={1}
                className="w-20"
              />
            </div>
          </div>

          {/* Center: Timeline Progress */}
          <div className="flex-1 flex items-center gap-4">
            <div className="text-white text-sm font-mono min-w-[50px]">
              {format(new Date(currentTime * 1000), 'mm:ss')}
            </div>
            
            <Slider
              value={[duration ? (currentTime / duration) * 100 : 0]}
              onValueChange={handleSeek}
              max={100}
              step={0.1}
              className="flex-1"
            />
            
            <div className="text-white text-sm font-mono min-w-[50px]">
              {format(new Date(duration * 1000), 'mm:ss')}
            </div>
          </div>

          {/* Right: Speed & Actions */}
          <div className="flex items-center gap-4">
            {/* Speed Control */}
            <div className="flex items-center gap-2">
              <span className="text-white text-sm">Speed:</span>
              <select
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="bg-gray-800 text-white text-sm rounded px-2 py-1 border border-gray-600 min-w-[60px]"
              >
                {speedOptions.map(speed => (
                  <option key={speed} value={speed}>
                    {speed === 1 ? '1x' : `${speed}x`}
                  </option>
                ))}
              </select>
            </div>

            {/* Selection Actions */}
            {selectionRange && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {Math.round((selectionRange.end - selectionRange.start) / 60)}m {((selectionRange.end - selectionRange.start) % 60)}s
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadSelection}
                  className="text-white border-gray-600 hover:bg-gray-700 h-8"
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="text-white hover:bg-gray-700 h-8"
                >
                  <Scissors className="h-3 w-3" />
                </Button>
              </div>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (videoRef.current && videoRef.current.requestFullscreen) {
                  videoRef.current.requestFullscreen();
                }
              }}
              className="text-white hover:bg-white/20 h-8 w-8"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Timeline Section */}
        <div className="px-6 pb-4">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'timeline' | 'events')}>
            <div className="flex items-center justify-between mb-3">
              <TabsList className="bg-gray-800">
                <TabsTrigger value="timeline" className="text-sm">Línea de tiempo</TabsTrigger>
                <TabsTrigger value="events" className="text-sm">Eventos</TabsTrigger>
              </TabsList>
              
              {/* Hour Navigation */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateHour('prev')}
                  className="text-white hover:bg-white/20 h-8 w-8"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <div className="text-white text-sm font-mono bg-gray-800 px-3 py-1 rounded">
                  {format(currentHour, 'HH:mm')} - {format(new Date(currentHour.getTime() + 3600000), 'HH:mm')}
                </div>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateHour('next')}
                  className="text-white hover:bg-white/20 h-8 w-8"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={goToCurrentHour}
                  className="text-white hover:bg-white/20 h-8 w-8"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <TabsContent value="timeline" className="space-y-2 mt-0">
              {/* Time labels */}
              <div className="relative h-4">
                {getMinuteMarkers().map(timestamp => (
                  <div
                    key={timestamp}
                    className="absolute text-xs text-gray-400 transform -translate-x-1/2"
                    style={{ left: `${timeToPixel(timestamp)}px` }}
                  >
                    {format(new Date(timestamp * 1000), new Date(timestamp * 1000).getMinutes() === 0 ? 'HH:mm' : ':mm')}
                  </div>
                ))}
              </div>

              {/* Timeline */}
              <div 
                ref={timelineRef}
                className="relative h-12 bg-gray-800 rounded cursor-pointer border border-gray-600 select-none"
                onClick={handleTimelineClick}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                {/* Recording segments */}
                {hourSegments.map((segment, index) => {
                  const segmentStart = Math.max(segment.start_time, hourStart);
                  const segmentEnd = Math.min(segment.end_time, hourEnd);
                  const startPixel = timeToPixel(segmentStart);
                  const endPixel = timeToPixel(segmentEnd);
                  const width = Math.max(2, endPixel - startPixel);
                  
                  return (
                    <div
                      key={index}
                      className="absolute top-1 bottom-1 bg-blue-500 rounded"
                      style={{
                        left: `${startPixel}px`,
                        width: `${width}px`,
                      }}
                    />
                  );
                })}

                {/* Event markers - grouped */}
                {groupedEvents.map((group, index) => {
                  const eventPixel = timeToPixel(group.timestamp);
                  const IconComponent = DETECTION_ICONS[group.mainLabel] || DETECTION_ICONS.unknown;
                  
                  return (
                    <div
                      key={index}
                      className={`absolute top-0 bottom-0 flex items-center justify-center z-10 ${isDragging ? 'pointer-events-none' : ''}`}
                      style={{ left: `${eventPixel - 8}px`, width: '16px' }}
                    >
                      <div className="relative">
                        <div className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center text-xs text-white border border-white">
                          <IconComponent size={16} />
                        </div>
                        {group.count > 1 && (
                          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                            {group.count}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Current time indicator */}
                {timestamp && timestamp >= hourStart && timestamp < hourEnd && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
                    style={{ left: `${timeToPixel(timestamp)}px` }}
                  />
                )}

                {/* Selection range */}
                {selectionRange && (
                  <div
                    className="absolute top-0 bottom-0 bg-yellow-400/30 border border-yellow-500 z-10"
                    style={{
                      left: `${timeToPixel(Math.max(selectionRange.start, hourStart))}px`,
                      width: `${timeToPixel(Math.min(selectionRange.end, hourEnd)) - timeToPixel(Math.max(selectionRange.start, hourStart))}px`,
                    }}
                  />
                )}

                {/* Minute markers */}
                {getMinuteMarkers().map(timestamp => (
                  <div
                    key={timestamp}
                    className="absolute top-0 bottom-0 w-px bg-gray-600/50"
                    style={{ left: `${timeToPixel(timestamp)}px` }}
                  />
                ))}
              </div>
              
              <div className="text-xs text-gray-400">
                Click or drag to seek • Shift+Click to select range
              </div>
            </TabsContent>

            <TabsContent value="events" className="mt-0">
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {hourEvents.length === 0 ? (
                  <div className="text-gray-400 text-sm text-center py-4">
                    No events in this hour
                  </div>
                ) : (
                  hourEvents.map(event => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 p-2 bg-gray-800 rounded cursor-pointer hover:bg-gray-700"
                      onClick={() => onTimeSelect?.(event.start_time)}
                    >
                      <div className="text-lg">{(() => {
                        const IconComponent = DETECTION_ICONS[event.label] || DETECTION_ICONS.unknown;
                        return <IconComponent size={18} />;
                      })()}</div>
                      <div className="flex-1">
                        <div className="text-white text-sm font-medium capitalize">{event.label}</div>
                        <div className="text-gray-400 text-xs">
                          {format(new Date(event.start_time * 1000), 'HH:mm:ss')} • {event.end_time ? Math.round((event.end_time - event.start_time)) : 0}s
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        Hace {Math.round((Date.now() / 1000 - event.start_time) / 60)}m
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}