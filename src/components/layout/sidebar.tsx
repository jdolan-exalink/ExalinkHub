"use client";

import { useState, useEffect } from 'react';
import { Sidebar, SidebarContent, SidebarHeader, SidebarInput, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Server, Video, Search, Grid, Circle, AlertTriangle, MoreHorizontal, Edit, Trash2, Plus } from 'lucide-react';
import { fetchFrigateData, DEFAULT_SERVER } from '@/lib/frigate-data';
import type { FrigateServer, Camera } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import SaveViewDialog from '@/components/ui/save-view-dialog';
import { cn } from '@/lib/utils';
import { useDraggable } from '@dnd-kit/core';
import { Alert, AlertDescription } from '@/components/ui/alert';

function DraggableCameraItem({ camera, onDoubleClick }: { camera: Camera, onDoubleClick: () => void }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `camera-${camera.id}`,
        data: { camera, from: 'sidebar' },
    });

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Usar función global si está disponible
        if (typeof window !== 'undefined' && (window as any).addCameraToGrid) {
            (window as any).addCameraToGrid(camera);
        } else {
            // Fallback al handler original
            onDoubleClick();
        }
    };

    return (
        <SidebarMenuItem 
            ref={setNodeRef}
            className={cn(
                "transition-all duration-200 group",
                isDragging && "opacity-50 scale-95"
            )}
            {...listeners}
            {...attributes}
        >
            <SidebarMenuButton 
                className={cn(
                    "h-8 cursor-grab hover:bg-sidebar-accent/80 transition-colors",
                    "hover:scale-[1.02] active:scale-95"
                )} 
                asChild
            >
                <div 
                    className="flex w-full items-center gap-2 px-2 py-1 rounded-md select-none"
                    onDoubleClick={handleDoubleClick}
                >
                    <div className={cn(
                        "p-1 rounded bg-primary/10 transition-colors",
                        isDragging && "bg-primary/20"
                    )}>
                        <Video className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm font-medium flex-1">{camera.name}</span>
                    <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="grid grid-cols-2 gap-0.5">
                            <div className="w-0.5 h-0.5 bg-muted-foreground rounded-full"></div>
                            <div className="w-0.5 h-0.5 bg-muted-foreground rounded-full"></div>
                            <div className="w-0.5 h-0.5 bg-muted-foreground rounded-full"></div>
                            <div className="w-0.5 h-0.5 bg-muted-foreground rounded-full"></div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <Circle className={cn("h-2 w-2", 
                            camera.enabled ? "fill-green-500 text-green-500" : "fill-red-500 text-red-500"
                        )} />
                    </div>
                </div>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

export default function AppSidebar({ onCameraDoubleClick }: { onCameraDoubleClick: (camera: Camera) => void }) {
  const [server, setServer] = useState<FrigateServer>(DEFAULT_SERVER);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [savedViews, setSavedViews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [bandwidth, setBandwidth] = useState<string>('0 KB/s');
  const [activeFrames, setActiveFrames] = useState<number>(0);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchFrigateData();
        
        if (data.error) {
          setError(data.error);
          setServer(prev => ({ ...prev, status: 'offline' }));
        } else {
          setCameras(data.cameras);
          setServer(prev => ({ 
            ...prev, 
            status: 'online',
            version: data.server?.version 
          }));
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setServer(prev => ({ ...prev, status: 'offline' }));
      } finally {
        setLoading(false);
      }
    }

    async function loadSavedViews() {
      try {
        const response = await fetch('/api/views');
        if (response.ok) {
          const views = await response.json();
          setSavedViews(views);
        }
      } catch (err) {
        console.error('Error loading saved views:', err);
      }
    }

    loadData();
    loadSavedViews();
    
    // Escuchar evento cuando se guarde una nueva vista
    const handleViewSaved = () => {
      loadSavedViews(); // Recargar la lista de vistas
    };
    
    // Escuchar actualizaciones de ancho de banda y FPS activos
    const handleBandwidthUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      setBandwidth(customEvent.detail.bandwidth);
    };
    
    const handleActiveFramesUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      setActiveFrames(customEvent.detail.count);
    };
    
    window.addEventListener('viewSaved', handleViewSaved);
    window.addEventListener('bandwidthUpdate', handleBandwidthUpdate);
    window.addEventListener('activeFramesUpdate', handleActiveFramesUpdate);
    
    return () => {
      window.removeEventListener('viewSaved', handleViewSaved);
      window.removeEventListener('bandwidthUpdate', handleBandwidthUpdate);
      window.removeEventListener('activeFramesUpdate', handleActiveFramesUpdate);
    };
  }, []);

  const handleLoadView = (view: any) => {
    console.log('Loading view:', view);
    // Crear evento personalizado para comunicación con LiveView
    const loadViewEvent = new CustomEvent('loadSavedView', { 
      detail: view
    });
    window.dispatchEvent(loadViewEvent);
  };

  const handleRenameView = async (view: any) => {
    const newName = window.prompt('Nuevo nombre para la vista:', view.name);
    if (newName && newName.trim() && newName !== view.name) {
      try {
        const response = await fetch(`/api/views/${view.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: newName.trim(),
            layout: view.layout,
            cameras: JSON.parse(view.cameras)
          })
        });
        
        if (response.ok) {
          // Recargar vistas guardadas
          const viewsResponse = await fetch('/api/views');
          if (viewsResponse.ok) {
            const views = await viewsResponse.json();
            setSavedViews(views);
          }
        }
      } catch (err) {
        console.error('Error renaming view:', err);
      }
    }
  };

  const handleSaveView = async (viewName: string) => {
    // Solicitar estado actual del grid al LiveView
    const saveRequestEvent = new CustomEvent('requestSaveView', {
      detail: { name: viewName }
    });
    window.dispatchEvent(saveRequestEvent);
  };

  const handleDeleteView = async (view: any) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar la vista "${view.name}"?`)) {
      try {
        const response = await fetch(`/api/views/${view.id}`, {
          method: 'DELETE'
        });
        
        if (response.ok) {
          // Recargar vistas guardadas
          const viewsResponse = await fetch('/api/views');
          if (viewsResponse.ok) {
            const views = await viewsResponse.json();
            setSavedViews(views);
          }
        }
      } catch (err) {
        console.error('Error deleting view:', err);
      }
    }
  };

  const filteredCameras = cameras.filter(camera =>
    camera.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <SidebarInput 
                placeholder="Search cameras..." 
                className="pl-8" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </SidebarHeader>
      <ScrollArea className="flex-1">
        <SidebarContent>
            {/* System Stats Section */}
            <SidebarGroup>
                <SidebarGroupLabel>Estado del Sistema</SidebarGroupLabel>
                <div className="px-2 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Ancho de banda:</span>
                    <span className="font-medium">{bandwidth}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>FPS Activos:</span>
                    <span className="font-medium">{activeFrames}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Estado:</span>
                    <Badge variant={error ? "destructive" : "default"} className="text-xs pointer-events-none">
                      {error ? "Error" : "ONLINE"}
                    </Badge>
                  </div>
                </div>
            </SidebarGroup>

            {/* Servers Section */}
            <SidebarGroup>
                <SidebarGroupLabel>Servers</SidebarGroupLabel>
                
                {error && (
                  <div className="px-2 pb-2">
                    <Alert variant="destructive" className="py-2">
                      <AlertTriangle className="h-3 w-3" />
                      <AlertDescription className="text-xs">
                        {error}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
                
                <Accordion type="multiple" defaultValue={[server.id]} className="w-full">
                    <AccordionItem value={server.id} className="border-none">
                        <AccordionTrigger className="py-2 px-2 hover:bg-sidebar-accent rounded-md">
                            <div className="flex items-center gap-2 text-sm font-medium w-full">
                                <div className="flex items-center gap-2 flex-1">
                                    <Server className="h-4 w-4" />
                                    <span>{server.name}</span>
                                    <Circle className={cn("h-2 w-2", 
                                        server.status === 'online' 
                                            ? "fill-green-500 text-green-500" 
                                            : "fill-red-500 text-red-500"
                                    )} />
                                </div>
                                <Badge variant="secondary">
                                    {loading ? '...' : filteredCameras.length}
                                </Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pl-4">
                            <SidebarMenu>
                                {loading ? (
                                    <p className="px-2 py-1 text-xs text-muted-foreground">Cargando cámaras...</p>
                                ) : filteredCameras.length === 0 ? (
                                    <p className="px-2 py-1 text-xs text-muted-foreground">
                                        {searchTerm ? 'No se encontraron cámaras.' : 'No hay cámaras disponibles.'}
                                    </p>
                                ) : (
                                    filteredCameras.map(camera => (
                                        <DraggableCameraItem 
                                            key={camera.id} 
                                            camera={camera} 
                                            onDoubleClick={() => onCameraDoubleClick(camera)}
                                        />
                                    ))
                                )}
                            </SidebarMenu>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </SidebarGroup>

            {/* Saved Views Section */}
            <SidebarGroup>
                <div className="flex items-center justify-between px-3 py-2">
                    <SidebarGroupLabel>Vistas Guardadas</SidebarGroupLabel>
                    <SaveViewDialog onSave={handleSaveView}>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                            <Plus className="h-3 w-3" />
                        </Button>
                    </SaveViewDialog>
                </div>
                <Accordion type="single" collapsible defaultValue="saved-views">
                    <AccordionItem value="saved-views" className="border-none">
                        <AccordionTrigger className="py-2 px-2 text-sm hover:no-underline hover:bg-sidebar-accent rounded-md">
                            <div className="flex items-center gap-2">
                                <Grid className="h-4 w-4" />
                                <span>Mis Vistas</span>
                                <Badge variant="outline" className="text-xs">
                                    {savedViews.length}
                                </Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pl-4">
                            <SidebarMenu>
                                {savedViews.map((view) => (
                                    <SidebarMenuItem key={view.id}>
                                        <div 
                                            className="flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-sidebar-accent group cursor-pointer transition-colors select-none"
                                            onDoubleClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleLoadView(view);
                                            }}
                                        >
                                            <Grid className="h-4 w-4" />
                                            <span className="flex-1 select-none">
                                                {view.name}
                                            </span>
                                            <Badge variant="outline" className="text-xs">
                                                {view.layout}
                                            </Badge>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                                            <MoreHorizontal className="h-3 w-3" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleLoadView(view)}>
                                                            <Grid className="h-4 w-4 mr-2" />
                                                            Cargar Vista
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleRenameView(view)}>
                                                            <Edit className="h-4 w-4 mr-2" />
                                                            Renombrar
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem 
                                                            onClick={() => handleDeleteView(view)}
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Eliminar
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </SidebarGroup>
        </SidebarContent>
      </ScrollArea>
    </Sidebar>
  );
}
