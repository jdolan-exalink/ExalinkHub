"use client";

import { useMemo } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Clock, Camera as CameraIcon, Filter, Check } from 'lucide-react';
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
  label_counts?: Record<string, number>;
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
  label_counts,
  availableZones,
  totalEvents,
  className
}: EventControlsProps) {
  const translate_controls = useTranslations('events.controls');
  const translate_events_page = useTranslations('events.page');
  const locale_code = useLocale();

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

  const clear_all_filters = () => {
    onFiltersChange({
      cameras: [],
      labels: [],
      zones: [],
      hasClip: undefined,
      hasSnapshot: undefined
    });
  };

  const toggle_label = (label: string) => {
    const new_labels = filters.labels.includes(label)
      ? filters.labels.filter((item) => item !== label)
      : [...filters.labels, label];
    onFiltersChange({ ...filters, labels: new_labels });
  };

  return (
    <div className="bg-card border-b border-border flex-shrink-0">
      {/* Controles */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Controles Izquierda: Título, Cámaras, Hora, Fecha */}
          <div className="flex items-center gap-6">
            <h1 className="font-semibold text-lg mr-4">{translate_events_page('title')}</h1>

            {availableCameras.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{translate_controls('cameras_label')}</span>
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
                  <SelectTrigger className="w-[180px] bg-blue-600 text-white justify-start">
                    <CameraIcon className="mr-2 h-4 w-4 text-white" />
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
              </div>
            )}

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{translate_controls('time_label')}</span>
              <Select
                value={timeRange.value}
                onValueChange={(value) => {
                  const range = get_time_range_by_value(value);
                  if (range) {
                    onTimeRangeChange(range);
                  }
                }}
              >
                <SelectTrigger className="w-[140px] bg-green-600 text-white">
                  <Clock className="mr-2 h-4 w-4 text-white" />
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

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{translate_controls('date_label')}</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button className="w-[180px] bg-purple-600 text-white justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4 text-white" />
                    {date_formatter.format(selectedDate)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && onDateChange(date)}
                    disabled={(date) => date > new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Controles Derecha: Filtros */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{translate_controls('filters_label')}</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button className="bg-orange-500 text-white flex items-center gap-2 px-4 py-2">
                    <Filter className="h-4 w-4" />
                    <span className="font-medium">{translate_controls('filters_all', { count: totalEvents })}</span>
                    <span className="ml-2 text-sm opacity-90">▾</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56">
                  <div className="p-2">
                    <div className="mb-2">
                      <button
                        className={`w-full text-left px-3 py-2 rounded-md ${filters.labels.length === 0 ? 'bg-violet-600 text-white' : 'hover:bg-gray-100'}`}
                        onClick={() => {
                          // clicking 'Todos' clears specific label filters
                          onFiltersChange({ ...filters, labels: [] });
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">🔍</span>
                            <span className="text-sm">{translate_controls('filters_all', { count: totalEvents })}</span>
                          </div>
                          <div className="text-sm text-gray-700">{totalEvents}</div>
                        </div>
                      </button>
                    </div>

                    <div className="max-h-56 overflow-auto">
                      {availableLabels.length === 0 ? (
                        <div className="text-sm text-muted-foreground px-3">{translate_controls('no_labels')}</div>
                      ) : (
                        availableLabels.map((label) => {
                          const isSelected = filters.labels.includes(label);
                          return (
                            <button
                              key={label}
                              onClick={() => toggle_label(label)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-md mb-1 ${isSelected ? 'bg-violet-600 text-white' : 'hover:bg-gray-50'}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">•</span>
                                <span className="text-sm">{label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{(label_counts && label_counts[label]) || 0}</span>
                                {isSelected && <Check className="h-4 w-4 text-white bg-violet-700 rounded-full p-0.5" />}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-3">
                      <Button onClick={clear_all_filters} className="w-full">
                        {translate_controls('clear_all')}
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
