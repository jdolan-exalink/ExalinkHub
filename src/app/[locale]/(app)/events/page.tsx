"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { startOfDay, endOfDay } from 'date-fns';
import type { FrigateEvent, RecordingTimelineData } from '@/lib/frigate-api';
import EventTimeline from '@/components/ui/event-timeline';
import RecordingTimeline from '@/components/ui/recording-timeline';
import EventSidebar from '@/components/ui/event-sidebar';
import EventPlayer from '@/components/ui/event-player';
import EventControls, { type TimeRange, type EventFilters } from '@/components/ui/event-controls';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function EventsPage() {

  const translate_events_page = useTranslations('events.page');
  const [events, setEvents] = useState<FrigateEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<FrigateEvent | null>(null);
  const [selectedTime, setSelectedTime] = useState<number>(Math.floor(Date.now() / 1000));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Recording timeline data
  const [recordingData, setRecordingData] = useState<RecordingTimelineData>({
    segments: [],
    events: []
  });
  const [timelineRangeSelection, setTimelineRangeSelection] = useState<{ start: number; end: number } | null>(null);

  // Time and filter controls
  const [selectedDate, setSelectedDate] = useState(new Date());
  const default_time_range: TimeRange = { 
    translation_key: 'todo_el_dia', 
    value: 'full_day', 
    type: 'preset',
    startTime: '00:00',
    endTime: '23:59'
  };
  const [timeRange, setTimeRange] = useState<TimeRange>(default_time_range);
  const [filters, setFilters] = useState<EventFilters>({
    cameras: [],
    labels: [],
    zones: [],
  });

  // Fixed timestamp for relative time ranges to avoid constant recalculation
  const [baseTimestamp, setBaseTimestamp] = useState(() => Math.floor(Date.now() / 1000));

  // Function to refresh with current timestamp
  const refreshEvents = useCallback(() => {
    setBaseTimestamp(Math.floor(Date.now() / 1000));
  }, []);

  // Calculate time bounds
  const { startTime, endTime } = useMemo(() => {
    // Get the base date (selected date)
    const baseDate = new Date(selectedDate);
    
    // Parse start and end times
    const startTimeStr = timeRange.startTime || '00:00';
    const endTimeStr = timeRange.endTime || '23:59';
    
    const [startHour, startMinute] = startTimeStr.split(':').map(Number);
    const [endHour, endMinute] = endTimeStr.split(':').map(Number);
    
    // Create start datetime
    const startDateTime = new Date(baseDate);
    startDateTime.setHours(startHour, startMinute, 0, 0);
    
    // Create end datetime
    const endDateTime = new Date(baseDate);
    endDateTime.setHours(endHour, endMinute, 59, 999);
    
    // If end time is earlier than start time, assume next day
    if (endDateTime <= startDateTime) {
      endDateTime.setDate(endDateTime.getDate() + 1);
    }
    
    return {
      startTime: Math.floor(startDateTime.getTime() / 1000),
      endTime: Math.floor(endDateTime.getTime() / 1000)
    };
  }, [timeRange.startTime, timeRange.endTime, selectedDate]);

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

  // Track last fetch to avoid duplicates
  const lastFetchRef = useRef<{ startTime: number; endTime: number; timestamp: number } | null>(null);

  // Fetch events
  const fetchEvents = useCallback(async () => {
    const fetchId = Math.random().toString(36).substr(2, 9);
    console.log(`[${fetchId}] fetchEvents called with:`, { startTime, endTime });
    
    // Check if we recently fetched with the same parameters (within 1 second)
    const now = Date.now();
    if (lastFetchRef.current && 
        lastFetchRef.current.startTime === startTime && 
        lastFetchRef.current.endTime === endTime &&
        (now - lastFetchRef.current.timestamp) < 1000) {
      console.log(`[${fetchId}] Skipping duplicate fetch within 1s`);
      return;
    }
    
    lastFetchRef.current = { startTime, endTime, timestamp: now };
    
    setIsLoading(true);
    setError(null);
    
    try {
      const url = `/api/frigate/events?after=${startTime}&before=${endTime}&limit=1000`;
      console.log(`[${fetchId}] Fetching events from:`, url);
      
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        console.log(`[${fetchId}] Events fetched successfully:`, data?.length || 0, 'events');
        setEvents(data || []);
        
        // Auto-select most recent event if none selected
        if (!selectedEvent && data && data.length > 0) {
          const mostRecent = data.reduce((latest: FrigateEvent, current: FrigateEvent) => 
            current.start_time > latest.start_time ? current : latest
          );
          setSelectedEvent(mostRecent);
          setSelectedTime(mostRecent.start_time);
        }
        
        // Update recording timeline data
        setRecordingData({
          segments: [], // Por ahora vacío, se puede implementar posteriormente
          events: data || []
        });
      } else {
        const errorData = await response.text();
        console.error(`[${fetchId}] API response not ok:`, response.status, response.statusText, errorData);
        throw new Error(`events_fetch_failed: ${response.status} ${response.statusText} - ${errorData}`);
      }
    } catch (error) {
      console.error(`[${fetchId}] Error fetching events:`, error);
      setError(error instanceof Error ? error.message : translate_events_page('error_generic'));
      setEvents([]);
      setRecordingData({ segments: [], events: [] });
    } finally {
      setIsLoading(false);
    }
  }, [startTime, endTime, selectedEvent, translate_events_page]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

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

  /**
   * Maneja la selección de rango de tiempo desde el timeline de grabación.
   * @param start_time - Timestamp de inicio del rango seleccionado
   * @param end_time - Timestamp de fin del rango seleccionado
   * @author GitHub Copilot
   */
  const handle_timeline_range_select = (start_time: number, end_time: number) => {
    setTimelineRangeSelection({ start: start_time, end: end_time });
    console.log('Selected time range:', { start: start_time, end: end_time });
  };

  /**
   * Maneja la selección de tiempo específico desde el timeline de grabación.
   * @param timestamp - Timestamp seleccionado
   * @author GitHub Copilot
   */
  const handle_timeline_time_select = (timestamp: number) => {
    setSelectedTime(timestamp);
    
    // Find closest event to selected time
    const closestEvent = filteredEvents.reduce((closest, event) => {
      const timeDiff = Math.abs(event.start_time - timestamp);
      const closestDiff = closest ? Math.abs(closest.start_time - timestamp) : Infinity;
      return timeDiff < closestDiff ? event : closest;
    }, filteredEvents[0]);
    
    if (closestEvent) {
      setSelectedEvent(closestEvent);
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col">
      {/* Barra de Controles Superiores */}
      <div className="bg-card border-b border-border flex-shrink-0">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Controles Izquierda */}
            <div className="flex items-center gap-6">
              <h1 className="text-foreground font-semibold text-lg mr-4">Events</h1>
              
              {/* Controls compactos */}
              <div className="flex items-center gap-4">
                <EventControls
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  timeRange={timeRange}
                  onTimeRangeChange={setTimeRange}
                  filters={filters}
                  onFiltersChange={setFilters}
                  availableCameras={availableCameras}
                  availableLabels={availableLabels}
                  availableZones={availableZones}
                  totalEvents={filteredEvents.length}
                  className="bg-transparent border-0 p-0"
                />
              </div>
            </div>

            {/* Controles Derecha: Estado y Refresh */}
            <div className="flex items-center gap-4">
              <Button
                onClick={refreshEvents}
                variant="outline"
                size="sm"
                disabled={isLoading}
                className="bg-primary border-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                🔄 Actualizar
              </Button>
              
              {isLoading && (
                <div className="text-yellow-400 text-sm font-medium">⏳ Cargando eventos...</div>
              )}
              {error && (
                <div className="text-destructive text-sm font-medium">❌ Error: {error}</div>
              )}
              {filteredEvents.length > 0 && (
                <div className="text-green-400 text-sm font-medium">
                  🎯 {filteredEvents.length} eventos encontrados
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-destructive/20 border-b border-destructive/50 px-4 py-2 flex-shrink-0">
          <Alert variant="destructive" className="bg-transparent border-0">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-destructive">{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* Main Content Area - Video Player y Timeline centrados */}
      <div className="flex-1 flex bg-background overflow-hidden">
        {/* Sidebar de eventos - Panel lateral fijo */}
        <div className="w-80 bg-card border-r border-border flex-shrink-0">
          <EventSidebar
            events={filteredEvents}
            selectedEvent={selectedEvent}
            onEventSelect={handleEventSelect}
            onPlayEvent={handleEventSelect}
            onDownloadEvent={handleDownloadEvent}
            className="h-full bg-transparent border-0"
          />
        </div>

        {/* Video y Timeline Area - Centrado */}
        <div className="flex-1 flex items-center justify-center bg-background px-4 py-2 min-h-0 overflow-hidden">
          <div className="flex flex-col items-center justify-center gap-2">
            {/* Video container con aspecto 16:9 */}
            <div 
              className="bg-background relative"
              style={{
                width: 'calc((100vh - 200px) * 16 / 9)', // Calculamos ancho basado en altura disponible
                height: 'calc(100vh - 200px)', // Altura disponible para video
                maxWidth: 'calc(100vw - 320px - 32px)', // Máximo ancho (descontando sidebar + padding)
                aspectRatio: '16/9'
              }}
            >
              <EventPlayer
                event={selectedEvent}
                onPreviousEvent={() => navigateToEvent('previous')}
                onNextEvent={() => navigateToEvent('next')}
                onDownload={handleDownloadEvent}
                className="w-full h-full bg-transparent border-0"
              />
            </div>

            {/* Timeline Section - Mismo ancho que el video */}
            <div 
              className="bg-card border border-border rounded-lg p-3"
              style={{
                width: 'calc((100vh - 200px) * 16 / 9)', // Mismo ancho que el video
                maxWidth: 'calc(100vw - 320px - 32px)' // Mismo límite que el video
              }}
            >
              <div className="h-16">
                <RecordingTimeline
                  data={recordingData}
                  date={selectedDate}
                  onTimeSelect={handle_timeline_time_select}
                  onRangeSelect={handle_timeline_range_select}
                  selectedTime={selectedTime}
                  selectionRange={timelineRangeSelection}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
