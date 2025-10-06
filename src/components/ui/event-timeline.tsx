"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { format, addHours, subHours } from 'date-fns';
import { useTranslations } from 'next-intl';
import {
  IconUser, IconCar, IconTruck, IconBike, IconMotorbike, IconBus,
  IconDog, IconCat, IconPackage, IconQuestionMark, IconSearch
} from '@tabler/icons-react';
import type { FrigateEvent } from '@/lib/frigate-api';

interface EventTimelineProps {
  events: FrigateEvent[];
  selectedTime?: number;
  onTimeSelect?: (timestamp: number) => void;
  onEventSelect?: (event: FrigateEvent) => void;
  timeRange: number; // hours to show
  centerTime: number; // center timestamp
  className?: string;
}

// Tabler Icons mapping for object types
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
  license_plate: IconCar,
  lpr: IconCar,
  vehicle: IconCar,
  unknown: IconSearch
};

export default function EventTimeline({ 
  events, 
  selectedTime,
  onTimeSelect, 
  onEventSelect,
  timeRange,
  centerTime,
  className 
}: EventTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const translate_timeline = useTranslations('events.timeline');
  const [hoveredEvent, setHoveredEvent] = useState<FrigateEvent | null>(null);

  const startTime = centerTime - (timeRange * 3600) / 2;
  const endTime = centerTime + (timeRange * 3600) / 2;
  const totalSeconds = endTime - startTime;

  const timeToPixel = (timestamp: number) => {
    if (!timelineRef.current) return 0;
    const timelineWidth = timelineRef.current.offsetWidth;
    const relativeTime = timestamp - startTime;
    return (relativeTime / totalSeconds) * timelineWidth;
  };

  const pixelToTime = (pixel: number) => {
    if (!timelineRef.current) return startTime;
    const timelineWidth = timelineRef.current.offsetWidth;
    const relativePixel = pixel / timelineWidth;
    return startTime + (relativePixel * totalSeconds);
  };

  const handleTimelineClick = (event: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const timestamp = Math.floor(pixelToTime(clickX));
    
    onTimeSelect?.(timestamp);
  };

  const getTimeLabels = () => {
    const labels = [];
    const interval = timeRange <= 1 ? 300 : timeRange <= 6 ? 900 : 3600; // 5min, 15min, or 1h intervals
    
    let current = Math.ceil(startTime / interval) * interval;
    while (current <= endTime) {
      labels.push(current);
      current += interval;
    }
    
    return labels;
  };

  // Group events by camera for better visualization
  const eventsByCamera = events.reduce((acc, event) => {
    if (!acc[event.camera]) {
      acc[event.camera] = [];
    }
    acc[event.camera].push(event);
    return acc;
  }, {} as Record<string, FrigateEvent[]>);

  const cameras = Object.keys(eventsByCamera);

  return (
    <div className={`bg-card rounded-lg border ${className}`}>
      {/* Timeline Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{translate_timeline('title')}</h3>
          <div className="text-sm text-muted-foreground">
            {format(new Date(startTime * 1000), 'HH:mm')} - {format(new Date(endTime * 1000), 'HH:mm')}
          </div>
        </div>
      </div>

      {/* Timeline Content */}
      <div className="p-4">
        {/* Time Labels */}
        <div className="relative h-6 mb-4">
          {getTimeLabels().map(timestamp => (
            <div
              key={timestamp}
              className="absolute text-xs text-muted-foreground transform -translate-x-1/2"
              style={{ left: `${timeToPixel(timestamp)}px` }}
            >
              {format(new Date(timestamp * 1000), timeRange <= 1 ? 'HH:mm' : 'HH:mm')}
            </div>
          ))}
        </div>

        {/* Timeline Tracks - One per camera */}
        <div className="space-y-3">
          {cameras.map((camera, cameraIndex) => (
            <div key={camera} className="relative">
              {/* Camera Label */}
              <div className="flex items-center mb-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>
                <span className="text-sm font-medium text-muted-foreground">{camera}</span>
              </div>
              
              {/* Timeline Track */}
              <div 
                ref={cameraIndex === 0 ? timelineRef : undefined}
                className="relative h-12 bg-secondary/50 rounded cursor-crosshair border"
                onClick={handleTimelineClick}
              >
                {/* Motion Detection Background */}
                <div className="absolute inset-0 bg-blue-100/30 rounded"></div>
                
                {/* Grid Lines */}
                {getTimeLabels().map(timestamp => (
                  <div
                    key={timestamp}
                    className="absolute top-0 h-full w-px bg-border/30"
                    style={{ left: `${timeToPixel(timestamp)}px` }}
                  />
                ))}

                {/* Events */}
                {eventsByCamera[camera]?.map(event => {
                  const eventPixel = timeToPixel(event.start_time);
                  const IconComponent = OBJECT_ICONS[event.label] || OBJECT_ICONS.unknown;
                  
                  if (eventPixel >= 0 && eventPixel <= (timelineRef.current?.offsetWidth || 0)) {
                    return (
                      <div
                        key={event.id}
                        className="absolute top-0 h-full flex items-center justify-center w-8 hover:scale-125 transition-transform cursor-pointer z-10"
                        style={{ left: `${eventPixel - 16}px` }}
                        onMouseEnter={() => setHoveredEvent(event)}
                        onMouseLeave={() => setHoveredEvent(null)}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventSelect?.(event);
                        }}
                        title={`${event.label} detected at ${format(new Date(event.start_time * 1000), 'HH:mm:ss')}`}
                      >
                        <div className="bg-white rounded-full w-6 h-6 flex items-center justify-center shadow-sm border">
                          <IconComponent size={16} />
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}

                {/* Current Time Indicator */}
                {selectedTime && (
                  <div
                    className="absolute top-0 h-full w-0.5 bg-red-500 z-20"
                    style={{ left: `${timeToPixel(selectedTime)}px` }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Hover Tooltip */}
        {hoveredEvent && (
          <div className="absolute z-30 bg-black text-white px-2 py-1 rounded text-xs pointer-events-none">
            {hoveredEvent.label} - {format(new Date(hoveredEvent.start_time * 1000), 'HH:mm:ss')}
          </div>
        )}

        {/* No Events Message */}
        {events.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <div className="text-2xl mb-2">👁️</div>
            <div className="text-sm">{translate_timeline('no_events')}</div>
          </div>
        )}
      </div>
    </div>
  );
}