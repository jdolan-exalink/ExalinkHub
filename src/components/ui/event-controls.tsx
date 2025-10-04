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
  { translation_key: 'last_hour', hours: 1, value: '1h' },
  { translation_key: 'last_6_hours', hours: 6, value: '6h' },
  { translation_key: 'last_12_hours', hours: 12, value: '12h' },
  { translation_key: 'last_24_hours', hours: 24, value: '24h' },
  { translation_key: 'today', hours: 0, value: 'today' }
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
      label: translate_controls(`time_ranges.${range.translation_key}`)
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
    <div className={cn('bg-card border rounded-lg p-4', className)}>
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full sm:w-[200px] justify-start text-left font-normal"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date_formatter.format(selectedDate)}
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

          <Select
            value={timeRange.value}
            onValueChange={(value) => {
              const range = get_time_range_by_value(value);
              if (range) {
                onTimeRangeChange(range);
              }
            }}
          >
            <SelectTrigger className="w-full sm:w-[150px]">
              <Clock className="mr-2 h-4 w-4" />
              <SelectValue placeholder={translate_controls('time_range_placeholder')} />
            </SelectTrigger>
            <SelectContent>
              {time_range_options.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4">
          <Badge variant="secondary" className="gap-1">
            {translate_controls('total_events', { count: totalEvents })}
          </Badge>

          {active_filter_count > 0 && (
            <Badge variant="outline" className="gap-1">
              <Filter className="h-3 w-3" />
              {translate_controls('active_filters', { count: active_filter_count })}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {availableCameras.length > 0 && (
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
              <SelectTrigger className="w-[140px]">
                <CameraIcon className="mr-2 h-4 w-4" />
                <SelectValue placeholder={translate_controls('all_cameras')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{translate_controls('all_cameras')}</SelectItem>
                {availableCameras.map((camera) => (
                  <SelectItem key={camera} value={camera}>
                    {camera}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                {translate_controls('filters_button')}
                {active_filter_count > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 text-xs">
                    {active_filter_count}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{translate_controls('filters_title')}</h4>
                  {active_filter_count > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clear_all_filters}
                      className="h-auto p-1 text-xs"
                    >
                      {translate_controls('clear_all')}
                    </Button>
                  )}
                </div>

                {availableLabels.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">{translate_controls('object_types')}</label>
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

                {availableCameras.length > 1 && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">{translate_controls('cameras')}</label>
                    <div className="flex flex-wrap gap-1">
                      {availableCameras.map((camera) => (
                        <Badge
                          key={camera}
                          variant={filters.cameras.includes(camera) ? 'default' : 'outline'}
                          className="cursor-pointer text-xs"
                          onClick={() => toggle_camera(camera)}
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

                {availableZones.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">{translate_controls('zones')}</label>
                    <div className="flex flex-wrap gap-1">
                      {availableZones.map((zone) => (
                        <Badge
                          key={zone}
                          variant={filters.zones.includes(zone) ? 'default' : 'outline'}
                          className="cursor-pointer text-xs"
                          onClick={() => toggle_zone(zone)}
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

                <div>
                  <label className="text-sm font-medium mb-2 block">{translate_controls('content')}</label>
                  <div className="flex gap-2">
                    <Badge
                      variant={filters.hasClip ? 'default' : 'outline'}
                      className="cursor-pointer text-xs"
                      onClick={() => onFiltersChange({
                        ...filters,
                        hasClip: filters.hasClip ? undefined : true
                      })}
                    >
                      {translate_controls('has_clip')}
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
      </div>
    </div>
  );
}
