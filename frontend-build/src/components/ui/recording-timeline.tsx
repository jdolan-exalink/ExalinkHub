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
  const [zoomLevel, setZoomLevel] = useState(1); // 1 = full day, higher = more zoomed
  const [scrollPosition, setScrollPosition] = useState(0);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const dayStartTimestamp = Math.floor(dayStart.getTime() / 1000);
  const dayEndTimestamp = Math.floor(dayEnd.getTime() / 1000);
  const totalSeconds = dayEndTimestamp - dayStartTimestamp;

  // Calculate visible time range based on zoom and scroll
  const visibleSeconds = totalSeconds / zoomLevel;
  const scrollSeconds = scrollPosition * (totalSeconds - visibleSeconds);
  const visibleStart = dayStartTimestamp + scrollSeconds;
  const visibleEnd = visibleStart + visibleSeconds;

  const timeToPixel = (timestamp: number) => {
    if (!timelineRef.current) return 0;
    const timelineWidth = timelineRef.current.offsetWidth;
    const relativeTime = timestamp - visibleStart;
    return (relativeTime / visibleSeconds) * timelineWidth;
  };

  const pixelToTime = (pixel: number) => {
    if (!timelineRef.current) return dayStartTimestamp;
    const timelineWidth = timelineRef.current.offsetWidth;
    const relativePixel = pixel / timelineWidth;
    return visibleStart + (relativePixel * visibleSeconds);
  };

  const handleTimelineClick = (event: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const timestamp = Math.floor(pixelToTime(clickX));
    
    if (event.shiftKey && selectionStart !== null) {
      // Complete range selection
      const start = Math.min(selectionStart, timestamp);
      const end = Math.max(selectionStart, timestamp);
      onRangeSelect?.(start, end);
      setIsSelecting(false);
      setSelectionStart(null);
    } else if (event.shiftKey) {
      // Start range selection
      setSelectionStart(timestamp);
      setIsSelecting(true);
    } else {
      // Single time selection
      onTimeSelect?.(timestamp);
      setSelectionStart(null);
      setIsSelecting(false);
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isSelecting || !timelineRef.current || selectionStart === null) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const currentTime = Math.floor(pixelToTime(mouseX));
    
    const start = Math.min(selectionStart, currentTime);
    const end = Math.max(selectionStart, currentTime);
    onRangeSelect?.(start, end);
  };

  const handleZoom = (delta: number) => {
    const newZoom = Math.max(1, Math.min(24, zoomLevel + delta));
    setZoomLevel(newZoom);
  };

  const handleScroll = (delta: number) => {
    const maxScroll = 1 - (1 / zoomLevel);
    const newPosition = Math.max(0, Math.min(maxScroll, scrollPosition + delta));
    setScrollPosition(newPosition);
  };

  const getTimeLabels = () => {
    const labels = [];
    const interval = visibleSeconds > 3600 ? 3600 : visibleSeconds > 1800 ? 1800 : visibleSeconds > 900 ? 900 : 300; // 1h, 30m, 15m, or 5m
    
    let current = Math.ceil(visibleStart / interval) * interval;
    while (current <= visibleEnd) {
      labels.push(current);
      current += interval;
    }
    
    return labels;
  };

  return (
    <div className="space-y-4">
      {/* Timeline Controls */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="text-muted-foreground">
            {format(new Date(visibleStart * 1000), 'HH:mm')} - {format(new Date(visibleEnd * 1000), 'HH:mm')}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleZoom(1)}
              className="px-2 py-1 bg-secondary rounded text-xs hover:bg-secondary/80"
              disabled={zoomLevel >= 24}
            >
              🔍+
            </button>
            <span className="text-xs text-muted-foreground">{zoomLevel}x</span>
            <button
              onClick={() => handleZoom(-1)}
              className="px-2 py-1 bg-secondary rounded text-xs hover:bg-secondary/80"
              disabled={zoomLevel <= 1}
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
      <div ref={containerRef} className="relative">
        {/* Time Labels */}
        <div className="relative h-6 mb-2">
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
          ref={timelineRef}
          className="relative h-20 bg-secondary rounded-lg cursor-crosshair select-none"
          onClick={handleTimelineClick}
          onMouseMove={handleMouseMove}
        >
          {/* Recording Segments */}
          {data.segments.map((segment, index) => {
            const startPixel = timeToPixel(segment.start_time);
            const endPixel = timeToPixel(segment.end_time);
            const width = Math.max(1, endPixel - startPixel);
            
            if (startPixel >= 0 && startPixel <= (timelineRef.current?.offsetWidth || 0)) {
              return (
                <div
                  key={index}
                  className="absolute top-0 h-full bg-blue-500/60 hover:bg-blue-500/80"
                  style={{
                    left: `${startPixel}px`,
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
            const eventPixel = timeToPixel(event.start_time);
            const emoji = OBJECT_EMOJIS[event.label] || OBJECT_EMOJIS.unknown;
            
            if (eventPixel >= 0 && eventPixel <= (timelineRef.current?.offsetWidth || 0)) {
              return (
                <div
                  key={event.id}
                  className="absolute top-0 h-full flex items-center justify-center w-6 hover:scale-125 transition-transform cursor-pointer"
                  style={{ left: `${eventPixel - 12}px` }}
                  title={`${event.label} detected at ${format(new Date(event.start_time * 1000), 'HH:mm:ss')}`}
                >
                  <span className="text-lg drop-shadow-lg">{emoji}</span>
                </div>
              );
            }
            return null;
          })}

          {/* Current Time Indicator */}
          {selectedTime && (
            <div
              className="absolute top-0 h-full w-0.5 bg-red-500 z-10"
              style={{ left: `${timeToPixel(selectedTime)}px` }}
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
        {zoomLevel > 1 && (
          <div className="mt-2 h-2 bg-secondary rounded">
            <div
              className="h-full bg-primary rounded cursor-pointer"
              style={{
                width: `${100 / zoomLevel}%`,
                marginLeft: `${scrollPosition * (100 - 100 / zoomLevel)}%`,
              }}
              onMouseDown={(e) => {
                const startX = e.clientX;
                const startPosition = scrollPosition;
                
                const handleMouseMove = (e: MouseEvent) => {
                  const deltaX = e.clientX - startX;
                  const containerWidth = containerRef.current?.offsetWidth || 1;
                  const delta = deltaX / containerWidth;
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
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{data.segments.length} recording segments</span>
        <span>{data.events.length} events detected</span>
        <span>
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