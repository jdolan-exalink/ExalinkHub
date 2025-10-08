"use client";

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { startOfDay, endOfDay } from 'date-fns';
import type { FrigateEvent } from '@/lib/frigate-api';
import EventSidebar from '@/components/ui/event-sidebar';
import EventPlayer from '@/components/ui/event-player';
import EventControls, { type TimeRange, type EventFilters } from '@/components/ui/event-controls';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import RecordingPlayer from '@/components/ui/recording-player';
import FrigateTimeline from '@/components/ui/frigate-timeline';

/**
 * Página de eventos con reproductor unificado
 *
 * Esta página muestra los eventos de Frigate con un reproductor avanzado
 * que comparte la misma implementación que las grabaciones.
 *
 * @description Utiliza RecordingPlayer para reproducción de video con HLS,
 * zoom, pan y controles avanzados. El timeline muestra eventos marcados
 * con íconos por tipo de objeto detectado.
 *
 * @since 2025-01-05
 * @author GitHub Copilot / Juan
 */
export default function EventsPage() {

  const translate_events_page = useTranslations('events.page');
  const [events, setEvents] = useState<FrigateEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<FrigateEvent | null>(null);
  const [selectedTime, setSelectedTime] = useState<number>(Math.floor(Date.now() / 1000));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Time and filter controls
  const [selectedDate, setSelectedDate] = useState(new Date());
  const default_time_range: TimeRange = { translation_key: 'last_hour', hours: 1, value: '1h' };
  const [timeRange, setTimeRange] = useState<TimeRange>(default_time_range);
  const [filters, setFilters] = useState<EventFilters>({
    cameras: [],
    labels: [],
    zones: [],
  });

  // Calculate time bounds
  const centerTime = useMemo(() => {
    if (timeRange.value === 'today') {
      return Math.floor(Date.now() / 1000);
    }
    return Math.floor(Date.now() / 1000);
  }, [timeRange, selectedDate]);

  const { startTime, endTime } = useMemo(() => {
    if (timeRange.value === 'today') {
      const start = startOfDay(selectedDate);
      const end = endOfDay(selectedDate);
      return {
        startTime: Math.floor(start.getTime() / 1000),
        endTime: Math.floor(end.getTime() / 1000)
      };
    } else {
      const now = Math.floor(Date.now() / 1000);
      return {
        startTime: now - (timeRange.hours * 3600),
        endTime: now
      };
    }
  }, [timeRange, selectedDate]);

  // Filter events based on current filters
  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      // Time filter
      if (event.start_time < startTime || event.start_time > endTime) {
        return false;
      }
      
      // Camera filter
      if (filters.cameras.length > 0 && !filters.cameras.includes(event.camera)) {
        return false;
      }
      
      // Label filter
      if (filters.labels.length > 0 && !filters.labels.includes(event.label)) {
        return false;
      }
      
      // Content filters
      if (filters.hasClip && !event.has_clip) {
        return false;
      }
      if (filters.hasSnapshot && !event.has_snapshot) {
        return false;
      }
      
      return true;
    });
  }, [events, filters, startTime, endTime]);

  // Get unique values for filter options
  const availableCameras = useMemo(() => 
    [...new Set(events.map(e => e.camera))].sort(), 
    [events]
  );
  
  const availableLabels = useMemo(() => 
    [...new Set(events.map(e => e.label))].sort(), 
    [events]
  );
  
  const availableZones = useMemo(() => 
    [], // Zones not available in current FrigateEvent interface
    [events]
  );

  const label_counts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredEvents.forEach((e) => {
      counts[e.label] = (counts[e.label] || 0) + 1;
    });
    return counts;
  }, [filteredEvents]);

  // Fetch events
  const fetchEvents = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/frigate/events?after=${startTime}&before=${endTime}&limit=1000`
      );
      
      if (response.ok) {
        const data = await response.json();
        setEvents(data || []);
        
        // Auto-select most recent event if none selected
        if (!selectedEvent && data && data.length > 0) {
          const mostRecent = data.reduce((latest: FrigateEvent, current: FrigateEvent) => 
            current.start_time > latest.start_time ? current : latest
          );
          setSelectedEvent(mostRecent);
          setSelectedTime(mostRecent.start_time);
        }

        // Auto-select first camera if no camera is selected in filters
        if (data && data.length > 0 && filters.cameras.length === 0) {
          const eventsData = data as FrigateEvent[];
          const cameras = [...new Set(eventsData.map(e => e.camera))].sort();
          const firstCamera = cameras[0];
          if (firstCamera) {
            setFilters(prev => ({ ...prev, cameras: [firstCamera] }));
          }
        }
      } else {
        throw new Error('events_fetch_failed');
      }
    } catch (error) {
      console.error('Error fetching events:', error);
      setError(translate_events_page('error_generic'));
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [startTime, endTime]);

  // Event navigation
  const navigateToEvent = (direction: 'previous' | 'next') => {
    if (!selectedEvent || filteredEvents.length === 0) return;
    
    const currentIndex = filteredEvents.findIndex(e => e.id === selectedEvent.id);
    if (currentIndex === -1) return;
    
    let newIndex;
    if (direction === 'previous') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : filteredEvents.length - 1;
    } else {
      newIndex = currentIndex < filteredEvents.length - 1 ? currentIndex + 1 : 0;
    }
    
    const newEvent = filteredEvents[newIndex];
    setSelectedEvent(newEvent);
    setSelectedTime(newEvent.start_time);
  };

  const handleEventSelect = (event: FrigateEvent) => {
    setSelectedEvent(event);
    setSelectedTime(event.start_time);
  };

  const handleTimeSelect = (timestamp: number) => {
    setSelectedTime(timestamp);
    
    // Find closest event to selected time
    const closestEvent = filteredEvents.reduce((closest, event) => {
      const timeDiff = Math.abs(event.start_time - timestamp);
      const closestDiff = Math.abs(closest.start_time - timestamp);
      return timeDiff < closestDiff ? event : closest;
    }, filteredEvents[0]);
    
    if (closestEvent) {
      setSelectedEvent(closestEvent);
    }
  };

  const handleDownloadEvent = async (event: FrigateEvent) => {
    if (!event.has_clip) {
      alert('⚠️ No hay video disponible para descargar en este evento.');
      return;
    }
    
    try {
      // Show loading state (you could add a loading state to UI)
      const startTime = Date.now();
      
      const response = await fetch(`/api/frigate/events/${event.id}/clip.mp4`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const blob = await response.blob();
      
      // Check if blob is actually a video
      if (blob.size === 0) {
        throw new Error('El archivo de video está vacío');
      }
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Better filename with date formatting
      const date = new Date(event.start_time * 1000);
      const dateStr = date.toISOString().slice(0, 19).replace(/[:.]/g, '-');
      a.download = `${event.camera}_${event.label}_${dateStr}.mp4`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      // Show success feedback
      const downloadTime = Date.now() - startTime;
      console.log(`Video descargado exitosamente en ${downloadTime}ms`);
      
    } catch (error) {
      console.error('Error downloading event clip:', error);
      alert(`❌ Error al descargar el video: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b">
        {/* Controls */}
        <EventControls
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
          filters={filters}
          onFiltersChange={setFilters}
          availableCameras={availableCameras}
          availableLabels={availableLabels}
          label_counts={label_counts}
          availableZones={availableZones}
          totalEvents={filteredEvents.length}
        />
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex-shrink-0 p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side - Player above Timeline */}
        <div className="flex-1 flex flex-col p-6 pr-3">
          {/* Player - moved above timeline to prioritize viewing */}
          <div className="flex-1 mb-6 flex items-center justify-center">
            {/* Contenedor principal centrado como en grabaciones */}
            <div className="flex flex-col items-center justify-center gap-4 w-full max-w-[900px]">
              {/* Video container con aspecto 16:9 (responsive) */}
              <div
                className="relative w-full border-0"
                style={{
                  maxWidth: '900px',
                  aspectRatio: '16/9'
                }}
              >
                {/* Use EventPlayer for specific events with clips, RecordingPlayer for time navigation */}
                {selectedEvent && selectedEvent.has_clip ? (
                  <EventPlayer
                    event={selectedEvent}
                    onPreviousEvent={() => navigateToEvent('previous')}
                    onNextEvent={() => navigateToEvent('next')}
                    onDownload={handleDownloadEvent}
                    className="w-full h-full"
                  />
                ) : (
                  <RecordingPlayer
                    camera={selectedEvent?.camera || ''}
                    timestamp={selectedTime}
                    className="w-full h-full"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex-shrink-0 flex justify-center">
            <div className="bg-popover border border-border rounded-lg p-3 w-full" style={{ maxWidth: '900px' }}>
              {isLoading ? (
                <div className="h-32 bg-card rounded-lg border flex items-center justify-center">
                  <div className="text-muted-foreground">{translate_events_page('loading')}</div>
                </div>
              ) : (
                <FrigateTimeline
                  data={{
                    segments: [], // No tenemos segmentos en eventos
                    events: filteredEvents
                  }}
                  camera={selectedEvent?.camera || ''}
                  onTimeSelect={handleTimeSelect}
                  selectedTime={selectedTime}
                  className="h-32"
                />
              )}
            </div>
          </div>
        </div>

        {/* Right Side - Event List */}
        <div className="w-80 flex-shrink-0 p-6 pl-3">
          <EventSidebar
            events={filteredEvents}
            selectedEvent={selectedEvent}
            onEventSelect={handleEventSelect}
            onPlayEvent={handleEventSelect}
            onDownloadEvent={handleDownloadEvent}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}
