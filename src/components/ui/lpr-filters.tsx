'use client';

import { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, Search, Filter, Camera, Zap, RefreshCw, ChevronDown, X } from 'lucide-react';
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
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Función para búsqueda con debounce
  const debouncedSearch = useCallback((searchValue: string) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    const timeout = setTimeout(() => {
      updateFilters({ plateSearch: searchValue });
      // Ejecutar búsqueda automática solo si hay texto
      if (searchValue.trim().length > 0) {
        onSearch();
      }
    }, 300); // 300ms de debounce
    
    setSearchTimeout(timeout);
  }, [onSearch, searchTimeout]);

  // Función para manejar cambios en la búsqueda
  const handlePlateSearchChange = (value: string) => {
    updateFilters({ plateSearch: value });
    
    // Si está vacío, ejecutar búsqueda inmediatamente para mostrar todos los resultados
    if (value.trim() === '') {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      onSearch();
    } else {
      // Aplicar debounce para búsquedas con texto
      debouncedSearch(value);
    }
  };

  // Función para manejar tecla Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      onSearch();
    }
  };

  // Eliminar búsqueda automática - ahora solo manual

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

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

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

  // Establecer valores por defecto para hoy (desde)
  const setTodayRange = () => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    updateFilters({
      startDate: todayStr,
      startTime: '00:00'
    });
  };

  // Limpiar búsqueda
  const clearSearch = () => {
    updateFilters({ plateSearch: '' });
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    onSearch();
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
        <CardTitle className="flex items-center gap-2">
          <Filter className="h-5 w-5" />
          Búsqueda y Filtros LPR
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Fila única: Todos los controles principales */}
        <div className="grid grid-cols-1 gap-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Búsqueda de Matrículas */}
            <div className="space-y-2">
              <Label htmlFor="plateSearch" className="text-sm font-medium">
                Búsqueda General
              </Label>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    id="plateSearch"
                    type="text"
                    placeholder="Buscar matrículas, cámaras, servidores..."
                    value={filters.plateSearch || ''}
                    onChange={(e) => handlePlateSearchChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="pl-10 pr-10 w-32"
                    maxLength={12}
                  />
                  {filters.plateSearch && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
                      type="button"
                      aria-label="Limpiar búsqueda"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <Button
                  onClick={onSearch}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6"
                >
                  {isLoading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                  Buscar
                </Button>
              </div>
            </div>

            {/* Desde Día y Hora */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Desde</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={filters.startDate || ''}
                  onChange={(e) => updateFilters({ startDate: e.target.value })}
                  className="w-36"
                />
                <Input
                  type="time"
                  value={filters.startTime || '00:00'}
                  onChange={(e) => updateFilters({ startTime: e.target.value })}
                  className="w-24"
                />
              </div>
            </div>

            {/* Hasta Día y Hora */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Hasta</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={filters.endDate || ''}
                  onChange={(e) => updateFilters({ endDate: e.target.value })}
                  className="w-36"
                />
                <Input
                  type="time"
                  value={filters.endTime || '23:59'}
                  onChange={(e) => updateFilters({ endTime: e.target.value })}
                  className="w-24"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={setTodayRange}
                  disabled={isLoading}
                  className="bg-green-500 text-white hover:bg-green-600 px-4"
                >
                  <Calendar className="h-4 w-4 mr-1" />
                  Hoy
                </Button>
              </div>
            </div>

            {/* Cámaras */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cámaras</Label>
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
                <SelectTrigger className="w-48 bg-purple-50 hover:bg-purple-100 border-purple-200">
                  <div className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    <SelectValue placeholder="Todas" />
                  </div>
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="select-all">Seleccionar todas</SelectItem>
                  {Object.entries(camerasByServer).map(([serverName, serverCameras]) => (
                    <div key={serverName}>
                      <div className="px-2 py-1 text-sm font-semibold text-gray-700 bg-gray-50 border-b">
                        🖥️ {serverName}
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
                              📹 {camera.cameraName}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtros Avanzados - Botón desplegable */}
            <div className="space-y-2">
              <Label className="text-sm font-medium opacity-0">Avanzado</Label>
              <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="bg-gray-50 hover:bg-gray-100 border-gray-300 px-3">
                    <Filter className="h-4 w-4 mr-1" />
                    Avanzado
                    <ChevronDown className={`h-4 w-4 ml-1 transition-transform ${isAdvancedOpen ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            </div>
          </div>
        </div>

        {/* Filtros Avanzados - Contenido desplegable */}
        <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
          <CollapsibleContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
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
                Búsqueda: {filters.plateSearch}
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