"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Clock, Download } from 'lucide-react';
import { format } from 'date-fns';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCamera: string;
  selectedDate: Date;
  selectedHour: number;
  selectedTimestamp?: number | null;
  onExport: (options: ExportOptions) => void;
  onTimelineSelection?: () => void;
}

export interface ExportOptions {
  type: 'next_30_minutes' | 'next_hour' | 'timeline_selection' | 'custom';
  name: string;
  startTime?: string;
  endTime?: string;
}

export default function ExportModal({
  isOpen,
  onClose,
  selectedCamera,
  selectedDate,
  selectedHour,
  selectedTimestamp,
  onExport,
  onTimelineSelection
}: ExportModalProps) {
  const [exportType, setExportType] = useState<ExportOptions['type']>('next_30_minutes');
  const [exportName, setExportName] = useState('');
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');

  useEffect(() => {
    if (isOpen) {
      setExportType('next_30_minutes');
      setExportName('');
      setStartTime('00:00');
      setEndTime('23:59');
    }
  }, [isOpen]);

  const handleExport = () => {
    if (exportType === 'custom' && !validateCustomRange()) {
      return;
    }

    const options: ExportOptions = {
      type: exportType,
      name: exportName || generateDefaultName(),
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

  const validateCustomRange = () => {
    if (!startTime || !endTime) {
      alert('Debes ingresar hora de inicio y fin.');
      return false;
    }

    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const startDateTime = new Date(selectedDate);
    startDateTime.setHours(startHour, startMinute, 0, 0);

    const endDateTime = new Date(selectedDate);
    endDateTime.setHours(endHour, endMinute, 0, 0);

    if (endDateTime <= startDateTime) {
      alert('La hora final debe ser posterior a la hora de inicio.');
      return false;
    }

    const now_date = new Date();
    if (endDateTime.getTime() > now_date.getTime()) {
      alert('La hora final no puede superar la hora actual.');
      return false;
    }

    return true;
  };

  const referenceTimestamp = useMemo(() => {
    if (typeof selectedTimestamp === 'number' && !Number.isNaN(selectedTimestamp)) {
      return selectedTimestamp;
    }

    const baseDate = new Date(selectedDate);
    const midnight = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    const baseTimestamp = Math.floor(midnight.getTime() / 1000);
    return baseTimestamp + (selectedHour * 3600);
  }, [selectedDate, selectedHour, selectedTimestamp]);

  const referenceDate = new Date(referenceTimestamp * 1000);
  const referenceLabel = format(referenceDate, 'dd/MM/yyyy HH:mm:ss');
  const nowDate = new Date();
  const isReferenceFuture = referenceDate.getTime() > nowDate.getTime();
  const isSameDayAsToday = selectedDate.toDateString() === nowDate.toDateString();
  const customMaxTime = isSameDayAsToday ? format(nowDate, 'HH:mm') : '23:59';

  const generateDefaultName = () => {
    const typeNames: Record<ExportOptions['type'], string> = {
      next_30_minutes: 'Proximos_30_Minutos',
      next_hour: 'Proxima_Hora',
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
                <RadioGroupItem value="next_30_minutes" id="next_30_minutes" />
                <Label htmlFor="next_30_minutes">30 minutos siguientes</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="next_hour" id="next_hour" />
                <Label htmlFor="next_hour">1 hora siguiente</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="timeline_selection" id="timeline_selection" />
                <Label htmlFor="timeline_selection">Seleccionar desde la línea de tiempo</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom">Personalizado</Label>
              </div>
            </div>
          </RadioGroup>

          <div className="p-3 bg-gray-50 rounded border text-xs text-gray-600">
            {isReferenceFuture ? (
              <span>La hora seleccionada supera el tiempo actual. Se usara la hora actual como referencia.</span>
            ) : (
              <span>Se tomara como referencia: <strong>{referenceLabel}</strong></span>
            )}
          </div>

          {/* Custom Date Range */}
          {exportType === 'custom' && (
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-600">
                Selecciona un rango horario dentro del <strong>{format(selectedDate, 'dd/MM/yyyy')}</strong>.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hora inicio</Label>
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

                <div className="space-y-2">
                  <Label>Hora fin</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      max={customMaxTime}
                      className="pl-10"
                    />
                    <span className="absolute right-3 top-3 text-[10px] text-gray-400">
                      Max: {customMaxTime}
                    </span>
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





