"use client";

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import RecordingBrowser from './components/recording-browser';
import type { Camera } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export default function RecordingsPage() {
  const translate_recordings_page = useTranslations('recordings.page');
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
          throw new Error('recordings_fetch_failed');
        }
      } catch (err) {
        const error_message = err instanceof Error ? err.message : translate_recordings_page('unknown_error');
        console.error('Error fetching cameras:', err);
        setError(translate_recordings_page('error_message', { details: error_message }));
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
          <div className="text-lg font-medium">{translate_recordings_page('loading_title')}</div>
          <div className="text-sm text-muted-foreground mt-2">
            {translate_recordings_page('loading_description')}
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
            {error}
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
            {translate_recordings_page('empty_description')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return <RecordingBrowser cameras={cameras} />;
}


