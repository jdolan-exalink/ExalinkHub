"use client";

import { useState } from 'react';
import { format, subHours, startOfDay, endOfDay } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Camera as CameraIcon,
  Filter,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TimeRange {
  label: string;
  hours: number;
  value: string;
}

export interface EventFilters {
  cameras: string[];
  labels: string[];
  zones: string[];
  hasClip?: boolean;
  hasSnapshot?: boolean;
}

interface EventControlsProps {
  // Time controls
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  
  // Filter controls  
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  
  // Available options
  availableCameras: string[];
  availableLabels: string[];
  availableZones: string[];
  
  // Stats
  totalEvents: number;
  
  className?: string;
}

const TIME_RANGES: TimeRange[] = [
  { label: 'Last Hour', hours: 1, value: '1h' },
  { label: 'Last 6 Hours', hours: 6, value: '6h' },
  { label: 'Last 12 Hours', hours: 12, value: '12h' },
  { label: 'Last 24 Hours', hours: 24, value: '24h' },
  { label: 'Today', hours: 0, value: 'today' }, // Special case
];

export default function EventControls({
  selectedDate,
  onDateChange,
  timeRange,
  onTimeRangeChange,
  filters,
  onFiltersChange,
  availableCameras,
  availableLabels,
  availableZones,
  totalEvents,
  className
}: EventControlsProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const activeFilterCount = 
    filters.cameras.length + 
    filters.labels.length + 
    filters.zones.length +
    (filters.hasClip ? 1 : 0) +
    (filters.hasSnapshot ? 1 : 0);

  const toggleCamera = (camera: string) => {
    const newCameras = filters.cameras.includes(camera)
      ? filters.cameras.filter(c => c !== camera)
      : [...filters.cameras, camera];
    onFiltersChange({ ...filters, cameras: newCameras });
  };

  const toggleLabel = (label: string) => {
    const newLabels = filters.labels.includes(label)
      ? filters.labels.filter(l => l !== label)
      : [...filters.labels, label];
    onFiltersChange({ ...filters, labels: newLabels });
  };

  const toggleZone = (zone: string) => {
    const newZones = filters.zones.includes(zone)
      ? filters.zones.filter(z => z !== zone)
      : [...filters.zones, zone];
    onFiltersChange({ ...filters, zones: newZones });
  };

  const clearAllFilters = () => {
    onFiltersChange({
      cameras: [],
      labels: [],
      zones: [],
      hasClip: undefined,
      hasSnapshot: undefined
    });
  };

  return (
    <div className={`bg-card border rounded-lg p-4 ${className}`}>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Left side - Time controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Date Picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full sm:w-[200px] justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "PPP")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && onDateChange(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          {/* Time Range Selector */}
          <Select 
            value={timeRange.value} 
            onValueChange={(value) => {
              const range = TIME_RANGES.find(r => r.value === value);
              if (range) onTimeRangeChange(range);
            }}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <Clock className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGES.map(range => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Center - Stats */}
        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="gap-1">
            <span className="font-semibold">{totalEvents}</span>
            events
          </Badge>
          
          {activeFilterCount > 0 && (
            <Badge variant="outline" className="gap-1">
              <Filter className="h-3 w-3" />
              {activeFilterCount} filters
            </Badge>
          )}
        </div>

        {/* Right side - Filter controls */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Quick Camera Filter */}
          {availableCameras.length > 0 && (
            <Select 
              value={filters.cameras.length === 1 ? filters.cameras[0] : "all"}
              onValueChange={(value) => {
                if (value === "all") {
                  onFiltersChange({ ...filters, cameras: [] });
                } else {
                  onFiltersChange({ ...filters, cameras: [value] });
                }
              }}
            >
              <SelectTrigger className="w-[140px]">
                <CameraIcon className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All Cameras" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cameras</SelectItem>
                {availableCameras.map(camera => (
                  <SelectItem key={camera} value={camera}>
                    {camera}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Advanced Filters */}
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Advanced Filters</h4>
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="h-auto p-1 text-xs"
                    >
                      Clear All
                    </Button>
                  )}
                </div>

                {/* Object Types */}
                {availableLabels.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Object Types</label>
                    <div className="flex flex-wrap gap-1">
                      {availableLabels.map(label => (
                        <Badge
                          key={label}
                          variant={filters.labels.includes(label) ? "default" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => toggleLabel(label)}
                        >
                          {label}
                          {filters.labels.includes(label) && (
                            <X className="ml-1 h-3 w-3" />
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cameras */}
                {availableCameras.length > 1 && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Cameras</label>
                    <div className="flex flex-wrap gap-1">
                      {availableCameras.map(camera => (
                        <Badge
                          key={camera}
                          variant={filters.cameras.includes(camera) ? "default" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => toggleCamera(camera)}
                        >
                          {camera}
                          {filters.cameras.includes(camera) && (
                            <X className="ml-1 h-3 w-3" />
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Zones */}
                {availableZones.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Zones</label>
                    <div className="flex flex-wrap gap-1">
                      {availableZones.map(zone => (
                        <Badge
                          key={zone}
                          variant={filters.zones.includes(zone) ? "default" : "outline"}
                          className="cursor-pointer text-xs"
                          onClick={() => toggleZone(zone)}
                        >
                          {zone}
                          {filters.zones.includes(zone) && (
                            <X className="ml-1 h-3 w-3" />
                          )}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Content Type */}
                <div>
                  <label className="text-sm font-medium mb-2 block">Content</label>
                  <div className="flex gap-2">
                    <Badge
                      variant={filters.hasClip ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => onFiltersChange({
                        ...filters,
                        hasClip: filters.hasClip ? undefined : true
                      })}
                    >
                      Has Clip
                      {filters.hasClip && <X className="ml-1 h-3 w-3" />}
                    </Badge>
                    <Badge
                      variant={filters.hasSnapshot ? "default" : "outline"}
                      className="cursor-pointer text-xs"
                      onClick={() => onFiltersChange({
                        ...filters,
                        hasSnapshot: filters.hasSnapshot ? undefined : true
                      })}
                    >
                      Has Snapshot
                      {filters.hasSnapshot && <X className="ml-1 h-3 w-3" />}
                    </Badge>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}