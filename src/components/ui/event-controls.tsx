"use client";

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Calendar as CalendarIcon,
  Clock,
  Camera as CameraIcon,
  Filter,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TimeRange {
  translation_key: string;
  value: string;
  type: 'specific' | 'preset';
  startTime?: string; // HH:MM format for specific times
  endTime?: string;   // HH:MM format for specific times
  hours?: number;     // For preset ranges (backward compatibility)
}

export interface EventFilters {
  cameras: string[];
  labels: string[];
  zones: string[];
  hasClip?: boolean;
  hasSnapshot?: boolean;
}

interface EventControlsProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  timeRange: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  filters: EventFilters;
  onFiltersChange: (filters: EventFilters) => void;
  availableCameras: string[];
  availableLabels: string[];
  availableZones: string[];
  totalEvents: number;
  className?: string;
}

const TIME_RANGES: TimeRange[] = [
  { translation_key: 'full_day', value: 'full_day', type: 'preset', startTime: '00:00', endTime: '23:59' },
  { translation_key: 'morning', value: 'morning', type: 'preset', startTime: '06:00', endTime: '12:00' },
  { translation_key: 'afternoon', value: 'afternoon', type: 'preset', startTime: '12:00', endTime: '18:00' },
  { translation_key: 'evening', value: 'evening', type: 'preset', startTime: '18:00', endTime: '23:59' },
  { translation_key: 'custom', value: 'custom', type: 'specific', startTime: '09:00', endTime: '17:00' }
];

/**
 * Finds the time range definition that matches the provided value.
 */
function get_time_range_by_value(value: string): TimeRange | undefined {
  return TIME_RANGES.find((range) => range.value === value);
}

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
  const locale_code = useLocale();
  const translate_controls = useTranslations('events.controls');

  const date_formatter = useMemo(
    () => new Intl.DateTimeFormat(locale_code, { dateStyle: 'medium' }),
    [locale_code]
  );

  const time_range_options = useMemo(
    () => TIME_RANGES.map((range) => ({
      ...range,
      label: translate_controls(range.translation_key)
    })),
    [translate_controls]
  );

  const active_filter_count =
    filters.cameras.length +
    filters.labels.length +
    filters.zones.length +
    (filters.hasClip ? 1 : 0) +
    (filters.hasSnapshot ? 1 : 0);

  const toggle_camera = (camera: string) => {
    const new_cameras = filters.cameras.includes(camera)
      ? filters.cameras.filter((item) => item !== camera)
      : [...filters.cameras, camera];
    onFiltersChange({ ...filters, cameras: new_cameras });
  };

  const toggle_label = (label: string) => {
    const new_labels = filters.labels.includes(label)
      ? filters.labels.filter((item) => item !== label)
      : [...filters.labels, label];
    onFiltersChange({ ...filters, labels: new_labels });
  };

  const toggle_zone = (zone: string) => {
    const new_zones = filters.zones.includes(zone)
      ? filters.zones.filter((item) => item !== zone)
      : [...filters.zones, zone];
    onFiltersChange({ ...filters, zones: new_zones });
  };

  const clear_all_filters = () => {
    onFiltersChange({
      cameras: [],
      labels: [],
      zones: [],
      hasClip: undefined,
      hasSnapshot: undefined
    });
  };

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {/* Date Control */}
      <div className="flex items-center gap-2">
        <span className="text-white font-medium text-sm">{translate_controls('specific_date')}</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-auto justify-start text-left font-normal bg-purple-600 border-purple-500 text-white hover:bg-purple-700"
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              <span className="truncate">{date_formatter.format(selectedDate)}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-gray-800 border-gray-600" align="start">
            <div className="p-3 border-b border-gray-600">
              <p className="text-sm text-gray-300 text-center">
                {translate_controls('select_specific_day')}
              </p>
            </div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && onDateChange(date)}
              initialFocus
              className="bg-gray-800 text-white"
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Time Range Control */}
      <div className="flex items-center gap-2">
        <span className="text-white font-medium text-sm">{translate_controls('time_range')}</span>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-auto min-w-[120px] bg-green-600 border-green-500 text-white hover:bg-green-700"
            >
              <Clock className="mr-2 h-4 w-4" />
              <span className="truncate">
                {timeRange.type === 'specific' 
                  ? `${timeRange.startTime} - ${timeRange.endTime}`
                  : time_range_options.find(r => r.value === timeRange.value)?.label || timeRange.value
                }
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 bg-gray-800 border-gray-600" align="start">
            <div className="space-y-4">
              <div className="text-center border-b border-gray-600 pb-3">
                <p className="text-sm text-gray-300">
                  {translate_controls('select_time_range')}
                </p>
              </div>
              
              <div>
                <Label className="text-white font-medium mb-2 block">{translate_controls('predefined_ranges')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {TIME_RANGES.filter(r => r.type === 'preset').map((range) => (
                    <Button
                      key={range.value}
                      variant={timeRange.value === range.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => onTimeRangeChange(range)}
                      className="text-xs"
                    >
                      {translate_controls(range.translation_key)}
                    </Button>
                  ))}
                </div>
              </div>
              
              <div className="border-t border-gray-600 pt-4">
                <Label className="text-white font-medium mb-2 block">{translate_controls('custom_time')}</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-300 text-xs mb-1 block">{translate_controls('start_time')}</Label>
                    <Input
                      type="time"
                      value={timeRange.startTime || '09:00'}
                      onChange={(e) => onTimeRangeChange({
                        ...timeRange,
                        value: 'custom',
                        type: 'specific',
                        startTime: e.target.value
                      })}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300 text-xs mb-1 block">{translate_controls('end_time')}</Label>
                    <Input
                      type="time"
                      value={timeRange.endTime || '17:00'}
                      onChange={(e) => onTimeRangeChange({
                        ...timeRange,
                        value: 'custom',
                        type: 'specific',
                        endTime: e.target.value
                      })}
                      className="bg-gray-700 border-gray-600 text-white"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {translate_controls('tip_next_day')}
                </p>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Camera Filter */}
      {availableCameras.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-white font-medium text-sm">{translate_controls('camera')}</span>
          <Select
            value={filters.cameras.length === 1 ? filters.cameras[0] : 'all'}
            onValueChange={(value) => {
              if (value === 'all') {
                onFiltersChange({ ...filters, cameras: [] });
              } else {
                onFiltersChange({ ...filters, cameras: [value] });
              }
            }}
          >
            <SelectTrigger className="w-auto min-w-[120px] bg-blue-600 border-blue-500 text-white hover:bg-blue-700">
              <CameraIcon className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-600">
              <SelectItem value="all" className="text-white hover:bg-blue-600">{translate_controls('all_cameras')}</SelectItem>
              {availableCameras.map((camera) => (
                <SelectItem key={camera} value={camera} className="text-white hover:bg-blue-600">
                  {camera}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Advanced Filters */}
      <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="gap-1 text-sm bg-orange-600 border-orange-500 text-white hover:bg-orange-700">
            <Filter className="h-4 w-4" />
            <span>{translate_controls('filters')}</span>
            {active_filter_count > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 text-xs px-1 bg-white text-orange-600">
                {active_filter_count}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 bg-gray-800 border-gray-600" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-white">{translate_controls('filters_title')}</h4>
              {active_filter_count > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clear_all_filters}
                  className="h-auto p-1 text-xs text-white hover:bg-gray-700"
                >
                  {translate_controls('clear')}
                </Button>
              )}
            </div>

            {availableLabels.length > 0 && (
              <div>
                <label className="text-sm font-medium mb-2 block text-white">{translate_controls('object_types')}</label>
                <div className="flex flex-wrap gap-1">
                  {availableLabels.map((label) => (
                    <Badge
                      key={label}
                      variant={filters.labels.includes(label) ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => toggle_label(label)}
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

            <div>
              <label className="text-sm font-medium mb-2 block text-white">{translate_controls('content')}</label>
              <div className="flex gap-2">
                <Badge
                  variant={filters.hasClip ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => onFiltersChange({
                    ...filters,
                    hasClip: filters.hasClip ? undefined : true
                  })}
                >
                  {translate_controls('has_video')}
                  {filters.hasClip && <X className="ml-1 h-3 w-3" />}
                </Badge>
                <Badge
                  variant={filters.hasSnapshot ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => onFiltersChange({
                    ...filters,
                    hasSnapshot: filters.hasSnapshot ? undefined : true
                  })}
                >
                  {translate_controls('has_snapshot')}
                  {filters.hasSnapshot && <X className="ml-1 h-3 w-3" />}
                </Badge>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
