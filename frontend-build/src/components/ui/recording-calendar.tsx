"use client";

import { useState, useEffect } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

interface RecordingCalendarProps {
  camera: string;
  selectedDate?: Date;
  onDateSelect: (date: Date | undefined) => void;
  className?: string;
}

export default function RecordingCalendar({ 
  camera, 
  selectedDate, 
  onDateSelect, 
  className 
}: RecordingCalendarProps) {
  const [recordingDays, setRecordingDays] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date());
  const [isLoading, setIsLoading] = useState(false);

  const fetchRecordingDays = async (month: Date) => {
    if (!camera) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/frigate/recordings/days?camera=${encodeURIComponent(camera)}&month=${month.getMonth() + 1}&year=${month.getFullYear()}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setRecordingDays(data.recordingDays || []);
      } else {
        console.error('Failed to fetch recording days');
        setRecordingDays([]);
      }
    } catch (error) {
      console.error('Error fetching recording days:', error);
      setRecordingDays([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecordingDays(currentMonth);
  }, [camera, currentMonth]);

  const handleMonthChange = (month: Date) => {
    setCurrentMonth(month);
  };

  const modifiers = {
    hasRecording: (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return recordingDays.includes(dateStr);
    }
  };

  const modifiersClassNames = {
    hasRecording: 'recording-day'
  };

  const DayContentRenderer = ({ date, displayMonth, ...props }: any) => {
    const hasRecording = modifiers.hasRecording(date);
    const isCurrentMonth = date.getMonth() === displayMonth.getMonth();
    
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        <span className={`${!isCurrentMonth ? 'text-muted-foreground' : ''}`}>
          {format(date, 'd')}
        </span>
        {hasRecording && isCurrentMonth && (
          <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full border border-white" />
        )}
      </div>
    );
  };

  return (
    <div className={className}>
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={onDateSelect}
        onMonthChange={handleMonthChange}
        modifiers={modifiers}
        modifiersClassNames={modifiersClassNames}
        components={{
          DayContent: DayContentRenderer
        }}
        className="relative"
      />
      {isLoading && (
        <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      )}
    </div>
  );
}