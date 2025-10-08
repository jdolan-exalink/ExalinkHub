"use client";

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Save, Trash2, Grid, Play, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

type Camera = {
  id: string;
  name: string;
  enabled: boolean;
  server_id?: string | number;
  server_name?: string;
};

type GridCell = {
  id: number;
  camera: Camera | null;
};

type SavedView = {
  id: number;
  name: string;
  layout: string;
  cameras: Array<{position: number, camera_id: string | null}>;
  created_at: string;
  icon?: string;
};

type LayoutManagerProps = {
  children: React.ReactNode;
  current_layout: string;
  current_cameras: GridCell[];
  on_layout_change?: (layout: string) => void;
  on_save_view?: (name: string) => void;
  on_load_view?: (view: SavedView) => void;
};

// Presets de grilla estándar VMS
const grid_presets = [
  { value: '1x1', label: '1', description: 'Single / Full Screen', cells: 1 },
  { value: '2x2', label: '4', description: 'Quad View', cells: 4 },
  { value: '1+5', label: '1+5', description: 'Mosaic: 1 Large + 5 Small', cells: 6 },
  { value: '3x3', label: '9', description: 'Multi-tile 3×3', cells: 9 },
  { value: '1+12', label: '1+12', description: 'Mosaic: 1 Large + 12 Small', cells: 13 },
  { value: '4x4', label: '16', description: 'Multi-tile 4×4', cells: 16 },
  { value: '5x5', label: '25', description: 'Multi-tile 5×5', cells: 25 },
  { value: '6x6', label: '36', description: 'Multi-tile 6×6', cells: 36 },
];

/**
 * Obtener el número de celdas que soporta un layout
 */
function get_grid_size(layout: string): number {
  const preset = grid_presets.find(p => p.value === layout);
  return preset ? preset.cells : 1;
}

export default function LayoutManager({ 
  children, 
  current_layout, 
  current_cameras, 
  on_layout_change,
  on_save_view,
  on_load_view
}: LayoutManagerProps) {
  const [is_open, set_is_open] = useState(false);
  const [saved_views, set_saved_views] = useState<SavedView[]>([]);
  const [loading_views, set_loading_views] = useState(false);
  const [new_view_name, set_new_view_name] = useState('');
  const [saving_view, set_saving_view] = useState(false);
  const [view_to_delete, set_view_to_delete] = useState<SavedView | null>(null);
  const [editing_view, set_editing_view] = useState<SavedView | null>(null);
  const [edit_name, set_edit_name] = useState('');
  const [edit_icon, set_edit_icon] = useState('');
  const [edit_layout, set_edit_layout] = useState('');

  const active_cameras_count = current_cameras.filter(cell => cell.camera !== null).length;
  const current_preset = grid_presets.find(preset => preset.value === current_layout);

  /**
   * Cargar vistas guardadas desde la API
   */
  const load_saved_views = async () => {
    set_loading_views(true);
    try {
      const response = await fetch('/api/views');
      if (response.ok) {
        const views = await response.json();
        set_saved_views(views);
      }
    } catch (error) {
      console.error('Error loading saved views:', error);
    } finally {
      set_loading_views(false);
    }
  };

  /**
   * Guardar vista actual
   */
  const handle_save_view = async () => {
    if (!new_view_name.trim()) return;
    
    set_saving_view(true);
    try {
      const response = await fetch('/api/views', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: new_view_name.trim(),
          layout: current_layout,
          cameras: current_cameras.map((cell, index) => ({
            position: index,
            camera_id: cell.camera?.id || null
          }))
        }),
      });

      if (response.ok) {
        set_new_view_name('');
        await load_saved_views();
        
        // Notificar éxito
        const view_saved_event = new CustomEvent('viewSaved');
        window.dispatchEvent(view_saved_event);
      }
    } catch (error) {
      console.error('Error saving view:', error);
    } finally {
      set_saving_view(false);
    }
  };

  /**
   * Cargar vista guardada
   */
  const handle_load_view = (view: SavedView) => {
    if (on_load_view) {
      on_load_view(view);
    }
    
    // Emitir evento para componentes que escuchan
    const load_view_event = new CustomEvent('loadSavedView', { 
      detail: view 
    });
    window.dispatchEvent(load_view_event);
    
    set_is_open(false);
  };

  /**
   * Editar vista guardada
   */
  const handle_edit_view = async () => {
    if (!editing_view || !edit_name.trim()) return;
    
    // Adjust cameras for new layout
    const new_layout_size = get_grid_size(edit_layout);
    const adjusted_cameras = Array.from({ length: new_layout_size }, (_, index) => {
      const existing = editing_view.cameras.find(c => c.position === index);
      return {
        position: index,
        camera_id: existing?.camera_id || null
      };
    });
    
    try {
      const response = await fetch(`/api/views/${editing_view.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: edit_name.trim(),
          layout: edit_layout,
          icon: edit_icon,
          cameras: adjusted_cameras
        }),
      });

      if (response.ok) {
        set_editing_view(null);
        set_edit_name('');
        set_edit_icon('');
        set_edit_layout('');
        await load_saved_views();
      }
    } catch (error) {
      console.error('Error updating view:', error);
    }
  };

  /**
   * Eliminar vista guardada
   */
  const handle_delete_view = async (view: SavedView) => {
    try {
      const response = await fetch(`/api/views/${view.id}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        await load_saved_views();
      }
    } catch (error) {
      console.error('Error deleting view:', error);
    } finally {
      set_view_to_delete(null);
    }
  };
  const handle_layout_change = (layout: string) => {
    if (on_layout_change) {
      on_layout_change(layout);
    }
    
    // Emitir evento para componentes que escuchan
    const layout_change_event = new CustomEvent('layoutChange', { 
      detail: { layout } 
    });
    window.dispatchEvent(layout_change_event);
  };

  // Cargar vistas guardadas al abrir
  useEffect(() => {
    if (is_open) {
      load_saved_views();
    }
  }, [is_open]);

  return (
    <>
      <Dialog open={is_open} onOpenChange={set_is_open}>
        <DialogTrigger asChild>
          {children}
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Layout Manager
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[70vh]">
            {/* Presets de Grilla */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Grid className="h-4 w-4" />
                  Presets de Grilla
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[50vh]">
                  <div className="grid grid-cols-2 gap-3">
                    {grid_presets.map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => handle_layout_change(preset.value)}
                        className={`relative border rounded-lg p-3 text-center transition-all ${
                          current_layout === preset.value 
                            ? 'bg-primary/10 border-primary shadow-md' 
                            : 'hover:bg-muted/50 hover:border-muted-foreground/30'
                        }`}
                      >
                        {current_layout === preset.value && (
                          <div className="absolute -top-1 -right-1">
                            <Badge variant="default" className="text-xs px-1 py-0">Actual</Badge>
                          </div>
                        )}
                        <div className="text-xl font-bold mb-1">{preset.label}</div>
                        <div className="text-xs font-medium mb-1">{preset.description}</div>
                        <div className="text-xs text-muted-foreground">
                          {preset.cells} {preset.cells === 1 ? 'celda' : 'celdas'}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Vistas Guardadas */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Vistas Guardadas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Guardar Vista Actual */}
                <div className="space-y-2">
                  <Label htmlFor="view-name">Guardar vista actual</Label>
                  <div className="flex gap-2">
                    <Input
                      id="view-name"
                      placeholder="Nombre de la vista..."
                      value={new_view_name}
                      onChange={(e) => set_new_view_name(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && new_view_name.trim()) {
                          handle_save_view();
                        }
                      }}
                    />
                    <Button 
                      onClick={handle_save_view}
                      disabled={!new_view_name.trim() || saving_view}
                      size="sm"
                    >
                      {saving_view ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {current_preset?.description} • {active_cameras_count} cámaras asignadas
                  </p>
                </div>

                <Separator />

                {/* Lista de Vistas Guardadas */}
                <ScrollArea className="h-[35vh]">
                  {loading_views ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    </div>
                  ) : saved_views.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Save className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No hay vistas guardadas</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {saved_views.map((view) => (
                        <div
                          key={view.id}
                          className="border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{view.name}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {grid_presets.find(p => p.value === view.layout)?.label || view.layout}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {Array.isArray(view.cameras) ? view.cameras.filter((c: any) => c.camera_id).length : 0} cámaras
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handle_load_view(view)}
                                className="h-8 w-8 p-0"
                              >
                                <Play className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  set_editing_view(view);
                                  set_edit_name(view.name);
                                  set_edit_icon(view.icon || 'Grid');
                                  set_edit_layout(view.layout);
                                }}
                                className="h-8 w-8 p-0"
                              >
                                <Settings className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => set_view_to_delete(view)}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación para eliminar */}
      <AlertDialog open={!!view_to_delete} onOpenChange={() => set_view_to_delete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar vista?</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que quieres eliminar la vista "{view_to_delete?.name}"? 
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => view_to_delete && handle_delete_view(view_to_delete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para editar vista */}
      <Dialog open={!!editing_view} onOpenChange={() => set_editing_view(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Vista</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nombre</Label>
              <Input
                id="edit-name"
                value={edit_name}
                onChange={(e) => set_edit_name(e.target.value)}
                placeholder="Nombre de la vista"
              />
            </div>
            <div>
              <Label htmlFor="edit-icon">Icono</Label>
              <Select value={edit_icon} onValueChange={set_edit_icon}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar icono" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Grid">Grid</SelectItem>
                  <SelectItem value="Monitor">Monitor</SelectItem>
                  <SelectItem value="Camera">Camera</SelectItem>
                  <SelectItem value="Eye">Eye</SelectItem>
                  <SelectItem value="Layout">Layout</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-layout">Layout</Label>
              <Select value={edit_layout} onValueChange={set_edit_layout}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar layout" />
                </SelectTrigger>
                <SelectContent>
                  {grid_presets.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label} - {preset.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => set_editing_view(null)}>
              Cancelar
            </Button>
            <Button onClick={handle_edit_view} disabled={!edit_name.trim()}>
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}