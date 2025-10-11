"use client";

import { useState, type FC } from 'react';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Bot, ChevronRight, Clock, Video, Tag, MapPin, Loader2, Sparkles } from 'lucide-react';
import { categorizeAndPrioritizeEvents } from '@/ai/flows/categorize-and-prioritize-events';
import type { FrigateEvent, CategorizedEvent } from '@/lib/types';
import { cn } from '@/lib/utils';

// Mock function to simulate reading a data URI
async function toDataURI(url: string) {
    // In a real scenario, this would fetch the image and convert it.
    // Here we just return a placeholder.
    return "data:image/jpeg;base64,";
}

const priorityColors: Record<string, string> = {
  high: 'bg-red-500 hover:bg-red-500',
  medium: 'bg-yellow-500 hover:bg-yellow-500',
  low: 'bg-green-500 hover:bg-green-500',
};

const EventCard: FC<{ event: FrigateEvent }> = ({ event }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<CategorizedEvent | null>(null);

  const handleAnalysis = async () => {
    setIsAnalyzing(true);
    try {
        // This is a mock implementation.
        // In a real app, you would properly handle the thumbnail data URI.
        const mockThumbnailDataUri = await toDataURI(event.image);

        // Mocking the AI call to avoid actual API calls in this context.
        // const result = await categorizeAndPrioritizeEvents({
        //     eventData: {
        //         camera: event.camera,
        //         label: event.label,
        //         startTime: new Date(event.start_time).toISOString(),
        //         zones: event.zones,
        //         thumbnail: mockThumbnailDataUri,
        //     },
        //     rules: [{ criteria: { label: "person" }, category: "Intrusion", priority: "high" }]
        // });
        
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay
        const mockResult: CategorizedEvent = {
            category: event.label === 'person' ? 'Human Activity' : event.label === 'car' ? 'Vehicle Movement' : 'Object Detected',
            priority: event.label === 'person' ? 'high' : event.label === 'car' ? 'medium' : 'low',
            reason: `Rule for '${event.label}' was triggered.`
        };
        
      setAnalysis(mockResult);
    } catch (error) {
      console.error('Analysis failed:', error);
      // Here you could show a toast notification
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card className="flex flex-col overflow-hidden transition-all hover:shadow-lg">
      <CardHeader className="p-0 relative">
        <Dialog>
          <DialogTrigger asChild>
            <div className="aspect-video overflow-hidden cursor-pointer">
              <Image
                src={event.image}
                alt={`Event thumbnail for ${event.label} on ${event.camera}`}
                width={300}
                height={169}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                data-ai-hint={`${event.label} ${event.camera}`}
              />
            </div>
          </DialogTrigger>
          <Badge className="absolute top-2 left-2 capitalize">{event.label.replace('_', ' ')}</Badge>
          {analysis && (
            <Badge className={cn("absolute top-2 right-2", priorityColors[analysis.priority])}>
              {analysis.priority}
            </Badge>
          )}
          <DialogContent className="sm:max-w-[60vw]">
             <DialogHeader>
                <DialogTitle>Event Clip</DialogTitle>
            </DialogHeader>
             <div className="aspect-video bg-black flex items-center justify-center text-white">
                <Video className="w-16 h-16 text-muted-foreground"/>
                <p className="absolute bottom-4">Video player placeholder</p>
             </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="p-4 flex-grow">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <Video className="h-4 w-4 shrink-0" />
          <p className="font-medium truncate">{event.camera}</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 shrink-0" />
          <p className="truncate">{formatDistanceToNow(new Date(event.start_time), { addSuffix: true })}</p>
        </div>
         <div className="flex items-start gap-2 text-sm text-muted-foreground mt-2">
          <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
          <div className="flex flex-wrap gap-1">
            {event.zones.map(zone => (
                <Badge key={zone} variant="secondary" className="capitalize">{zone.replace('_', ' ')}</Badge>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="p-4 pt-0">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full" onClick={() => !analysis && handleAnalysis()}>
              {isAnalyzing ? (
                 <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                 <Bot className="mr-2 h-4 w-4" />
              )}
              {analysis ? 'View Analysis' : 'Analyze'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="grid gap-4">
              <div className="space-y-2">
                <h4 className="font-headline font-medium leading-none">AI Analysis</h4>
                <p className="text-sm text-muted-foreground">
                  Event categorized by AI based on predefined rules.
                </p>
              </div>
              {analysis ? (
                <div className="grid gap-2 text-sm">
                  <div className="flex items-center">
                    <strong className="w-20">Category:</strong> 
                    <span>{analysis.category}</span>
                  </div>
                  <div className="flex items-center">
                    <strong className="w-20">Priority:</strong> 
                     <Badge className={cn("capitalize", priorityColors[analysis.priority])}>
                        {analysis.priority}
                    </Badge>
                  </div>
                   <div className="flex items-start">
                    <strong className="w-20 shrink-0">Reason:</strong> 
                    <span className="flex-1">{analysis.reason}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground py-4">
                    Click 'Analyze' to process this event.
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </CardFooter>
    </Card>
  );
};

export default EventCard;
