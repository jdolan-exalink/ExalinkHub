"use client";

import { useState, useMemo } from 'react';
import type { Camera, FrigateEvent } from '@/lib/types';
import Image from 'next/image';
import { format, startOfDay, endOfDay, eachHourOfInterval, isWithinInterval } from 'date-fns';
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
import { Card, CardContent } from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Calendar as CalendarIcon, Camera as CameraIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type RecordingBrowserProps = {
  cameras: Camera[];
  events: FrigateEvent[];
};

export default function RecordingBrowser({ cameras, events }: RecordingBrowserProps) {
  const [selectedCamera, setSelectedCamera] = useState<string>(cameras[0].id);
  const [date, setDate] = useState<Date | undefined>(new Date());

  const recordingPlaceholder = PlaceHolderImages.find(img => img.id === 'recording_placeholder')!;

  const timeIntervals = useMemo(() => {
    if (!date) return [];
    const start = startOfDay(date);
    const end = endOfDay(date);
    return eachHourOfInterval({ start, end });
  }, [date]);

  const eventsForDayAndCamera = useMemo(() => {
    if (!date) return [];
    return events.filter(event => {
      const eventDate = new Date(event.start_time);
      return event.camera === cameras.find(c => c.id === selectedCamera)?.name &&
             isWithinInterval(eventDate, { start: startOfDay(date), end: endOfDay(date) });
    });
  }, [date, selectedCamera, events, cameras]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">Recording Browser</h1>
        <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2">
                <CameraIcon className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                    <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Select Camera" />
                    </SelectTrigger>
                    <SelectContent>
                        {cameras.map(camera => (
                            <SelectItem key={camera.id} value={camera.id}>
                                {camera.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={'outline'}
                className={cn(
                  "w-full sm:w-[240px] justify-start text-left font-normal",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date ? format(date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>
      
      <Card>
        <CardContent className="p-4">
            <h3 className="text-sm font-medium mb-2">Timeline</h3>
            <div className="relative w-full h-10 bg-secondary rounded-lg overflow-hidden">
                {eventsForDayAndCamera.map(event => {
                    const eventDate = new Date(event.start_time);
                    const totalSecondsInDay = 24 * 60 * 60;
                    const eventStartSecond = (eventDate.getHours() * 3600) + (eventDate.getMinutes() * 60) + eventDate.getSeconds();
                    const leftPercentage = (eventStartSecond / totalSecondsInDay) * 100;
                    return (
                        <div 
                            key={event.id}
                            className="absolute h-full w-1.5 bg-primary/70 hover:bg-primary cursor-pointer"
                            style={{ left: `${leftPercentage}%` }}
                            title={`Event: ${event.label} at ${format(eventDate, 'p')}`}
                        />
                    );
                })}

                <div className="absolute top-0 left-0 w-full h-full flex justify-between">
                    {timeIntervals.map((hour, index) => {
                        if (index % 3 === 0 && index > 0) {
                            return (
                                <div key={index} className="flex flex-col items-center h-full text-xs text-muted-foreground">
                                    <span className="mt-auto">{format(hour, 'ha')}</span>
                                    <div className="w-px h-2 bg-border"></div>
                                </div>
                            )
                        }
                        return null;
                    })}
                </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
                Showing event markers for {cameras.find(c => c.id === selectedCamera)?.name} on {date ? format(date, "PPP") : '...'}
            </p>
        </CardContent>
      </Card>

      <Card>
        <div className="aspect-video w-full bg-black relative overflow-hidden rounded-lg">
            <Image 
                src={recordingPlaceholder.imageUrl}
                alt="Recording player placeholder"
                fill
                className="object-contain"
                data-ai-hint={recordingPlaceholder.imageHint}
            />
        </div>
      </Card>
    </div>
  );
}
