"use client";

import React, { useEffect, useState } from 'react';
import LiveView from './components/live-view';
import { fetchFrigateData } from '@/lib/frigate-data';
import { Camera } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { DragEndEvent } from '@dnd-kit/core';

interface LivePageProps {
  // No props needed anymore, using context
}

export default function LivePage({}: LivePageProps) {
  console.log('🟢 LIVE PAGE COMPONENT RENDERING');
  console.log('📦 Using context for props');
  
  // Test alert to verify page is loading
  useEffect(() => {
    console.log('Live page useEffect running');
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        console.log('Live page fully mounted');
      }, 1000);
    }
  }, []);
  
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        console.log('Loading Frigate data...'); // Debug log
        
        const data = await fetchFrigateData();
        console.log('Frigate data received:', data); // Debug log
        
        if (data.error) {
          console.error('Frigate error:', data.error); // Debug log
          setError(data.error);
        } else {
          console.log('Cameras loaded:', data.cameras.length); // Debug log
          setCameras(data.cameras);
          setError(null);
        }
      } catch (err) {
        console.error('Error loading data:', err); // Debug log
        setError(err instanceof Error ? err.message : 'Error desconocido');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Conectando con Exalink...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-2 w-full">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Error al conectar con Exalink: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <LiveView 
        cameras={cameras} 
      />
    </div>
  );
}
