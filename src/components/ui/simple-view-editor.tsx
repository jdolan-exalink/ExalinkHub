"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type SimpleViewEditorProps = {
  children: React.ReactNode;
  currentLayout: string;
  currentCameras: Array<{ id: number; camera: any | null }>;
  onSaveView?: (viewName: string) => Promise<void>;
};

// Presets de grilla estándar VMS
const gridPresets = [
  { value: '1x1', label: '1', description: 'Single / Full Screen', cells: 1 },
  { value: '2x2', label: '4', description: 'Quad View', cells: 4 },
  { value: '1+5', label: '1+5', description: 'Mosaic: 1 Large + 5 Small', cells: 6 },
  { value: '3x3', label: '9', description: 'Multi-tile 3×3', cells: 9 },
  { value: '1+12', label: '1+12', description: 'Mosaic: 1 Large + 12 Small', cells: 13 },
  { value: '4x4', label: '16', description: 'Multi-tile 4×4', cells: 16 },
  { value: '5x5', label: '25', description: 'Multi-tile 5×5', cells: 25 },
  { value: '6x6', label: '36', description: 'Multi-tile 6×6', cells: 36 },
];

export default function SimpleViewEditor({ children, currentLayout, currentCameras }: SimpleViewEditorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const activeCamerasCount = currentCameras.filter(cell => cell.camera !== null).length;
  const currentPreset = gridPresets.find(preset => preset.value === currentLayout);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Layout Manager
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Presets de Grilla */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Presets de Grilla</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {gridPresets.map((preset) => (
                  <div
                    key={preset.value}
                    className={`relative border rounded-lg p-3 text-center transition-colors ${
                      currentLayout === preset.value 
                        ? 'bg-primary/10 border-primary' 
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    {currentLayout === preset.value && (
                      <div className="absolute -top-1 -right-1">
                        <Badge variant="default" className="text-xs px-1 py-0">Actual</Badge>
                      </div>
                    )}
                    <div className="text-2xl font-bold mb-1">{preset.label}</div>
                    <div className="text-xs font-medium">{preset.description}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {preset.cells} {preset.cells === 1 ? 'celda' : 'celdas'}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-xs text-muted-foreground">
                <p>💡 <strong>Tip:</strong> Usa el selector de grid en la barra superior para cambiar entre presets</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}