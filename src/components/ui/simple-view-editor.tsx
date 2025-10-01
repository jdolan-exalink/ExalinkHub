"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Trash2, Save, Grid3X3, Eye, Plus, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

type SavedView = {
  id: number;
  name: string;
  layout: string;
  cameras: Array<{ position: number; camera_id: string | null }>;
  created_at: string;
  updated_at: string;
};

type SimpleViewEditorProps = {
  children: React.ReactNode;
  currentLayout: string;
  currentCameras: Array<{ id: number; camera: any | null }>;
  onSaveView: (viewName: string) => void;
};

// Presets de grilla estándar VMS
const gridPresets = [
  { value: '1x1', label: '1', description: 'Single / Full Screen', cells: 1 },
  { value: '2x2', label: '4', description: 'Quad View', cells: 4 },
  { value: '3x3', label: '9', description: 'Multi-tile 3×3', cells: 9 },
  { value: '4x4', label: '16', description: 'Multi-tile 4×4', cells: 16 },
  { value: '5x5', label: '25', description: 'Multi-tile 5×5', cells: 25 },
  { value: '6x6', label: '36', description: 'Multi-tile 6×6', cells: 36 },
];

export default function SimpleViewEditor({ children, currentLayout, currentCameras, onSaveView }: SimpleViewEditorProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const [newViewName, setNewViewName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Cargar vistas guardadas
  const loadSavedViews = async () => {
    try {
      const response = await fetch('/api/views');
      if (response.ok) {
        const views = await response.json();
        setSavedViews(views);
      }
    } catch (error) {
      console.error('Error loading saved views:', error);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSavedViews();
    }
  }, [isOpen]);

  const handleSaveCurrentView = async () => {
    if (!newViewName.trim()) {
      toast({
        title: "Nombre requerido",
        description: "Ingresa un nombre para guardar la vista.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      await onSaveView(newViewName.trim());
      setNewViewName('');
      await loadSavedViews();
      toast({
        title: "Vista guardada",
        description: `Layout "${newViewName}" guardado exitosamente.`
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar la vista.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteView = async (viewId: number, viewName: string) => {
    try {
      const response = await fetch(`/api/views/${viewId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadSavedViews();
        toast({
          title: "Vista eliminada",
          description: `"${viewName}" eliminada exitosamente.`
        });
      } else {
        throw new Error('Failed to delete view');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar la vista.",
        variant: "destructive"
      });
    }
  };

  const handleLoadView = (view: SavedView) => {
    const loadEvent = new CustomEvent('loadSavedView', {
      detail: view
    });
    window.dispatchEvent(loadEvent);
    setIsOpen(false);
    
    toast({
      title: "Vista cargada",
      description: `Layout "${view.name}" aplicado.`
    });
  };

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
          {/* Guardar Vista Actual */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Save className="h-4 w-4" />
                Guardar Layout Actual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Grid:</span>
                  <Badge variant="outline">{currentPreset?.label} celdas</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Cámaras:</span>
                  <Badge variant="secondary">{activeCamerasCount}</Badge>
                </div>
              </div>
              
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre del layout (ej: Entrada Principal)"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isLoading) {
                      handleSaveCurrentView();
                    }
                  }}
                />
                <Button 
                  onClick={handleSaveCurrentView} 
                  disabled={isLoading || !newViewName.trim()}
                  className="flex-shrink-0"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Guardar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Vistas Guardadas */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Layouts Guardados</CardTitle>
            </CardHeader>
            <CardContent>
              {savedViews.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <Grid3X3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay layouts guardados</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {savedViews.map((view) => {
                    const cameras = Array.isArray(view.cameras) ? view.cameras : JSON.parse(view.cameras || '[]');
                    const preset = gridPresets.find(p => p.value === view.layout);
                    
                    return (
                      <div
                        key={view.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{view.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {preset?.label} celdas
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {cameras.length} cámaras
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {preset?.description} • {new Date(view.created_at).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                        <div className="flex gap-1 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleLoadView(view)}
                            className="h-8 px-3"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Cargar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteView(view.id, view.name)}
                            className="h-8 px-2 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

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