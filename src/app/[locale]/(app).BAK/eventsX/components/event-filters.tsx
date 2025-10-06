"use client";

import type { FC } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Camera as CameraIcon, Tag } from 'lucide-react';
import type { Camera } from '@/lib/types';

type EventFiltersProps = {
  cameras: Camera[];
  labels: string[];
  onCameraChange: (value: string) => void;
  onLabelChange: (value: string) => void;
};

const EventFilters: FC<EventFiltersProps> = ({ cameras, labels, onCameraChange, onLabelChange }) => {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="flex items-center gap-2">
        <CameraIcon className="h-4 w-4 text-muted-foreground" />
        <Select defaultValue="all" onValueChange={onCameraChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Select Camera" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cameras</SelectItem>
            {cameras.map(camera => (
              <SelectItem key={camera.id} value={camera.name}>
                {camera.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Tag className="h-4 w-4 text-muted-foreground" />
        <Select defaultValue="all" onValueChange={onLabelChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Select Label" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Labels</SelectItem>
            {labels.map(label => (
              <SelectItem key={label} value={label} className="capitalize">
                {label.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default EventFilters;
