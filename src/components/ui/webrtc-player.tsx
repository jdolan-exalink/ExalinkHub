'use client';

import React, { useEffect, useRef, useState } from 'react';

interface WebRTCPlayerProps {
  src: string; // ej: "Cochera:sub" o "Cochera:main"  
  autoPlay?: boolean;
  muted?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

const WebRTCPlayer: React.FC<WebRTCPlayerProps> = ({ 
  src, 
  autoPlay = true, 
  muted = true, 
  className = '', 
  style,
  onLoad,
  onError 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    let mounted = true;

    const startWebRTC = async () => {
      try {
        setIsLoading(true);
        setHasError(false);
        setErrorMessage('');

        console.log(`🚀 Starting WebRTC for ${src}`);

        // Cleanup previous connection
        if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
        }

        // Create new RTCPeerConnection
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' }
          ]
        });

        pcRef.current = pc;

        // Handle incoming video track
        pc.ontrack = (event) => {
          if (!mounted) return;
          
          console.log(`📺 WebRTC track received for ${src}`);
          
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            setIsLoading(false);
            onLoad?.();
          }
        };

        // Handle connection state changes
        pc.onconnectionstatechange = () => {
          if (!mounted) return;
          
          console.log(`🔗 WebRTC connection state for ${src}: ${pc.connectionState}`);
          
          if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
            const error = new Error(`WebRTC connection ${pc.connectionState}`);
            setHasError(true);
            setErrorMessage(error.message);
            onError?.(error);
          }
        };

        // Handle ICE connection state
        pc.oniceconnectionstatechange = () => {
          if (!mounted) return;
          console.log(`🧊 ICE connection state for ${src}: ${pc.iceConnectionState}`);
        };

        // Add video transceiver (receive only)
        pc.addTransceiver('video', { direction: 'recvonly' });

        // Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        if (!mounted) return;

        console.log(`📤 Sending SDP offer to go2rtc for ${src}`);

        // Send SDP offer to go2rtc
        const response = await fetch(`/api/go2rtc/stream.webrtc?src=${encodeURIComponent(src)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        });

        if (!response.ok) {
          throw new Error(`go2rtc WebRTC endpoint error: ${response.status} ${response.statusText}`);
        }

        const answerSDP = await response.text();
        console.log(`📥 Received SDP answer from go2rtc for ${src}`);

        if (!mounted) return;

        // Set remote description
        await pc.setRemoteDescription({ 
          type: 'answer', 
          sdp: answerSDP 
        });

        console.log(`✅ WebRTC connection established for ${src}`);

      } catch (error) {
        if (!mounted) return;
        
        console.error(`❌ WebRTC error for ${src}:`, error);
        setIsLoading(false);
        setHasError(true);
        setErrorMessage(error instanceof Error ? error.message : 'Unknown WebRTC error');
        onError?.(error instanceof Error ? error : new Error('Unknown WebRTC error'));
      }
    };

    startWebRTC();

    return () => {
      mounted = false;
      
      // Cleanup video
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }

      // Cleanup peer connection
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [src, onLoad, onError]);

  return (
    <div className={`relative w-full h-full ${className}`} style={style}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
          <div className="text-white text-sm text-center">
            🚀 Conectando WebRTC<br />
            <span className="text-xs opacity-75">{src}</span>
          </div>
        </div>
      )}
      
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 z-10">
          <div className="text-red-400 text-sm text-center">
            ❌ Error WebRTC<br />
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

export default WebRTCPlayer;