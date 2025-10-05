'use client';

import React, { useRef, useEffect, useState } from 'react';
import Hls from 'hls.js';

interface HlsPlayerProps {
  camera: string;
  quality: 'hd' | 'sd';
  autoPlay?: boolean;
  muted?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: (error: Error) => void;
  onProgress?: () => void; // Added for state machine progress tracking
}

export default function HlsPlayer({
  camera,
  quality,
  autoPlay = true,
  muted = true,
  className = '',
  style,
  onLoad,
  onError,
  onProgress
}: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    const startHLS = () => {
      if (!videoRef.current) return;

      try {
        setIsLoading(true);
        setHasError(false);
        setErrorMessage('');

        console.log(`🎬 Starting HLS stream for ${camera} (${quality})`);

        // Cleanup previous HLS instance
        if (hlsRef.current) {
          hlsRef.current.destroy();
          hlsRef.current = null;
        }

        // Get HLS URL from Frigate API
        const stream = quality === 'hd' ? 'main' : 'sub';
        const hlsUrl = `http://10.1.1.252:5000/api/${camera}/hls/stream.m3u8?stream=${stream}`;

        console.log(`📺 HLS URL: ${hlsUrl}`);

        // Check if HLS is supported natively
        if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
          // Native HLS support (Safari)
          console.log('🍎 Using native HLS support');
          videoRef.current.src = hlsUrl;
          videoRef.current.addEventListener('loadeddata', () => {
            if (mounted) {
              setIsLoading(false);
              onLoad?.();
            }
          });
          videoRef.current.addEventListener('error', (e) => {
            if (mounted) {
              setIsLoading(false);
              setHasError(true);
              setErrorMessage('Native HLS playback failed');
              onError?.(new Error('Native HLS playback failed'));
            }
          });
        } else if (Hls.isSupported()) {
          // Use hls.js for other browsers
          console.log('📺 Using hls.js for HLS playback');

          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90, // Keep 90 seconds of buffer
            maxBufferLength: 30, // Max 30 seconds buffer
            maxMaxBufferLength: 600, // Allow up to 10 minutes for recordings
            levelLoadingMaxRetry: 4,
            levelLoadingMaxRetryTimeout: 4000,
            fragLoadingMaxRetry: 6,
            fragLoadingMaxRetryTimeout: 4000,
            startLevel: -1, // Auto quality
            autoStartLoad: true,
            debug: false
          });

          hlsRef.current = hls;

          hls.loadSource(hlsUrl);
          hls.attachMedia(videoRef.current);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (mounted) {
              console.log(`✅ HLS manifest parsed for ${camera}`);
              setIsLoading(false);
              onLoad?.();
            }
          });

          hls.on(Hls.Events.ERROR, (event, data) => {
            if (!mounted) return;

            console.error(`❌ HLS error for ${camera}:`, data);

            if (data.fatal) {
              setIsLoading(false);
              setHasError(true);

              let errorMsg = 'HLS stream error';
              switch (data.type) {
                case Hls.ErrorTypes.NETWORK_ERROR:
                  errorMsg = 'Network error - check connection';
                  break;
                case Hls.ErrorTypes.MEDIA_ERROR:
                  errorMsg = 'Media error - codec issue';
                  break;
                case Hls.ErrorTypes.MUX_ERROR:
                  errorMsg = 'Mux error - stream format issue';
                  break;
                default:
                  errorMsg = `HLS error: ${data.details || 'Unknown'}`;
              }

              setErrorMessage(errorMsg);
              onError?.(new Error(errorMsg));
            }
          });

          hls.on(Hls.Events.FRAG_LOADED, () => {
            // Fragment loaded successfully
            if (mounted && hasError) {
              setHasError(false);
              setErrorMessage('');
            }
            // Mark progress on fragment load
            onProgress?.();
          });

        } else {
          throw new Error('HLS is not supported in this browser');
        }

      } catch (error) {
        if (mounted) {
          console.error(`❌ HLS setup error for ${camera}:`, error);
          setIsLoading(false);
          setHasError(true);
          setErrorMessage(error instanceof Error ? error.message : 'Unknown HLS error');
          onError?.(error instanceof Error ? error : new Error('Unknown HLS error'));
        }
      }
    };

    startHLS();

    return () => {
      mounted = false;

      // Cleanup HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Cleanup video
      if (videoRef.current) {
        videoRef.current.src = '';
        videoRef.current.load();
      }
    };
  }, [camera, quality, onLoad, onError]);

  // Video event monitoring for state machine
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !onProgress) return;

    const handleVideoEvent = () => {
      onProgress();
    };

    // HTML5 video events that indicate activity/progress
    video.addEventListener('progress', handleVideoEvent);
    video.addEventListener('timeupdate', handleVideoEvent);
    video.addEventListener('canplay', handleVideoEvent);
    video.addEventListener('canplaythrough', handleVideoEvent);
    video.addEventListener('playing', handleVideoEvent);

    // Events that might indicate issues (but still count as activity)
    video.addEventListener('waiting', handleVideoEvent);
    video.addEventListener('stalled', handleVideoEvent);

    return () => {
      video.removeEventListener('progress', handleVideoEvent);
      video.removeEventListener('timeupdate', handleVideoEvent);
      video.removeEventListener('canplay', handleVideoEvent);
      video.removeEventListener('canplaythrough', handleVideoEvent);
      video.removeEventListener('playing', handleVideoEvent);
      video.removeEventListener('waiting', handleVideoEvent);
      video.removeEventListener('stalled', handleVideoEvent);
    };
  }, [onProgress]);

  return (
    <div
      className={`relative w-full h-full ${className}`}
      style={style}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="text-white text-sm text-center">
            📺 Conectando HLS<br />
            <span className="text-xs opacity-75">{camera} ({quality})</span>
          </div>
        </div>
      )}

      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 z-10">
          <div className="text-red-400 text-sm text-center">
            ❌ Error HLS<br />
            <span className="text-xs opacity-75">{errorMessage}</span>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        autoPlay={autoPlay}
        playsInline
        muted={muted}
        className="w-full h-full object-cover"
        style={{
          display: hasError ? 'none' : 'block'
        }}
      />
    </div>
  );
}