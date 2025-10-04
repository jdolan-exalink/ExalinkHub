"use client";

import { useState, useMemo } from 'react';
import type { FrigateEvent, Camera } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import EventFilters from './event-filters';
import EventCard from './event-card';

type EventDashboardProps = {
  initialEvents: FrigateEvent[];
  cameras: Camera[];
};

export default function EventDashboard({ initialEvents, cameras }: EventDashboardProps) {
  const [events, setEvents] = useState<FrigateEvent[]>(initialEvents);
  const [cameraFilter, setCameraFilter] = useState<string>('all');
  const [labelFilter, setLabelFilter] = useState<string>('all');

  const filteredEvents = useMemo(() => {
    return events.filter(event => {
      const cameraMatch = cameraFilter === 'all' || event.camera === cameraFilter;
      const labelMatch = labelFilter === 'all' || event.label === labelFilter;
      return cameraMatch && labelMatch;
    });
  }, [events, cameraFilter, labelFilter]);

  const lprEvents = useMemo(() => {
    return filteredEvents.filter(event => event.label === 'license_plate');
  }, [filteredEvents]);
  
  const uniqueLabels = useMemo(() => [...new Set(initialEvents.map(e => e.label))], [initialEvents]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="font-headline text-3xl font-bold tracking-tight">Events</h1>
        <EventFilters
          cameras={cameras}
          labels={uniqueLabels}
          onCameraChange={setCameraFilter}
          onLabelChange={setLabelFilter}
        />
      </div>
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Events</TabsTrigger>
          <TabsTrigger value="lpr">License Plates</TabsTrigger>
        </TabsList>
        <TabsContent value="all">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredEvents.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        </TabsContent>
        <TabsContent value="lpr">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {lprEvents.length > 0 ? (
              lprEvents.map(event => <EventCard key={event.id} event={event} />)
            ) : (
              <div className="col-span-full text-center text-muted-foreground py-12">
                No license plate events match the current filters.
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
