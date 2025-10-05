"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import type { FrigateEvent, RecordingTimelineData } from '@/lib/frigate-api';

interface TimelineProps {
  data: RecordingTimelineData;
  date: Date;
  onTimeSelect?: (timestamp: number) => void;
  onRangeSelect?: (startTime: number, endTime: number) => void;
  selectedTime?: number;
  selectionRange?: { start: number; end: number } | null;
}

// Emoji mapping for object types
const OBJECT_EMOJIS: Record<string, string> = {
  person: '🚶',
  car: '🚗',
  truck: '🚚',
  bicycle: '🚲',
  motorcycle: '🏍️',
  bus: '🚌',
  cat: '🐱',
  dog: '🐕',
  bird: '🐦',
  package: '📦',
  license_plate: '🚙',
  lpr: '🚙',
  vehicle: '🚗',
  unknown: '👁️'
};

export default function RecordingTimeline({ 
  data, 
  date, 
  onTimeSelect, 
  onRangeSelect,
  selectedTime,
  selectionRange 
}: TimelineProps) {
  /**
   * Selecciona el primer evento por defecto al montar el componente.
   * @author GitHub Copilot
   */
  const [zoom_level, set_zoom_level] = useState(1); // 1 = full day, higher = more zoomed
  const [scroll_position, set_scroll_position] = useState(0);
  const [is_selecting, set_is_selecting] = useState(false);
  const [selection_start, set_selection_start] = useState<number | null>(null);
  const [selected_time, set_selected_time] = useState<number | undefined>(selectedTime);
  const timeline_ref = useRef<HTMLDivElement>(null);
  const container_ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected_time && data.events && data.events.length > 0) {
      set_selected_time(data.events[0].start_time);
      onTimeSelect?.(data.events[0].start_time);
    }
  }, [data.events, selected_time, onTimeSelect]);

  const day_start = new Date(date);
  day_start.setHours(0, 0, 0, 0);
  const day_end = new Date(date);
  day_end.setHours(23, 59, 59, 999);

  const day_start_timestamp = Math.floor(day_start.getTime() / 1000);
  const day_end_timestamp = Math.floor(day_end.getTime() / 1000);
  const total_seconds = day_end_timestamp - day_start_timestamp;

  // Calculate visible time range based on zoom and scroll
  const visible_seconds = total_seconds / zoom_level;
  const scroll_seconds = scroll_position * (total_seconds - visible_seconds);
  const visible_start = day_start_timestamp + scroll_seconds;
  const visible_end = visible_start + visible_seconds;

  const timeToPixel = (timestamp: number) => {
  if (!timeline_ref.current) return 0;
  const timeline_width = timeline_ref.current.offsetWidth;
  const relative_time = timestamp - visible_start;
  return (relative_time / visible_seconds) * timeline_width;
  };

  const pixelToTime = (pixel: number) => {
  if (!timeline_ref.current) return day_start_timestamp;
  const timeline_width = timeline_ref.current.offsetWidth;
  const relative_pixel = pixel / timeline_width;
  return visible_start + (relative_pixel * visible_seconds);
  };

  const handleTimelineClick = (event: React.MouseEvent) => {
    if (!timeline_ref.current) return;
    const rect = timeline_ref.current.getBoundingClientRect();
    const click_x = event.clientX - rect.left;
    const timestamp = Math.floor(pixelToTime(click_x));
    if (event.shiftKey && selection_start !== null) {
      // Complete range selection
      const start = Math.min(selection_start, timestamp);
      const end = Math.max(selection_start, timestamp);
      onRangeSelect?.(start, end);
      set_is_selecting(false);
      set_selection_start(null);
    } else if (event.shiftKey) {
      // Start range selection
      set_selection_start(timestamp);
      set_is_selecting(true);
    } else {
      // Single time selection
      set_selected_time(timestamp);
      onTimeSelect?.(timestamp);
      set_selection_start(null);
      set_is_selecting(false);
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
  if (!is_selecting || !timeline_ref.current || selection_start === null) return;
  const rect = timeline_ref.current.getBoundingClientRect();
  const mouse_x = event.clientX - rect.left;
  const current_time = Math.floor(pixelToTime(mouse_x));
  const start = Math.min(selection_start, current_time);
  const end = Math.max(selection_start, current_time);
  onRangeSelect?.(start, end);
  };

  const handleZoom = (delta: number) => {
  const new_zoom = Math.max(1, Math.min(24, zoom_level + delta));
  set_zoom_level(new_zoom);
  };

  const handleScroll = (delta: number) => {
  const max_scroll = 1 - (1 / zoom_level);
  const new_position = Math.max(0, Math.min(max_scroll, scroll_position + delta));
  set_scroll_position(new_position);
  };

  const getTimeLabels = () => {
    const labels = [];
    const interval = visible_seconds > 3600 ? 3600 : visible_seconds > 1800 ? 1800 : visible_seconds > 900 ? 900 : 300; // 1h, 30m, 15m, or 5m
    let current = Math.ceil(visible_start / interval) * interval;
    while (current <= visible_end) {
      labels.push(current);
      current += interval;
    }
    return labels;
  };

  return (
    <div className="space-y-2 lg:space-y-4">
      {/* Timeline Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between text-sm gap-2">
        <div className="flex items-center gap-2 lg:gap-4">
          <span className="text-muted-foreground text-xs lg:text-sm">
            {format(new Date(visible_start * 1000), 'HH:mm')} - {format(new Date(visible_end * 1000), 'HH:mm')}
          </span>
          <div className="flex items-center gap-1 lg:gap-2">
            <button
              onClick={() => handleZoom(1)}
              className="px-1 lg:px-2 py-1 bg-secondary rounded text-xs hover:bg-secondary/80"
              disabled={zoom_level >= 24}
            >
              🔍+
            </button>
            <span className="text-xs text-muted-foreground">{zoom_level}x</span>
            <button
              onClick={() => handleZoom(-1)}
              className="px-1 lg:px-2 py-1 bg-secondary rounded text-xs hover:bg-secondary/80"
              disabled={zoom_level <= 1}
            >
              🔍-
            </button>
          </div>
        </div>
        
        <div className="text-xs text-muted-foreground">
          {selectionRange ? 
            `Selected: ${format(new Date(selectionRange.start * 1000), 'HH:mm:ss')} - ${format(new Date(selectionRange.end * 1000), 'HH:mm:ss')}` :
            'Click for time, Shift+Click to select range'
          }
        </div>
      </div>

      {/* Timeline Container */}
      <div ref={container_ref} className="relative">
        {/* Time Labels */}
        <div className="relative h-4 lg:h-6 mb-2">
          {getTimeLabels().map(timestamp => (
            <div
              key={timestamp}
              className="absolute text-xs text-muted-foreground transform -translate-x-1/2"
              style={{ left: `${timeToPixel(timestamp)}px` }}
            >
              {format(new Date(timestamp * 1000), 'HH:mm')}
            </div>
          ))}
        </div>

        {/* Main Timeline */}
        <div 
          ref={timeline_ref}
          className="relative h-16 lg:h-20 bg-secondary rounded-lg cursor-crosshair select-none"
          onClick={handleTimelineClick}
          onMouseMove={handleMouseMove}
        >
          {/* Recording Segments */}
          {data.segments.map((segment, index) => {
            const start_pixel = timeToPixel(segment.start_time);
            const end_pixel = timeToPixel(segment.end_time);
            const width = Math.max(1, end_pixel - start_pixel);
            if (start_pixel >= 0 && start_pixel <= (timeline_ref.current?.offsetWidth || 0)) {
              return (
                <div
                  key={index}
                  className="absolute top-0 h-full bg-blue-500/60 hover:bg-blue-500/80"
                  style={{
                    left: `${start_pixel}px`,
                    width: `${width}px`,
                  }}
                  title={`Recording: ${format(new Date(segment.start_time * 1000), 'HH:mm:ss')} - ${format(new Date(segment.end_time * 1000), 'HH:mm:ss')}`}
                />
              );
            }
            return null;
          })}

          {/* Event Markers */}
          {data.events.map(event => {
            const event_pixel = timeToPixel(event.start_time);
            const emoji = OBJECT_EMOJIS[event.label] || OBJECT_EMOJIS.unknown;
            if (event_pixel >= 0 && event_pixel <= (timeline_ref.current?.offsetWidth || 0)) {
              return (
                <div
                  key={event.id}
                  className="absolute top-0 h-full flex items-center justify-center w-6 hover:scale-125 transition-transform cursor-pointer"
                  style={{ left: `${event_pixel - 12}px` }}
                  title={`${event.label} detected at ${format(new Date(event.start_time * 1000), 'HH:mm:ss')}`}
                >
                  <span className="text-lg drop-shadow-lg">{emoji}</span>
                </div>
              );
            }
            return null;
          })}

          {/* Current Time Indicator */}
          {selected_time && (
            <div
              className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
              style={{ left: `${timeToPixel(selected_time)}px` }}
            />
          )}

          {/* Selection Range */}
          {selectionRange && (
            <div
              className="absolute top-0 h-full bg-yellow-500/30 border-2 border-yellow-500 z-5"
              style={{
                left: `${timeToPixel(selectionRange.start)}px`,
                width: `${timeToPixel(selectionRange.end) - timeToPixel(selectionRange.start)}px`,
              }}
            />
          )}

          {/* Grid Lines */}
          {getTimeLabels().map(timestamp => (
            <div
              key={timestamp}
              className="absolute top-0 h-full w-px bg-border/50"
              style={{ left: `${timeToPixel(timestamp)}px` }}
            />
          ))}
        </div>

        {/* Scroll Bar */}
        {zoom_level > 1 && (
          <div className="mt-2 h-1 lg:h-2 bg-secondary rounded">
            <div
              className="h-full bg-primary rounded cursor-pointer"
              style={{
                width: `${100 / zoom_level}%`,
                marginLeft: `${scroll_position * (100 - 100 / zoom_level)}%`,
              }}
              onMouseDown={(e) => {
                const start_x = e.clientX;
                const start_position = scroll_position;
                const handleMouseMove = (e: MouseEvent) => {
                  const delta_x = e.clientX - start_x;
                  const container_width = container_ref.current?.offsetWidth || 1;
                  const delta = delta_x / container_width;
                  handleScroll(delta);
                };
                const handleMouseUp = () => {
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            />
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="flex flex-col lg:flex-row justify-between text-xs text-muted-foreground gap-1 lg:gap-0">
        <span>{data.segments.length} recording segments</span>
        <span>{data.events.length} events detected</span>
        <span className="hidden lg:inline">
          {Object.entries(
            data.events.reduce((acc, event) => {
              acc[event.label] = (acc[event.label] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          ).map(([label, count]) => `${OBJECT_EMOJIS[label] || OBJECT_EMOJIS.unknown} ${count}`).join(' ')}
        </span>
      </div>
    </div>
  );
}