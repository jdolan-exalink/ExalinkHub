"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock, Download } from 'lucide-react';
import { format } from 'date-fns';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCamera: string;
  selectedDate: Date;
  selectedHour: number;
  onExport: (options: ExportOptions) => void;
  onTimelineSelection?: () => void;
}

export interface ExportOptions {
  type: 'last_hour' | 'last_4_hours' | 'last_8_hours' | 'last_12_hours' | 'last_24_hours' | 'timeline_selection' | 'custom';
  name: string;
  startDate?: Date;
  endDate?: Date;
  startTime?: string;
  endTime?: string;
}

export default function ExportModal({
  isOpen,
  onClose,
  selectedCamera,
  selectedDate,
  selectedHour,
  onExport,
  onTimelineSelection
}: ExportModalProps) {
  const [exportType, setExportType] = useState<ExportOptions['type']>('last_hour');
  const [exportName, setExportName] = useState('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');

  const handleExport = () => {
    const options: ExportOptions = {
      type: exportType,
      name: exportName || generateDefaultName(),
      startDate: exportType === 'custom' ? startDate : undefined,
      endDate: exportType === 'custom' ? endDate : undefined,
      startTime: exportType === 'custom' ? startTime : undefined,
      endTime: exportType === 'custom' ? endTime : undefined,
    };
    
    onExport(options);
    onClose();
  };

  const handleTimelineSelection = () => {
    onTimelineSelection?.();
    onClose();
  };

  const generateDefaultName = () => {
    const typeNames = {
      last_hour: 'Ultima_Hora',
      last_4_hours: 'Ultimas_4_Horas',
      last_8_hours: 'Ultimas_8_Horas',
      last_12_hours: 'Ultimas_12_Horas',
      last_24_hours: 'Ultimas_24_Horas',
      timeline_selection: 'Seleccion_Timeline',
      custom: 'Personalizado'
    };
    
    const now = new Date();
    const dateStr = format(now, 'yyyy-MM-dd_HH-mm');
    return `${selectedCamera}_${typeNames[exportType]}_${dateStr}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Exportar
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Type Selection */}
          <RadioGroup value={exportType} onValueChange={(value) => setExportType(value as ExportOptions['type'])}>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="last_hour" id="last_hour" />
                <Label htmlFor="last_hour">Última Hora</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="last_4_hours" id="last_4_hours" />
                <Label htmlFor="last_4_hours">Últimas 4 Horas</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="last_8_hours" id="last_8_hours" />
                <Label htmlFor="last_8_hours">Últimas 8 Horas</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="last_12_hours" id="last_12_hours" />
                <Label htmlFor="last_12_hours">Últimas 12 Horas</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="last_24_hours" id="last_24_hours" />
                <Label htmlFor="last_24_hours">Últimas 24 Horas</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="timeline_selection" id="timeline_selection" />
                <Label htmlFor="timeline_selection">Seleccionar Desde La Línea De Tiempo</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom">Personalizado</Label>
              </div>
            </div>
          </RadioGroup>

          {/* Custom Date Range */}
          {exportType === 'custom' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                {/* Start Date */}
                <div className="space-y-2">
                  <Label>Fecha Inicio</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(startDate, "dd/MM/yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={startDate}
                        onSelect={(date) => date && setStartDate(date)}
                        disabled={(date) => date > new Date()}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* End Date */}
                <div className="space-y-2">
                  <Label>Fecha Fin</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(endDate, "dd/MM/yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={endDate}
                        onSelect={(date) => date && setEndDate(date)}
                        disabled={(date) => date > new Date() || date < startDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Start Time */}
                <div className="space-y-2">
                  <Label>Hora Inicio</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* End Time */}
                <div className="space-y-2">
                  <Label>Hora Fin</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Export Name */}
          <div className="space-y-2">
            <Label htmlFor="export-name">Nombrar la exportación</Label>
            <Input
              id="export-name"
              type="text"
              placeholder={generateDefaultName()}
              value={exportName}
              onChange={(e) => setExportName(e.target.value)}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            
            {exportType === 'timeline_selection' ? (
              <Button onClick={handleTimelineSelection} className="bg-blue-600 hover:bg-blue-700">
                Seleccionar
              </Button>
            ) : (
              <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700">
                Exportar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}