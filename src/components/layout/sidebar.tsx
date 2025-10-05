"use client";

import React, { useState, useCallback, useEffect, useMemo, memo } from 'react'
import { Sidebar, SidebarContent, SidebarHeader, SidebarInput, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Server, Video, Search, Grid, Circle, AlertTriangle, MoreHorizontal, Edit, Trash2, Plus } from 'lucide-react';
import { fetchMultiServerData, DEFAULT_SERVER } from '@/lib/frigate-data';
import type { FrigateServer, Camera } from '@/lib/types';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import SaveViewDialog from '@/components/ui/save-view-dialog';
import { cn } from '@/lib/utils';
import { useDraggable } from '@dnd-kit/core';
import { Alert, AlertDescription } from '@/components/ui/alert';

/**
 * Componente draggable para servidores completos
 * Permite arrastrar un servidor y todas sus cámaras al layout
 * Solo se activa el drag en el área del icono y nombre
 */
function DraggableServerItem({ server, serverCameras, onDoubleClick }: { 
    server: any, 
    serverCameras: Camera[],
    onDoubleClick: () => void
}) {
    const enabledCameras = useMemo(() => serverCameras.filter(cam => cam.enabled), [serverCameras]);
    
    console.log('DraggableServerItem render:', {
        serverName: server.name,
        totalCameras: serverCameras.length,
        enabledCameras: enabledCameras.length,
        enabledCameraNames: enabledCameras.map(c => c.name)
    });
    
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `server-${server.id}`,
        data: { 
            server, 
            cameras: enabledCameras, // Solo cámaras habilitadas
            from: 'sidebar',
            type: 'server'
        },
    });
    
    console.log('DraggableServerItem setup:', {
        id: `server-${server.id}`,
        hasListeners: !!listeners,
        hasAttributes: !!attributes,
        isDragging
    });

    if (isDragging) {
        console.log('Server dragging:', server.name, 'with cameras:', enabledCameras.map(c => c.name));
    }

    // Log when drag starts
    React.useEffect(() => {
        if (isDragging) {
            console.log('=== DRAG STARTED ===');
            console.log('Server:', server.name);
            console.log('Cameras:', enabledCameras.map(c => c.name));
        }
    }, [isDragging]);

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('Double-click on server:', server.name, 'enabled cameras:', enabledCameras.length);
        onDoubleClick();
    };

    const handleClick = (e: React.MouseEvent) => {
        // Prevenir que el click se propague al accordion
        e.stopPropagation();
    };

    return (
        <div className="transition-all duration-200 relative">
            {/* Overlay visual durante drag */}
            {isDragging && (
                <div className="absolute inset-0 bg-blue-500/20 rounded-md border-2 border-blue-500 border-dashed animate-pulse z-10" />
            )}
            
            {/* Badge con número de cámaras durante drag */}
            {isDragging && (
                <div className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow-lg z-20 font-semibold">
                    {enabledCameras.length} cámaras
                </div>
            )}
            
            {/* Área draggable limitada al icono y nombre */}
            <div 
                ref={setNodeRef}
                className={cn(
                    "flex items-center gap-2 flex-1 cursor-grab transition-all duration-200 z-30 pointer-events-auto",
                    isDragging && "opacity-30 scale-95 rotate-1 shadow-lg z-50"
                )}
                {...listeners}
                {...attributes}
                onDoubleClick={handleDoubleClick}
                onClick={handleClick}
            >
                <Server className="h-4 w-4" />
                <span>{server.name}</span>
                <Circle className={cn("h-2 w-2", 
                    ((server.status as any)?.api_status === 'online' || server.status === 'online')
                        ? "fill-green-500 text-green-500" 
                        : "fill-red-500 text-red-500"
                )} />
            </div>
        </div>
    );
}

/**
 * Componente draggable para cámaras individuales
 * Permite arrastrar una cámara específica al layout
 * Solo se activa el drag en el área del icono y nombre
 */
function DraggableCameraItem({ camera, onDoubleClick }: { camera: Camera, onDoubleClick: () => void }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `camera-${camera.id}`,
        data: { 
            camera, 
            from: 'sidebar',
            type: 'camera'
        },
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
        <SidebarMenuItem className={cn(
            "transition-all duration-200 group relative",
            isDragging && "opacity-30 scale-95 rotate-2 shadow-lg z-50"
        )}>
            {/* Overlay visual durante drag */}
            {isDragging && (
                <div className="absolute inset-0 bg-primary/20 rounded-md border-2 border-primary border-dashed animate-pulse z-10" />
            )}
            
            {/* Badge indicando tipo de drag */}
            {isDragging && (
                <div className="absolute -top-2 -right-2 bg-primary text-white text-xs px-1.5 py-0.5 rounded-full shadow-lg z-20 font-semibold">
                    CAM
                </div>
            )}
            
            <SidebarMenuButton 
                className="h-8 hover:bg-sidebar-accent/80 transition-colors relative z-20"
                asChild
            >
                <div className="flex w-full items-center gap-2 px-2 py-1 rounded-md select-none">
                    {/* Área draggable limitada al icono y nombre */}
                    <div 
                        ref={setNodeRef}
                        className={cn(
                            "flex items-center gap-2 flex-1 cursor-grab transition-colors",
                            "hover:scale-[1.02] active:scale-95",
                            isDragging && "bg-primary/10 border border-primary/50"
                        )}
                        {...listeners}
                        {...attributes}
                        onDoubleClick={handleDoubleClick}
                    >
                        <div className={cn(
                            "p-1 rounded bg-primary/10 transition-colors",
                            isDragging && "bg-primary/20 scale-110"
                        )}>
                            <Video className={cn("h-3 w-3 text-primary", isDragging && "animate-bounce")} />
                        </div>
                        <span className={cn(
                            "text-sm font-medium flex-1",
                            isDragging && "text-primary font-semibold"
                        )}>
                            {camera.name}
                        </span>
                    </div>
                    
                    {/* Área no draggable para los iconos de la derecha */}
                    <div className="flex items-center gap-1">
                        <div className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="grid grid-cols-2 gap-0.5">
                                <div className="w-0.5 h-0.5 bg-muted-foreground rounded-full"></div>
                                <div className="w-0.5 h-0.5 bg-muted-foreground rounded-full"></div>
                                <div className="w-0.5 h-0.5 bg-muted-foreground rounded-full"></div>
                                <div className="w-0.5 h-0.5 bg-muted-foreground rounded-full"></div>
                            </div>
                        </div>
                        <Circle className={cn("h-2 w-2", 
                            camera.enabled ? "fill-green-500 text-green-500" : "fill-red-500 text-red-500",
                            isDragging && "animate-pulse"
                        )} />
                    </div>
                </div>
            </SidebarMenuButton>
        </SidebarMenuItem>
    );
}

/**
 * Componente memo para renderizar un servidor de manera estable
 */
const ServerAccordionItem = memo(({ 
    server, 
    serverCameras, 
    searchTerm, 
    loading, 
    onCameraDoubleClick 
}: {
    server: any;
    serverCameras: Camera[];
    searchTerm: string;
    loading: boolean;
    onCameraDoubleClick: (camera: Camera) => void;
}) => {
    const handleServerDoubleClick = useCallback(() => {
        console.log('Server double-click handler called for:', server.name);
        // Agregar todas las cámaras habilitadas del servidor al grid
        const enabledCameras = serverCameras.filter(cam => cam.enabled);
        console.log('Enabled cameras found:', enabledCameras.length, enabledCameras.map(c => c.name));
        if (enabledCameras.length > 0) {
            // Disparar evento para agregar múltiples cámaras
            const addServerEvent = new CustomEvent('addServerToGrid', {
                detail: { server, cameras: enabledCameras }
            });
            console.log('Dispatching addServerToGrid event:', addServerEvent.detail);
            window.dispatchEvent(addServerEvent);
        } else {
            console.log('No enabled cameras found for server:', server.name);
        }
    }, [server.id, serverCameras]);

    const serverFilteredCameras = useMemo(() => 
        serverCameras.filter(camera =>
            camera.name.toLowerCase().includes(searchTerm.toLowerCase())
        ), [serverCameras, searchTerm]
    );

    return (
        <AccordionItem key={server.id} value={server.id} className="border-none">
            <AccordionTrigger className="py-2 px-2 hover:bg-sidebar-accent rounded-md">
                <div className="flex items-center gap-2 text-sm font-medium w-full pointer-events-none">
                    <DraggableServerItem 
                        server={server} 
                        serverCameras={serverCameras}
                        onDoubleClick={handleServerDoubleClick}
                    />
                    <div className="pointer-events-auto">
                        <Badge variant="secondary">
                            {loading ? '...' : serverFilteredCameras.length}
                        </Badge>
                    </div>
                </div>
            </AccordionTrigger>
            <AccordionContent className="pl-4">
                <SidebarMenu>
                    {loading ? (
                        <p className="px-2 py-1 text-xs text-muted-foreground">Cargando cámaras...</p>
                    ) : serverFilteredCameras.length === 0 ? (
                        <p className="px-2 py-1 text-xs text-muted-foreground">
                            {searchTerm ? 'No se encontraron cámaras.' : 'No hay cámaras disponibles.'}
                        </p>
                    ) : (
                        serverFilteredCameras.map(camera => (
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
    );
});

ServerAccordionItem.displayName = 'ServerAccordionItem';

export default function AppSidebar({ onCameraDoubleClick }: { onCameraDoubleClick: (camera: Camera) => void }) {
  console.log('🟡 SIDEBAR COMPONENT RENDERING');
  
  const [servers, setServers] = useState<FrigateServer[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [savedViews, setSavedViews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [bandwidth, setBandwidth] = useState<string>('0 KB/s');
  const [activeFrames, setActiveFrames] = useState<number>(0);

  // Estabilizar event handlers para window events
  const handleViewSaved = useCallback(() => {
    // Recargar la lista de vistas
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
    loadSavedViews();
  }, []);

  const handleBandwidthUpdate = useCallback((event: Event) => {
    const customEvent = event as CustomEvent;
    setBandwidth(customEvent.detail.bandwidth);
  }, []);

  const handleActiveFramesUpdate = useCallback((event: Event) => {
    const customEvent = event as CustomEvent;
    setActiveFrames(customEvent.detail.count);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        const data = await fetchMultiServerData();
        
        if (data.error) {
          setError(data.error);
          setServers(data.servers || []);
        } else {
          setServers(data.servers || []);
          setCameras(data.cameras || []);
          setError(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
        setServers([]);
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
    
    // Los event handlers ya están estabilizados con useCallback
    window.addEventListener('viewSaved', handleViewSaved);
    window.addEventListener('bandwidthUpdate', handleBandwidthUpdate);
    window.addEventListener('activeFramesUpdate', handleActiveFramesUpdate);
    
    return () => {
      window.removeEventListener('viewSaved', handleViewSaved);
      window.removeEventListener('bandwidthUpdate', handleBandwidthUpdate);
      window.removeEventListener('activeFramesUpdate', handleActiveFramesUpdate);
    };
  }, [handleViewSaved, handleBandwidthUpdate, handleActiveFramesUpdate]);

  const handleLoadView = useCallback((view: any) => {
    console.log('Loading view:', view);
    // Crear evento personalizado para comunicación con LiveView
    const loadViewEvent = new CustomEvent('loadSavedView', { 
      detail: view
    });
    window.dispatchEvent(loadViewEvent);
  }, []);

  const handleRenameView = useCallback(async (view: any) => {
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
  }, []);

  const handleSaveView = useCallback(async (viewName: string) => {
    // Solicitar estado actual del grid al LiveView
    const saveRequestEvent = new CustomEvent('requestSaveView', {
      detail: { name: viewName }
    });
    window.dispatchEvent(saveRequestEvent);
  }, []);

  const handleDeleteView = useCallback(async (view: any) => {
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
  }, []);

  const filteredCameras = useMemo(() =>
    cameras.filter(camera =>
      camera.name.toLowerCase().includes(searchTerm.toLowerCase())
    ), [cameras, searchTerm]
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
                onChange={handleSearchChange}
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
                
                <Accordion type="multiple" defaultValue={servers.map(s => s.id)} className="w-full">
                    {servers.map(server => {
                        const serverCameras = cameras.filter(camera => 
                            String(camera.server_id) === String(server.id) || camera.server === server.id
                        );
                        
                        return (
                            <ServerAccordionItem
                                key={server.id}
                                server={server}
                                serverCameras={serverCameras}
                                searchTerm={searchTerm}
                                loading={loading}
                                onCameraDoubleClick={onCameraDoubleClick}
                            />
                        );
                    })}
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
