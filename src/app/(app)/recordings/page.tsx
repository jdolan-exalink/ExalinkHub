"use client";

import { useState, useEffect } from 'react';
import RecordingBrowser from './components/recording-browser';
import type { Camera } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export default function RecordingsPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCameras = async () => {
      try {
        const response = await fetch('/api/frigate/cameras');
        if (response.ok) {
          const data = await response.json();
          setCameras(data);
        } else {
          throw new Error('Failed to fetch cameras');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Error fetching cameras:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCameras();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="text-lg font-medium">Loading cameras...</div>
          <div className="text-sm text-muted-foreground mt-2">
            Connecting to Frigate servers
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to connect to Frigate servers: {error}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (cameras.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No cameras found. Please check your Frigate server configuration.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <RecordingBrowser cameras={cameras} />;
}
