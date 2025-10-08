'use client';

import React, { useEffect, useRef, useState } from 'react';

interface MSEPlayerProps {
  camera: string;
  quality: 'hd' | 'sd';
  autoPlay?: boolean;
  muted?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

const MSEPlayer: React.FC<MSEPlayerProps> = ({ 
  camera,
  quality,
  autoPlay = true, 
  muted = true, 
  className = '', 
  style,
  onLoad,
  onError 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaSourceRef = useRef<MediaSource | null>(null);
  const sourceBufferRef = useRef<SourceBuffer | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    const startMSEStream = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        setErrorMessage('');

        console.log(`🎬 Starting MSE stream for ${camera} (${quality})`);

        // Cleanup previous stream
        if (readerRef.current) {
          try {
            await readerRef.current.cancel();
          } catch (e) {
            console.warn('Error canceling previous reader:', e);
          }
          readerRef.current = null;
        }

        if (mediaSourceRef.current && mediaSourceRef.current.readyState === 'open') {
          mediaSourceRef.current.endOfStream();
        }

        if (!videoRef.current) return;

        // Check MSE support
        if (!('MediaSource' in window)) {
          throw new Error('MediaSource not supported in this browser');
        }

        // Create MediaSource
        const mediaSource = new MediaSource();
        mediaSourceRef.current = mediaSource;

        const objectURL = URL.createObjectURL(mediaSource);
        videoRef.current.src = objectURL;

        // Wait for MediaSource to open
        await new Promise<void>((resolve, reject) => {
          mediaSource.addEventListener('sourceopen', () => {
            if (!mounted) return;
            
            try {
              console.log(`📂 MediaSource opened for ${camera}`);
              
              // Add source buffer for MP4
              const sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E"');
              sourceBufferRef.current = sourceBuffer;
              
              sourceBuffer.addEventListener('updateend', () => {
                if (!mounted) return;
                console.log(`🔄 SourceBuffer updated for ${camera}`);
              });

              sourceBuffer.addEventListener('error', (e) => {
                if (!mounted) return;
                console.error(`❌ SourceBuffer error for ${camera}:`, e);
                reject(new Error('SourceBuffer error'));
              });

              resolve();
            } catch (error) {
              reject(error);
            }
          });

          mediaSource.addEventListener('sourceclose', () => {
            console.log(`📪 MediaSource closed for ${camera}`);
          });

          mediaSource.addEventListener('error', (e) => {
            console.error(`❌ MediaSource error for ${camera}:`, e);
            reject(new Error('MediaSource error'));
          });
        });

        if (!mounted) return;

        // Start streaming from MJPEG endpoint 
        const streamUrl = `/api/frigate/stream/${camera}?stream=${quality === 'hd' ? 'main' : 'sub'}&format=mp4`;
        
        console.log(`📡 Fetching MP4 stream: ${streamUrl}`);

        const response = await fetch(streamUrl);
        
        if (!response.ok) {
          throw new Error(`Stream fetch error: ${response.status} ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        const reader = response.body.getReader();
        readerRef.current = reader;

        console.log(`✅ MSE stream started for ${camera}`);
        setIsLoading(false);
        onLoad?.();

        // Process chunks
        const processChunks = async () => {
          try {
            while (mounted) {
              const { done, value } = await reader.read();
              
              if (done || !mounted) {
                console.log(`📚 Stream ended for ${camera}`);
                break;
              }

              if (sourceBufferRef.current && !sourceBufferRef.current.updating) {
                sourceBufferRef.current.appendBuffer(value);
              }
            }
          } catch (error) {
            if (!mounted) return;
            console.error(`❌ Stream processing error for ${camera}:`, error);
            throw error;
          }
        };

        await processChunks();

      } catch (error) {
        if (!mounted) return;
        
        console.error(`❌ MSE error for ${camera}:`, error);
        setIsLoading(false);
        setHasError(true);
        setErrorMessage(error instanceof Error ? error.message : 'Unknown MSE error');
        onError?.(error instanceof Error ? error : new Error('Unknown MSE error'));
      }
    };

    startMSEStream();

    return () => {
      mounted = false;
      
      // Cleanup reader
      if (readerRef.current) {
        readerRef.current.cancel().catch(console.warn);
        readerRef.current = null;
      }

      // Cleanup MediaSource
      if (mediaSourceRef.current && mediaSourceRef.current.readyState === 'open') {
        try {
          mediaSourceRef.current.endOfStream();
        } catch (e) {
          console.warn('Error ending MediaSource stream:', e);
        }
      }

      // Cleanup video
      if (videoRef.current) {
        videoRef.current.src = '';
        videoRef.current.load();
      }
    };
  }, [camera, quality, onLoad, onError]);

  return (
    <div className={`relative w-full h-full ${className}`} style={style}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="text-white text-sm text-center">
            🎬 Conectando MSE Stream<br />
            <span className="text-xs opacity-75">{camera} ({quality})</span>
          </div>
        </div>
      )}
      
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 z-10">
          <div className="text-red-400 text-sm text-center">
            ❌ Error MSE Stream<br />
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
};

export default MSEPlayer;