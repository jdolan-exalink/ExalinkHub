"use client";

import { useState, useMemo } from 'react';
import { Check, ChevronsUpDown, Search, Server, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Camera as CameraType } from '@/lib/types';

/**
 * Componente para seleccionar cámaras organizadas por servidor
 * Incluye búsqueda y estructura jerárquica
 *
 * @param cameras - Lista de cámaras disponibles con información de servidor
 * @param value - ID de la cámara seleccionada actualmente
 * @param onValueChange - Función callback cuando cambia la selección
 * @param placeholder - Texto placeholder para el selector
 * @param className - Clases CSS adicionales
 */
interface CameraTreeSelectorProps {
  cameras: CameraType[];
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function CameraTreeSelector({
  cameras,
  value,
  onValueChange,
  placeholder = "Seleccionar cámara...",
  className
}: CameraTreeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Agrupar cámaras por servidor
  const camerasByServer = useMemo(() => {
    const grouped: Record<string, { server: string; server_id: string; cameras: CameraType[] }> = {};

    cameras.forEach(camera => {
      const serverKey = String(camera.server_id || camera.server || 'unknown');
      if (!grouped[serverKey]) {
        grouped[serverKey] = {
          server: camera.server_name || camera.server || 'Servidor desconocido',
          server_id: serverKey,
          cameras: []
        };
      }
      grouped[serverKey].cameras.push(camera);
    });

    // Ordenar servidores alfabéticamente
    return Object.values(grouped).sort((a, b) => a.server.localeCompare(b.server));
  }, [cameras]);

  // Filtrar cámaras basado en la búsqueda
  const filteredCamerasByServer = useMemo(() => {
    if (!searchQuery.trim()) return camerasByServer;

    const query = searchQuery.toLowerCase();
    return camerasByServer
      .map(serverGroup => ({
        ...serverGroup,
        cameras: serverGroup.cameras.filter(camera =>
          camera.name.toLowerCase().includes(query) ||
          serverGroup.server.toLowerCase().includes(query)
        )
      }))
      .filter(serverGroup => serverGroup.cameras.length > 0);
  }, [camerasByServer, searchQuery]);

  // Encontrar la cámara seleccionada (excluyendo offline)
  const selectedCamera = cameras.find(camera => (camera.id || camera.name) === value && !camera.offline);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-48 h-9 justify-between bg-blue-600 border-blue-500 text-white font-medium hover:bg-blue-700",
            className
          )}
        >
          {selectedCamera ? (
            <div className="flex items-center gap-2 truncate">
              <Camera className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{selectedCamera.name}</span>
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-gray-800 border-gray-600" align="start">
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar cámaras o servidores..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
            />
          </div>
        </div>
        <ScrollArea className="h-64">
          <div className="p-1">
            {filteredCamerasByServer.length === 0 ? (
              <div className="text-gray-400 py-6 text-center text-sm">
                No se encontraron cámaras.
              </div>
            ) : (
              filteredCamerasByServer.map((serverGroup) => (
                <div key={serverGroup.server_id} className="mb-2">
                  <div className="flex items-center gap-2 text-gray-300 font-medium text-xs uppercase tracking-wide px-2 py-1 bg-gray-700/50 rounded">
                    <Server className="h-3 w-3" />
                    {serverGroup.server}
                  </div>
                  <div className="ml-2 mt-1 space-y-1">
                    {serverGroup.cameras.map((camera) => (
                      <button
                        key={camera.id || camera.name}
                        onClick={() => {
                          // No permitir selección de cámaras offline
                          if (camera.offline) return;
                          onValueChange(camera.id || camera.name);
                          setOpen(false);
                          setSearchQuery("");
                        }}
                        className={cn(
                          "flex items-center gap-2 w-full px-2 py-1.5 text-left cursor-pointer rounded-sm transition-colors",
                          camera.offline
                            ? "text-gray-500 cursor-not-allowed opacity-60"
                            : "text-white hover:bg-blue-600",
                          value === (camera.id || camera.name) && !camera.offline && "bg-blue-600"
                        )}
                        disabled={camera.offline}
                      >
                        <Camera className={cn(
                          "h-4 w-4 flex-shrink-0",
                          camera.offline ? "text-gray-500" : "text-gray-400"
                        )} />
                        <span className="truncate flex-1">{camera.name}</span>
                        {camera.offline && (
                          <span className="text-xs text-gray-500 flex-shrink-0">(Offline)</span>
                        )}
                        {value === (camera.id || camera.name) && !camera.offline && (
                          <Check className="h-4 w-4 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}