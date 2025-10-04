"use client";

import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX,
  Download,
  Maximize
} from 'lucide-react';
import { IconZoomIn, IconZoomOut, IconZoomReset } from '@tabler/icons-react';

// Import HLS.js dynamically to avoid SSR issues
let Hls: any = null;
let hlsLoadError: any = null;

if (typeof window !== 'undefined') {
  import('hls.js').then((module) => {
    Hls = module.default;
    console.log('RecordingPlayer: HLS.js loaded successfully', {
      isSupported: Hls.isSupported(),
      version: Hls.version || 'unknown'
    });
  }).catch((error) => {
    console.error('RecordingPlayer: Failed to load HLS.js:', error);
    hlsLoadError = error;
  });
}

interface RecordingPlayerProps {
  camera: string;
  timestamp?: number;
  selectionRange?: { start: number; end: number } | null;
  onDownloadRequest?: (start: number, end: number) => void;
  className?: string;
  playbackSpeed?: number;
  onPlaybackSpeedChange?: (speed: number) => void;
  showExportButton?: boolean;
  onExportClick?: () => void;
}

export default function RecordingPlayer({ 
  camera, 
  timestamp, 
  selectionRange,
  onDownloadRequest,
  className,
  playbackSpeed = 1,
  onPlaybackSpeedChange,
  showExportButton = false,
  onExportClick
}: RecordingPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentLoadRequestRef = useRef<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamType, setStreamType] = useState<'hls' | 'mp4' | null>(null);
  
  // Zoom and pan states
  const [zoomLevel, setZoomLevel] = useState(1); // 1x to 5x zoom
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Speed options with more granular control
  const speedOptions = [0.25, 0.5, 1, 1.5, 2, 4, 6, 8];

  // Apply playback speed when video loads or speed changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Generate recording URL based on timestamp
  const getRecordingUrl = (time: number) => {
    if (!camera || !time) return '';
    
    // For Frigate recordings, use the streaming API
    const date = new Date(time * 1000);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    return `/api/frigate/recordings/stream?camera=${encodeURIComponent(camera)}&date=${dateStr}&time=${time}`;
  };

  // Generate direct video URL for player
  const getVideoUrl = (startTime: number, endTime: number) => {
    if (!camera || !startTime || !endTime) return '';
    
    return `/api/frigate/recordings/video?camera=${encodeURIComponent(camera)}&start=${startTime}&end=${endTime}`;
  };

  // Generate HLS stream URL for modern video playback
  const getHLSUrl = (time: number) => {
    if (!camera || !time) return '';
    
    const duration = 300; // 5 minutes
    const start = time - 150; // 2.5 minutes before
    const end = time + 150;   // 2.5 minutes after
    
    return `/api/frigate/recordings/hls?camera=${encodeURIComponent(camera)}&start=${start}&end=${end}`;
  };

  // Try to get direct video stream from recording info
  const getDirectVideoUrl = (recordingInfo: any) => {
    if (!recordingInfo || !recordingInfo.recording) return '';
    
    const { start_time, end_time } = recordingInfo.recording;
    return getVideoUrl(start_time, end_time);
  };

  const loadRecording = async (time: number) => {
    if (!videoRef.current || !time) return;
    
    // Generate unique request ID to prevent race conditions
    const requestId = ++currentLoadRequestRef.current;
    
    console.log('🎬 RecordingPlayer: loadRecording called with:', {
      time,
      requestId,
      date: new Date(time * 1000).toISOString(),
      timeFormatted: format(new Date(time * 1000), 'HH:mm:ss'),
      camera
    });
    
    // Cancel any pending load request
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    
    // Debounce rapid requests
    loadingTimeoutRef.current = setTimeout(async () => {
      // Check if this is still the latest request
      if (requestId !== currentLoadRequestRef.current) {
        console.log('🚫 RecordingPlayer: Request cancelled, newer request exists:', requestId);
        return;
      }
      
      setIsLoading(true);
      setError(null);
      
      // Comprehensive cleanup before loading new stream
      const video = videoRef.current;
      if (!video) return;
      
      // Pause and reset video first
      video.pause();
      video.currentTime = 0;
      
      // Cleanup previous HLS instance thoroughly
      if (hlsRef.current) {
        try {
          console.log('RecordingPlayer: Destroying previous HLS instance');
          hlsRef.current.destroy();
        } catch (e) {
          console.warn('RecordingPlayer: Error destroying HLS instance (continuing):', e);
        } finally {
          hlsRef.current = null;
        }
      }
      
      // Clear any existing video source
      if (video.src && video.src.startsWith('blob:')) {
        URL.revokeObjectURL(video.src);
      }
      video.removeAttribute('src');
      video.load(); // Reset video element state
      
      // Wait a bit for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check again if this is still the latest request
      if (requestId !== currentLoadRequestRef.current) {
        console.log('🚫 RecordingPlayer: Request cancelled after cleanup:', requestId);
        setIsLoading(false);
        return;
      }

      try {
        // First try HLS streaming (preferred for Frigate 0.16+)
        const hlsUrl = getHLSUrl(time);
        console.log('RecordingPlayer: Trying HLS stream:', hlsUrl);
        
        const hlsResponse = await fetch(hlsUrl);
        
        if (hlsResponse.ok) {
          const hlsData = await hlsResponse.json();
          console.log('RecordingPlayer: HLS data:', hlsData);
          
          if (hlsData.success && hlsData.streamUrl) {
            console.log('RecordingPlayer: Loading HLS stream:', hlsData.streamUrl);
            
            // Final check before loading
            if (requestId !== currentLoadRequestRef.current) {
              console.log('🚫 RecordingPlayer: Request cancelled before HLS load:', requestId);
              setIsLoading(false);
              return;
            }
            
            // Use HLS.js to load the stream
            await loadHLSStream(hlsData.streamUrl);
            setStreamType('hls');
            setIsLoading(false);
            return;
          }
        }
        
        // Fallback to legacy MP4 streaming
        console.log('RecordingPlayer: HLS not available, trying legacy MP4');
        await loadRecordingLegacy(time);
        setStreamType('mp4');
        
      } catch (err) {
        console.error('RecordingPlayer: Load error:', err);
        setError('Failed to load recording');
      } finally {
        setIsLoading(false);
      }
    }, 150); // 150ms debounce
  };

  const loadHLSStream = async (streamUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (!videoRef.current) {
        reject(new Error('Video element not available'));
        return;
      }

      const video = videoRef.current;

      // Check if browser supports HLS natively (Safari)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        console.log('RecordingPlayer: Using native HLS support');
        
        // Clear any existing source before setting new one
        video.src = '';
        video.load();
        
        // Set new source
        video.src = streamUrl;
        
        video.onloadstart = () => {
          console.log('RecordingPlayer: Native HLS stream started loading');
        };
        
        video.onloadeddata = () => {
          console.log('RecordingPlayer: Native HLS stream data loaded');
          setError(null);
          // Restore playback speed after loading
          video.playbackRate = playbackSpeed;
          resolve();
        };
        
        video.onerror = (e) => {
          console.error('RecordingPlayer: Native HLS stream error:', e);
          reject(new Error('Failed to play native HLS stream'));
        };
        
      } else if (Hls && Hls.isSupported()) {
        console.log('RecordingPlayer: Using HLS.js for stream:', streamUrl);
        
        // Check if HLS failed to load
        if (hlsLoadError) {
          console.error('RecordingPlayer: HLS.js failed to load previously:', hlsLoadError);
          reject(new Error('HLS.js failed to load'));
          return;
        }
        
        try {
          const hls = new Hls({
            debug: false, // Disable debug to reduce console noise
            enableWorker: false,
            startLevel: -1, // Auto level selection
            maxBufferLength: 30, // Buffer 30 seconds
            maxMaxBufferLength: 60, // Max buffer 60 seconds
            // Add error recovery options
            maxLoadingDelay: 4,
            maxBufferHole: 0.5,
            lowLatencyMode: false,
            backBufferLength: 90
          });
          
          hlsRef.current = hls;
        
          // Important: Load source before attaching to media
          hls.loadSource(streamUrl);
          hls.attachMedia(video);
          
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('RecordingPlayer: HLS manifest parsed successfully');
            setError(null);
            // Restore playback speed after HLS loads
            if (videoRef.current) {
              videoRef.current.playbackRate = playbackSpeed;
            }
            resolve();
          });
        
        hls.on(Hls.Events.ERROR, (event: any, data: any) => {
          console.error('RecordingPlayer: HLS.js error:', {
            event,
            data,
            camera,
            timestamp,
            type: data.type,
            details: data.details,
            fatal: data.fatal,
            reason: data.reason
          });
          
          // Only handle fatal errors, ignore non-fatal ones
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('RecordingPlayer: Fatal network error, attempting recovery...');
                try {
                  hls.startLoad();
                } catch (e) {
                  console.error('RecordingPlayer: Failed to recover from network error:', e);
                  reject(new Error(`Network error: ${data.details || 'Unknown network error'}`));
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('RecordingPlayer: Fatal media error, attempting recovery...');
                try {
                  hls.recoverMediaError();
                } catch (e) {
                  console.error('RecordingPlayer: Failed to recover from media error:', e);
                  reject(new Error(`Media error: ${data.details || 'Unknown media error'}`));
                }
                break;
              default:
                console.log('RecordingPlayer: Fatal error, destroying HLS...', data);
                try {
                  hls.destroy();
                } catch (e) {
                  console.warn('Error destroying HLS after fatal error:', e);
                }
                hlsRef.current = null;
                reject(new Error(`HLS error: ${data.type} - ${data.details || 'Unknown error'}`));
                break;
            }
          } else {
            // Non-fatal error, just log it
            console.warn('RecordingPlayer: Non-fatal HLS error (ignoring):', data.type, data.details);
          }
        });
        
        // Handle HLS detach for clean stream switching
        hls.on(Hls.Events.MEDIA_DETACHING, () => {
          console.log('RecordingPlayer: HLS media detaching');
        });
        
        } catch (hlsError: any) {
          console.error('RecordingPlayer: Error creating HLS instance:', hlsError);
          reject(new Error(`Failed to create HLS player: ${hlsError.message}`));
        }
        
      } else {
        console.error('RecordingPlayer: HLS not supported in this browser');
        reject(new Error('HLS not supported in this browser'));
      }
    });
  };

  const loadRecordingLegacy = async (time: number) => {
    try {
      const url = getRecordingUrl(time);
      console.log('RecordingPlayer: Loading legacy recording from:', url);
      
      const response = await fetch(url);
      console.log('RecordingPlayer: Legacy response status:', response.status);
      
      if (!response.ok) {
        if (response.status === 404) {
          const errorData = await response.json().catch(() => ({}));
          console.log('RecordingPlayer: 404 details:', errorData);
          setError(`No recording found for this time. Available recordings: ${errorData.available_recordings || 0}`);
        } else if (response.status === 503) {
          const errorData = await response.json().catch(() => ({}));
          console.log('RecordingPlayer: 503 details:', errorData);
          setError(`Frigate server issue: ${errorData.details || 'Service unavailable'}`);
        } else {
          setError(`Recording not available (${response.status})`);
        }
        return;
      }
      
      const contentType = response.headers.get('content-type') || '';
      console.log('RecordingPlayer: Legacy content type:', contentType);
      
      if (contentType.includes('video/mp4')) {
        const videoBlob = await response.blob();
        const videoUrl = URL.createObjectURL(videoBlob);
        
        console.log('RecordingPlayer: Got legacy video blob, size:', videoBlob.size);
        
        if (videoRef.current) {
          // Clean up any existing blob URL first
          if (videoRef.current.src && videoRef.current.src.startsWith('blob:')) {
            URL.revokeObjectURL(videoRef.current.src);
          }
          
          videoRef.current.src = videoUrl;
          
          videoRef.current.onloadstart = () => {
            console.log('RecordingPlayer: Legacy video started loading');
          };
          
          videoRef.current.onloadeddata = () => {
            console.log('RecordingPlayer: Legacy video data loaded');
            setError(null);
            // Restore playback speed after legacy video loads
            if (videoRef.current) {
              videoRef.current.playbackRate = playbackSpeed;
            }
          };
          
          videoRef.current.onerror = (e) => {
            console.error('RecordingPlayer: Legacy video error:', e);
            setError('Failed to play video - format may not be supported');
            URL.revokeObjectURL(videoUrl);
          };
          
          // Auto-cleanup blob URL after video loads
          videoRef.current.onended = () => {
            URL.revokeObjectURL(videoUrl);
          };
        }
      } else if (contentType.includes('application/json')) {
        const data = await response.json();
        console.log('RecordingPlayer: Legacy recording data:', data);
        
        if (data.success && data.video_url) {
          const videoResponse = await fetch(data.video_url);
          
          if (videoResponse.ok && videoResponse.headers.get('content-type')?.includes('video/mp4')) {
            const videoBlob = await videoResponse.blob();
            const videoUrl = URL.createObjectURL(videoBlob);
            
            if (videoRef.current) {
              // Clean up any existing blob URL first
              if (videoRef.current.src && videoRef.current.src.startsWith('blob:')) {
                URL.revokeObjectURL(videoRef.current.src);
              }
              
              videoRef.current.src = videoUrl;
              setError(null);
              
              // Auto-cleanup blob URL
              videoRef.current.onended = () => {
                URL.revokeObjectURL(videoUrl);
              };
            }
          } else {
            const recording = data.recording;
            setError(`Recording found: ${recording.camera} from ${new Date(recording.start_time * 1000).toLocaleTimeString()} to ${new Date(recording.end_time * 1000).toLocaleTimeString()}. ${data.error || 'Video playback requires full Frigate integration.'}`);
          }
        } else {
          setError(data.message || data.error || 'Recording info available but video playback not implemented');
        }
      }
      
    } catch (err) {
      console.error('RecordingPlayer: Legacy load error:', err);
      setError('Failed to load legacy recording');
    }
  };

  useEffect(() => {
    console.log('🔄 RecordingPlayer: timestamp or camera changed:', {
      timestamp,
      camera,
      timestampDate: timestamp ? new Date(timestamp * 1000).toISOString() : 'undefined'
    });
    
    if (timestamp) {
      loadRecording(timestamp);
    }
  }, [timestamp, camera]);

  // Cleanup HLS when component unmounts
  useEffect(() => {
    return () => {
      // Cancel any pending load request
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      
      // Cleanup HLS instance
      if (hlsRef.current) {
        try {
          console.log('RecordingPlayer: Destroying HLS on unmount');
          hlsRef.current.destroy();
        } catch (e) {
          console.warn('RecordingPlayer: Error destroying HLS on unmount (ignoring):', e);
        } finally {
          hlsRef.current = null;
        }
      }
      
      // Cleanup blob URLs
      if (videoRef.current?.src && videoRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(videoRef.current.src);
      }
    };
  }, []);

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
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

  const handleDownload = () => {
    if (selectionRange && onDownloadRequest) {
      onDownloadRequest(selectionRange.start, selectionRange.end);
    } else if (timestamp) {
      // Download 30 seconds around current timestamp as fallback
      const start = timestamp - 15;
      const end = timestamp + 15;
      
      // Try direct download from video endpoint
      const downloadUrl = getVideoUrl(start, end);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `${camera}_${format(new Date(start * 1000), 'yyyy-MM-dd_HH-mm-ss')}_to_${format(new Date(end * 1000), 'HH-mm-ss')}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    
    if (videoRef.current.requestFullscreen) {
      videoRef.current.requestFullscreen();
    }
  };

  // Zoom and pan functions
  const handleZoomIn = () => {
    const newZoom = Math.min(5, zoomLevel + 0.5);
    setZoomLevel(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(1, zoomLevel - 0.5);
    setZoomLevel(newZoom);
    // Reset pan position when zooming out to 1x
    if (newZoom === 1) {
      setPanPosition({ x: 0, y: 0 });
    }
  };

  const handleZoomReset = () => {
    setZoomLevel(1);
    setPanPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - panPosition.x,
        y: e.clientY - panPosition.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setPanPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? -0.5 : 0.5;
    const newZoom = Math.max(1, Math.min(5, zoomLevel + zoomDelta));
    setZoomLevel(newZoom);
    
    // Reset pan position when zooming out to 1x
    if (newZoom === 1) {
      setPanPosition({ x: 0, y: 0 });
    }
  };

  return (
    <div className={`bg-black rounded-lg overflow-hidden w-full h-full flex flex-col ${className}`}>
      {/* Video Element - Área principal del video */}
      <div 
        className="relative flex-1 bg-black flex items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain bg-black transition-transform duration-200"
          style={{ 
            aspectRatio: '16/9',
            transform: `scale(${zoomLevel}) translate(${panPosition.x / zoomLevel}px, ${panPosition.y / zoomLevel}px)`
          }}
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
          onError={() => setError('Failed to play recording')}
        />
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white">Loading recording...</div>
          </div>
        )}
        
        {/* Indicador de tiempo sutil - esquina inferior derecha */}
        {timestamp && (
          <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm text-white px-3 py-2 rounded-lg border border-white/20">
            <div className="text-xs font-mono leading-none">
              <div className="text-gray-300 mb-1">
                {format(new Date((timestamp + currentTime) * 1000), 'EEE, MMM dd')}
              </div>
              <div className="text-sm font-semibold">
                {format(new Date((timestamp + currentTime) * 1000), 'HH:mm:ss')}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {format(new Date((timestamp + currentTime) * 1000), 'yyyy')}
              </div>
            </div>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black text-white text-center p-4">
            <div className="max-w-md">
              <div className="text-lg mb-2">
                {error.includes('Recording found') ? '🎬' : 
                 error.includes('No recording found') ? '❌' : 
                 error.includes('Frigate server') ? '🔧' : 
                 error.includes('Failed to play video') ? '⚠️' : '📹'}
              </div>
              <div className="text-sm leading-relaxed">{error}</div>
              <div className="text-xs text-gray-400 mt-3">
                {error.includes('Recording found') 
                  ? 'Video system is attempting to load recordings from Frigate server'
                  : error.includes('No recording found')
                  ? 'Try selecting a different time or check if recordings exist for this camera'
                  : error.includes('Failed to play video')
                  ? 'Video format may not be compatible or file may be corrupted'
                  : 'Check Frigate server connection and ensure recordings are enabled'
                }
              </div>
              {error.includes('Recording found') && (
                <div className="mt-4 p-2 bg-blue-900/50 rounded text-xs">
                  🎥 Video Player Active: The system is now configured to stream video directly from Frigate server.
                </div>
              )}
              {error.includes('Failed to play video') && (
                <div className="mt-4 p-2 bg-yellow-900/50 rounded text-xs">
                  💡 Try refreshing or selecting a different time segment. Video may still be processing.
                </div>
              )}
            </div>
          </div>
        )}
        
        {!timestamp && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black text-white text-center p-4">
            <div>
              <div className="text-2xl mb-4">📹</div>
              <div className="text-sm text-gray-400">
                Select a time on the timeline to view recording
              </div>
            </div>
          </div>
        )}
        
        {/* Central Play/Pause Control */}
        {(!isPlaying || isLoading) && timestamp && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              variant="ghost"
              size="lg"
              onClick={handlePlayPause}
              className="text-white hover:bg-white/20 h-20 w-20 rounded-full bg-black/60 backdrop-blur-sm border border-white/30 transition-all duration-300 hover:scale-105"
              disabled={isLoading}
              title={isLoading ? 'Cargando...' : (isPlaying ? 'Pausar' : 'Reproducir')}
            >
              {isLoading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              ) : isPlaying ? (
                <Pause className="h-8 w-8" />
              ) : (
                <Play className="h-8 w-8 ml-1" />
              )}
            </Button>
          </div>
        )}

        {/* Zoom Level Indicator */}
        {zoomLevel > 1 && (
          <div className="absolute top-4 left-4 bg-black/80 backdrop-blur-sm text-white px-3 py-2 rounded-lg border border-white/20">
            <div className="text-xs font-medium">
              🔍 Zoom: {zoomLevel}x
              {zoomLevel > 1 && <span className="text-gray-300 ml-2">Arrastra para mover</span>}
            </div>
          </div>
        )}
      </div>
      
      {/* Enhanced Controls */}
      <div className="bg-gray-900 border-t border-gray-700 px-4 py-3">
        {/* Progress Bar */}
        <div className="mb-3">
          <Slider
            value={[duration ? (currentTime / duration) * 100 : 0]}
            onValueChange={handleSeek}
            max={100}
            step={0.1}
            className="w-full h-1"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{format(new Date(currentTime * 1000), 'mm:ss')}</span>
            <span>{format(new Date(duration * 1000), 'mm:ss')}</span>
          </div>
        </div>
        
        {/* Main Control Layout */}
        <div className="flex items-center justify-between">
          {/* Left - Playback Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = Math.max(0, currentTime - 10);
                }
              }}
              className="text-white hover:bg-white/20 h-8 w-8 rounded-full"
            >
              <SkipBack className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePlayPause}
              className="text-white hover:bg-white/20 h-10 w-12 rounded-lg bg-white/10 border border-white/20"
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
              className="text-white hover:bg-white/20 h-8 w-8 rounded-full"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
            
            {/* Volume Controls */}
            <div className="flex items-center gap-2 ml-4">
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
          
          {/* Center - Camera & Time Info */}
          <div className="flex flex-col items-center text-white">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
              <span className="text-sm font-semibold">{camera}</span>
            </div>
            {timestamp && (
              <div className="text-xs text-gray-400">
                {format(new Date(timestamp * 1000), 'MMM dd, HH:mm:ss')}
              </div>
            )}
            {selectionRange && (
              <div className="text-xs text-blue-300">
                Selection: {Math.round((selectionRange.end - selectionRange.start) / 60)}m {((selectionRange.end - selectionRange.start) % 60)}s
              </div>
            )}
          </div>
          
          {/* Right - Speed, Quality, Actions */}
          <div className="flex items-center gap-3">
            {/* Zoom Controls */}
            <div className="flex items-center gap-1 px-2 py-1 bg-black/50 rounded-lg border border-white/20">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 1}
                className="text-white hover:bg-white/20 h-7 w-7 p-0"
                title="Reducir zoom (o usar rueda del mouse)"
              >
                <IconZoomOut className="h-3.5 w-3.5" />
              </Button>
              
              <span className="text-xs text-gray-300 font-medium min-w-[28px] text-center">
                {zoomLevel}x
              </span>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 5}
                className="text-white hover:bg-white/20 h-7 w-7 p-0"
                title="Aumentar zoom (o usar rueda del mouse)"
              >
                <IconZoomIn className="h-3.5 w-3.5" />
              </Button>
              
              {zoomLevel > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomReset}
                  className="text-white hover:bg-white/20 h-7 w-7 p-0 ml-1"
                  title="Resetear zoom"
                >
                  <IconZoomReset className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>

            {/* Speed Controls */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-medium">Velocidad:</span>
              <select
                value={playbackSpeed}
                onChange={(e) => onPlaybackSpeedChange?.(parseFloat(e.target.value))}
                className="bg-black/50 text-white text-xs rounded-lg px-2 py-1 border border-white/30 focus:border-white/50 outline-none min-w-[60px] font-medium"
              >
                {speedOptions.map(speed => (
                  <option key={speed} value={speed} className="bg-gray-800">
                    {speed === 1 ? '1x' : `${speed}x`}
                  </option>
                ))}
              </select>
            </div>

            {/* Stream Quality Indicator */}
            {streamType && (
              <div className="flex items-center gap-2 px-2 py-1 bg-black/50 rounded-lg border border-white/20">
                <div className={`w-1.5 h-1.5 rounded-full ${streamType === 'hls' ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
                <span className="text-xs text-gray-300 font-medium">
                  {streamType === 'hls' ? 'HLS' : 'MP4'}
                </span>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2">{showExportButton ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExportClick}
                  className="text-white border-white/30 hover:bg-white/20 h-8 px-3"
                  title="Abrir opciones de exportación"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  <span className="font-medium text-xs">Exportar</span>
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                  className="text-white border-white/30 hover:bg-white/20 h-8 px-3"
                  disabled={!selectionRange && !timestamp}
                  title={selectionRange ? 
                    `Download selected range` :
                    'Download 30s around current time'
                  }
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  <span className="font-medium text-xs">Download</span>
                </Button>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFullscreen}
                className="text-white hover:bg-white/20 h-8 w-8"
                title="Pantalla completa"
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>


    </div>
  );
}