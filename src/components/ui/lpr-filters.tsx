'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, Search, Filter, Camera, Zap, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { LPRFilters, ServerCamera } from '@/lib/types';

interface LPRFiltersProps {
  filters: LPRFilters;
  onFiltersChange: (filters: LPRFilters) => void;
  onSearch: () => void;
  isLoading?: boolean;
}

export function LPRFilters({ filters, onFiltersChange, onSearch, isLoading = false }: LPRFiltersProps) {
  const [cameras, setCameras] = useState<ServerCamera[]>([]);
  const [loadingCameras, setLoadingCameras] = useState(true);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Cargar lista de cámaras al montar el componente
  useEffect(() => {
    loadCameras();
  }, []);

  const loadCameras = async () => {
    try {
      setLoadingCameras(true);
      const response = await fetch('/api/frigate/cameras?mode=lpr');
      const data = await response.json();
      
      if (data.cameras) {
        setCameras(data.cameras);
      }
    } catch (error) {
      console.error('Error cargando cámaras:', error);
    } finally {
      setLoadingCameras(false);
    }
  };

  // Funciones para actualizar filtros
  const updateFilters = (updates: Partial<LPRFilters>) => {
    onFiltersChange({ ...filters, ...updates });
  };

  const handleCameraToggle = (cameraKey: string, checked: boolean) => {
    const updatedCameras = checked
      ? [...filters.cameras, cameraKey]
      : filters.cameras.filter(c => c !== cameraKey);
    
    updateFilters({ cameras: updatedCameras });
  };

  const handleSelectAllCameras = () => {
    const allCameraKeys = cameras.map(cam => `${cam.serverId}:${cam.cameraName}`);
    updateFilters({ cameras: allCameraKeys });
  };

  const handleClearCameras = () => {
    updateFilters({ cameras: [] });
  };

  // Establecer valores por defecto para hoy
  const setTodayRange = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    updateFilters({
      startDate: todayStr,
      endDate: todayStr,
      startTime: '00:00',
      endTime: '23:59'
    });
  };

  // Agrupar cámaras por servidor
  const camerasByServer = cameras.reduce((acc, camera) => {
    if (!acc[camera.serverName]) {
      acc[camera.serverName] = [];
    }
    acc[camera.serverName].push(camera);
    return acc;
  }, {} as Record<string, ServerCamera[]>);

  return (
    <Card className="w-full mb-6">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros de Búsqueda LPR
          </CardTitle>
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={setTodayRange}
              disabled={isLoading}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Hoy
            </Button>
            
            {/* Selector de Cámaras */}
            <Select
              value={filters.cameras.length === 0 ? 'all' : 'custom'}
              onValueChange={(value) => {
                if (value === 'all') {
                  handleClearCameras();
                } else if (value === 'select-all') {
                  handleSelectAllCameras();
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  <SelectValue placeholder="Cámaras" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las cámaras</SelectItem>
                <SelectItem value="select-all">Seleccionar todas</SelectItem>
                {Object.entries(camerasByServer).map(([serverName, serverCameras]) => (
                  <div key={serverName}>
                    <div className="px-2 py-1 text-sm font-semibold text-gray-700 bg-gray-50">
                      {serverName}
                    </div>
                    {serverCameras.map((camera) => {
                      const cameraKey = `${camera.serverId}:${camera.cameraName}`;
                      const isSelected = filters.cameras.includes(cameraKey);
                      
                      // Skip cameras with empty or invalid keys
                      if (!cameraKey || cameraKey === ':' || !camera.cameraName || !camera.serverId) {
                        return null;
                      }
                      
                      return (
                        <SelectItem 
                          key={cameraKey} 
                          value={cameraKey}
                          onSelect={() => handleCameraToggle(cameraKey, !isSelected)}
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox checked={isSelected} />
                            {camera.cameraName}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </div>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={onSearch}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Search className="h-4 w-4 mr-2" />
              )}
              Buscar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Rango de Fecha y Hora */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="startDate" className="text-sm font-medium">
              Fecha Inicio
            </Label>
            <Input
              id="startDate"
              type="date"
              value={filters.startDate}
              onChange={(e) => updateFilters({ startDate: e.target.value })}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="startTime" className="text-sm font-medium">
              Hora Inicio
            </Label>
            <Input
              id="startTime"
              type="time"
              value={filters.startTime}
              onChange={(e) => updateFilters({ startTime: e.target.value })}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="endDate" className="text-sm font-medium">
              Fecha Fin
            </Label>
            <Input
              id="endDate"
              type="date"
              value={filters.endDate}
              onChange={(e) => updateFilters({ endDate: e.target.value })}
              className="mt-1"
            />
          </div>
          
          <div>
            <Label htmlFor="endTime" className="text-sm font-medium">
              Hora Fin
            </Label>
            <Input
              id="endTime"
              type="time"
              value={filters.endTime}
              onChange={(e) => updateFilters({ endTime: e.target.value })}
              className="mt-1"
            />
          </div>
        </div>

        {/* Búsqueda por Matrícula */}
        <div>
          <Label htmlFor="plateSearch" className="text-sm font-medium">
            Buscar Matrícula
          </Label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
            <Input
              id="plateSearch"
              type="text"
              placeholder="Ej: ABC123, PAT456..."
              value={filters.plateSearch || ''}
              onChange={(e) => updateFilters({ plateSearch: e.target.value })}
              className="pl-10"
            />
          </div>
        </div>

        {/* Filtros Avanzados */}
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto">
              <span className="text-sm font-medium">Filtros Avanzados</span>
              <Filter className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Confianza Mínima */}
              <div>
                <Label htmlFor="confidenceMin" className="text-sm font-medium">
                  Confianza Mínima
                </Label>
                <Select
                  value={filters.confidenceMin?.toString() || 'any'}
                  onValueChange={(value) => 
                    updateFilters({ confidenceMin: value && value !== 'any' ? parseFloat(value) : undefined })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Cualquiera" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Cualquiera</SelectItem>
                    <SelectItem value="0.9">Alta (90%+)</SelectItem>
                    <SelectItem value="0.8">Buena (80%+)</SelectItem>
                    <SelectItem value="0.7">Media (70%+)</SelectItem>
                    <SelectItem value="0.5">Baja (50%+)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Velocidad Mínima */}
              <div>
                <Label htmlFor="speedMin" className="text-sm font-medium">
                  Velocidad Mín. (km/h)
                </Label>
                <Input
                  id="speedMin"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={filters.speedMin || ''}
                  onChange={(e) => 
                    updateFilters({ speedMin: e.target.value ? parseInt(e.target.value) : undefined })
                  }
                  className="mt-1"
                />
              </div>

              {/* Velocidad Máxima */}
              <div>
                <Label htmlFor="speedMax" className="text-sm font-medium">
                  Velocidad Máx. (km/h)
                </Label>
                <Input
                  id="speedMax"
                  type="number"
                  min="0"
                  placeholder="120"
                  value={filters.speedMax || ''}
                  onChange={(e) => 
                    updateFilters({ speedMax: e.target.value ? parseInt(e.target.value) : undefined })
                  }
                  className="mt-1"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Resumen de Filtros Activos */}
        {(filters.plateSearch || filters.confidenceMin || filters.speedMin || filters.speedMax) && (
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <span className="text-sm text-gray-500">Filtros activos:</span>
            
            {filters.plateSearch && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Search className="h-3 w-3" />
                Matrícula: {filters.plateSearch}
              </Badge>
            )}
            
            {filters.confidenceMin && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Confianza: {(filters.confidenceMin * 100).toFixed(0)}%+
              </Badge>
            )}
            
            {(filters.speedMin || filters.speedMax) && (
              <Badge variant="secondary">
                Velocidad: {filters.speedMin || 0}-{filters.speedMax || '∞'} km/h
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}