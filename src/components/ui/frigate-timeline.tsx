"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { format, addHours, subHours, startOfHour } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, RotateCcw, Filter, Scissors, Download, Trash2 } from 'lucide-react';
import { 
  IconUser, IconCar, IconTruck, IconBike, IconMotorbike, IconBus, 
  IconDog, IconCat, IconPackage, IconFlame, IconCloud, IconDoor,
  IconQuestionMark, IconSearch 
} from '@tabler/icons-react';
import type { FrigateEvent, RecordingTimelineData } from '@/lib/frigate-api';

interface FrigateTimelineProps {
  data: RecordingTimelineData | null;
  camera: string;
  onTimeSelect?: (timestamp: number) => void;
  onRangeSelect?: (startTime: number, endTime: number) => void;
  onDownloadRange?: (startTime: number, endTime: number) => void;
  selectedTime?: number;
  selectionRange?: { start: number; end: number } | null;
  selectionMode?: boolean;
  onPreviewTime?: (timestamp: number) => void;
  className?: string;
  filter?: string;
}

// Tabler Icons mapping for object types - Professional minimalista icons
const OBJECT_ICONS: Record<string, any> = {
  person: IconUser,
  car: IconCar,
  truck: IconTruck,
  bicycle: IconBike,
  motorcycle: IconMotorbike,
  bus: IconBus,
  cat: IconCat,
  dog: IconDog,
  package: IconPackage,
  fire: IconFlame,
  smoke: IconCloud,
  door: IconDoor,
  license_plate: IconCar, // LPR - Use car icon for license plates
  lpr: IconCar, // Alternative name for LPR
  vehicle: IconCar, // Generic vehicle
  unknown: IconSearch // Search icon for detected/unknown objects
};

// Emoji mapping for object types - More professional icons

export default function FrigateTimeline({ 
  data, 
  camera,
  onTimeSelect, 
  onRangeSelect,
  onDownloadRange,
  selectedTime,
  selectionRange,
  selectionMode = false,
  onPreviewTime,
  className,
  filter = 'all'
}: FrigateTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const lastDragUpdateRef = useRef<number>(0);
  const [currentHour, setCurrentHour] = useState(() => {
    // Start with selectedTime if available, otherwise current hour
    if (selectedTime) {
      return startOfHour(new Date(selectedTime * 1000));
    }
    const now = new Date();
    return startOfHour(now);
  });

  // Sync currentHour with selectedTime when it changes
  useEffect(() => {
    if (selectedTime) {
      const selectedHour = startOfHour(new Date(selectedTime * 1000));
      setCurrentHour(selectedHour);
    }
  }, [selectedTime]);

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState<number | null>(null);
  const [objectFilter, setObjectFilter] = useState<string>(filter);

  // Sync external filter with internal state
  useEffect(() => {
    setObjectFilter(filter);
  }, [filter]);
  const [isDragging, setIsDragging] = useState(false);

  const hourStart = Math.floor(currentHour.getTime() / 1000);
  const hourEnd = hourStart + 3600; // 1 hour = 3600 seconds

  // Get unique object types from events for filter dropdown with counts
  const availableObjects = useMemo(() => {
    if (!data?.events) return [];
    const objectCounts: Record<string, number> = {};
    
    data.events.forEach(event => {
      objectCounts[event.label] = (objectCounts[event.label] || 0) + 1;
    });
    
    return Object.entries(objectCounts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count); // Sort by count descending
  }, [data?.events]);

  // Filter events based on selected object type
  const filteredEvents = useMemo(() => {
    if (!data?.events) return [];
    if (objectFilter === 'all') return data.events;
    return data.events.filter(event => event.label === objectFilter);
  }, [data?.events, objectFilter]);

  // Navigate to different hours
  const navigateHour = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentHour(prev => subHours(prev, 1));
    } else {
      setCurrentHour(prev => addHours(prev, 1));
    }
  };

  const goToCurrentHour = () => {
    setCurrentHour(startOfHour(new Date()));
  };

  const timeToPixel = (timestamp: number) => {
    if (!timelineRef.current) return 0;
    const timelineWidth = timelineRef.current.offsetWidth;
    const relativeTime = timestamp - hourStart;
    return (relativeTime / 3600) * timelineWidth; // 3600 seconds in an hour
  };

  const pixelToTime = (pixel: number) => {
    if (!timelineRef.current) return hourStart;
    const timelineWidth = timelineRef.current.offsetWidth;
    const relativePixel = pixel / timelineWidth;
    return hourStart + (relativePixel * 3600);
  };

  const handleTimelineClick = (event: React.MouseEvent) => {
    // Don't handle clicks if we just finished dragging
    if (isDragging) {
      setIsDragging(false);
      return;
    }
    
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

  const handleMouseDown = (event: React.MouseEvent) => {
    if (!timelineRef.current || event.shiftKey) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const timestamp = Math.floor(pixelToTime(clickX));
    
    // Start dragging and immediately update time
    setIsDragging(true);
    onTimeSelect?.(timestamp);
    
    // Prevent default to avoid text selection
    event.preventDefault();
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const timestamp = Math.floor(pixelToTime(mouseX));
    
    if (isSelecting && selectionStart !== null) {
      // Handle range selection
      const start = Math.min(selectionStart, timestamp);
      const end = Math.max(selectionStart, timestamp);
      onRangeSelect?.(start, end);
      
      // Show preview while selecting if in selection mode
      if (selectionMode && onPreviewTime) {
        onPreviewTime(timestamp);
      }
    } else if (isDragging && event.buttons === 1) {
      // Handle timeline dragging for video seeking - only update every 200ms to reduce load
      const now = Date.now();
      if (!lastDragUpdateRef.current || now - lastDragUpdateRef.current > 200) {
        onTimeSelect?.(timestamp);
        lastDragUpdateRef.current = now;
      }
    } else if (selectionMode && onPreviewTime) {
      // Show preview on hover when in selection mode
      onPreviewTime(timestamp);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      // Small delay to prevent click event from firing
      setTimeout(() => setIsDragging(false), 50);
    }
  };

  // Generate minute markers for the hour - every minute with different styles
  const getMinuteMarkers = () => {
    const markers = [];
    
    // Generate markers from 0 to 60 minutes (including next hour start)
    for (let i = 0; i <= 60; i++) {
      const timestamp = hourStart + (i * 60);
      let type = 'dot'; // Default: small dot for each minute
      
      if (i % 15 === 0) {
        type = 'major'; // Major labels every 15 minutes (0, 15, 30, 45, 60)
      } else if (i % 5 === 0) {
        type = 'minor'; // Small lines every 5 minutes
      }
      
      markers.push({ timestamp, type, minute: i });
    }
    
    return markers;
  };

  // Filter events and segments for current hour
  const hourEvents = filteredEvents.filter(event => 
    event.start_time >= hourStart && event.start_time < hourEnd
  ) || [];

  const hourSegments = data?.segments.filter(segment => 
    segment.start_time < hourEnd && segment.end_time > hourStart
  ) || [];

  const isCurrentHour = Math.abs(Date.now() / 1000 - (hourStart + 1800)) < 1800; // Within current hour

  // Debug: Log timeline data
  useEffect(() => {
    if (data) {
      console.log('FrigateTimeline - Data received:', {
        segments: data.segments?.length || 0,
        events: data.events?.length || 0,
        hourStart: new Date(hourStart * 1000).toISOString(),
        hourEnd: new Date(hourEnd * 1000).toISOString(),
        hourSegments: hourSegments.length,
        hourEvents: hourEvents.length,
        currentHour: currentHour.toISOString(),
        selectedTime: selectedTime ? new Date(selectedTime * 1000).toISOString() : 'none'
      });
    }
  }, [data, hourStart, hourEnd, hourSegments.length, hourEvents.length, currentHour, selectedTime]);

  return (
    <div className={`w-full ${className}`}>
      {/* Modern Audio Waveform Style Timeline */}
      <div className="relative">
        {/* Time labels above timeline - ms compacto y fino */}
        <div className="relative h-3 mb-2">
          {getMinuteMarkers().map(marker => {
            // Solo mostrar etiquetas para marcadores principales (cada 15m)
            if (marker.type !== 'major') return null;
            
            const pixelPosition = timeToPixel(marker.timestamp);
            // Evitar que las etiquetas se salgan del cuadro
            const isFirstLabel = marker.minute === 0;
            const isLastLabel = marker.minute === 60;
            
            return (
              <div
                key={`label-${marker.timestamp}`}
                className={`absolute text-xs text-gray-600 font-medium font-mono ${
                  isFirstLabel ? 'translate-x-0' : isLastLabel ? '-translate-x-full' : '-translate-x-1/2'
                }`}
                style={{ left: `${pixelPosition}px`, top: '-2px' }}
              >
                {format(new Date(marker.timestamp * 1000), 'HH:mm')}
              </div>
            );
          })}
        </div>

        {/* Main waveform timeline container - altura reducida */}
        <div 
          ref={timelineRef}
          className="relative h-16 bg-gradient-to-b from-gray-50 to-gray-100 rounded-xl cursor-pointer select-none border border-gray-200 overflow-hidden"
          onClick={handleTimelineClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Background gradient mesh */}
          <div className="absolute inset-0 opacity-30">
            <div className="w-full h-full bg-gradient-to-r from-transparent via-blue-50 to-transparent"></div>
          </div>

          {/* Recording segments as waveform bars */}
          {hourSegments.map((segment, index) => {
            const segmentStart = Math.max(segment.start_time, hourStart);
            const segmentEnd = Math.min(segment.end_time, hourEnd);
            const startPixel = timeToPixel(segmentStart);
            const width = Math.max(2, timeToPixel(segmentEnd) - startPixel);
            
            // Generate waveform bars for this segment
            const barCount = Math.max(3, Math.floor(width / 4));
            const bars = Array.from({ length: barCount }, (_, i) => {
              const height = Math.random() * 60 + 20; // Random height between 20-80%
              return height;
            });
            
            return (
              <div
                key={index}
                className="absolute bottom-0 flex items-end gap-0.5"
                style={{
                  left: `${startPixel}px`,
                  width: `${width}px`,
                  height: '100%'
                }}
                title={`Recording: ${format(new Date(segmentStart * 1000), 'HH:mm:ss')} - ${format(new Date(segmentEnd * 1000), 'HH:mm:ss')}`}
              >
                {bars.map((height, barIndex) => (
                  <div
                    key={barIndex}
                    className="bg-gradient-to-t from-blue-400 to-blue-300 rounded-t-sm opacity-80 hover:opacity-100 transition-opacity"
                    style={{
                      height: `${height}%`,
                      width: `${Math.max(1, width / barCount - 0.5)}px`,
                      minWidth: '1px'
                    }}
                  />
                ))}
              </div>
            );
          })}

          {/* Event markers - floating icons */}
          {hourEvents.map((event, index) => {
            const eventPixel = timeToPixel(event.start_time);
            const IconComponent = OBJECT_ICONS[event.label] || OBJECT_ICONS.unknown;
            
            return (
              <div
                key={`event-${event.id}-${index}`}
                className="absolute top-2 z-20 cursor-pointer group"
                style={{ left: `${eventPixel - 10}px`, width: '20px', height: '20px' }}
                title={`${event.label} at ${format(new Date(event.start_time * 1000), 'HH:mm:ss')}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTimeSelect?.(event.start_time);
                }}
              >
                <div className="w-5 h-5 bg-white rounded-full shadow-lg border border-gray-200 flex items-center justify-center group-hover:scale-110 transition-transform group-hover:shadow-xl">
                  <IconComponent size={12} className="text-orange-600" />
                </div>
                {/* Connecting line to waveform */}
                <div className="absolute top-5 left-1/2 w-px h-8 bg-orange-300 opacity-60 transform -translate-x-0.5"></div>
              </div>
            );
          })}

          {/* RED POSITION MARKER - Elegant thin line */}
          {selectedTime && selectedTime >= hourStart && selectedTime < hourEnd && (
            <div
              className="absolute top-0 bottom-0 z-30 flex flex-col items-center"
              style={{ left: `${timeToPixel(selectedTime)}px` }}
            >
              {/* Top marker */}
              <div className="w-3 h-3 bg-red-500 rounded-full shadow-lg border-2 border-white -mt-1"></div>
              {/* Main line */}
              <div className="w-0.5 h-full bg-gradient-to-b from-red-500 to-red-400 shadow-sm"></div>
              {/* Bottom marker */}
              <div className="w-3 h-3 bg-red-500 rounded-full shadow-lg border-2 border-white -mb-1"></div>
            </div>
          )}

          {/* Selection range - subtle highlight */}
          {selectionRange && (
            <div
              className="absolute top-0 bottom-0 bg-blue-200/40 border-l-2 border-r-2 border-blue-400 z-10 rounded-sm"
              style={{
                left: `${timeToPixel(Math.max(selectionRange.start, hourStart))}px`,
                width: `${timeToPixel(Math.min(selectionRange.end, hourEnd)) - timeToPixel(Math.max(selectionRange.start, hourStart))}px`,
              }}
            />
          )}

          {/* Marcadores de tiempo ms precisos y finos */}
          {getMinuteMarkers().map(marker => {
            let lineClass = '';
            let heightClass = '';
            
            if (marker.type === 'major') {
              // Lneas principales cada 15 minutos
              lineClass = 'bg-gray-400/80 w-0.5';
              heightClass = 'h-full';
            } else if (marker.type === 'minor') {
              // Rallitas cada 5 minutos
              lineClass = 'bg-gray-300/60 w-px';
              heightClass = 'h-2/3';
            } else {
              // Puntitos cada minuto
              lineClass = 'bg-gray-200/50 w-px';
              heightClass = 'h-1/3';
            }
            
            const pixelPosition = timeToPixel(marker.timestamp);
            
            return (
              <div
                key={`grid-${marker.timestamp}-${marker.type}`}
                className={`absolute top-0 ${lineClass} ${heightClass}`}
                style={{ left: `${pixelPosition}px` }}
              />
            );
          })}

          {/* No recordings message */}
          {hourSegments.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">
              <div className="bg-white/80 px-3 py-1 rounded-full border border-gray-200">
                No recordings in this hour
              </div>
            </div>
          )}
        </div>

        {/* Bottom stats - ms compacto */}
        <div className="flex justify-between items-center text-xs text-gray-500 mt-2">
          <div className="flex gap-4">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-blue-400 rounded-sm"></div>
              <span>{hourSegments.length} grabaciones</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              <span>{hourEvents.length} detecciones</span>
            </div>
          </div>
          <div className="text-gray-400 font-mono text-xs">
            {format(currentHour, 'HH:mm')} - {format(addHours(currentHour, 1), 'HH:mm')}
          </div>
        </div>
      </div>
    </div>
  );
}
