/**
 * Componente de filtros para el panel LPR
 * 
 * Proporciona una interfaz completa para filtrar eventos de matrículas
 * por múltiples criterios como fechas, cámaras, confianza, etc.
 * 
 * Todas las variables y funciones usan snake_case siguiendo las convenciones
 * del proyecto ExalinkHub.
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Search, Filter, X, Calendar, Camera, Car, Clock } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface PlateEventFilters {
  camera_name?: string;
  license_plate?: string;
  start_date?: string;
  end_date?: string;
  traffic_light_status?: string;
  vehicle_type?: string;
  false_positive?: boolean;
  zone?: string;
  min_confidence?: number;
}

interface LPRFiltersProps {
  filters: PlateEventFilters;
  on_filters_change: (filters: PlateEventFilters) => void;
  is_loading: boolean;
}

interface AvailableOptions {
  cameras: string[];
  zones: string[];
  vehicle_types: string[];
}

/**
 * Componente principal de filtros para eventos LPR
 */
export function LPRFilters({ filters, on_filters_change, is_loading }: LPRFiltersProps) {
  const t = useTranslations('lpr_filters');
  
  // Estados locales para los filtros
  const [local_filters, set_local_filters] = useState<PlateEventFilters>(filters);
  const [available_options, set_available_options] = useState<AvailableOptions>({
    cameras: [],
    zones: [],
    vehicle_types: ['car', 'truck', 'motorcycle', 'bus', 'bicycle', 'unknown']
  });
  const [is_advanced_open, set_is_advanced_open] = useState(false);
  const [has_active_filters, set_has_active_filters] = useState(false);
  
  /**
   * Actualiza los filtros locales
   */
  const update_local_filter = (key: keyof PlateEventFilters, value: any) => {
    set_local_filters(prev => ({
      ...prev,
      [key]: value === '' ? undefined : value
    }));
  };
  
  /**
   * Aplica los filtros actuales
   */
  const apply_filters = () => {
    on_filters_change(local_filters);
  };
  
  /**
   * Limpia todos los filtros
   */
  const clear_filters = () => {
    const clean_filters: PlateEventFilters = {
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
    };
    set_local_filters(clean_filters);
    on_filters_change(clean_filters);
  };
  
  /**
   * Carga las opciones disponibles desde la API
   */
  const load_available_options = async () => {
    try {
      // TODO: Implementar carga de cámaras y zonas desde la API
      // Por ahora usar valores de ejemplo
      set_available_options(prev => ({
        ...prev,
        cameras: ['camera_001', 'camera_002', 'camera_003', 'entrada_principal', 'salida_trasera'],
        zones: ['zona_a', 'zona_b', 'estacionamiento', 'entrada', 'salida']
      }));
    } catch (error) {
      console.error('Error loading available options:', error);
    }
  };
  
  /**
   * Verifica si hay filtros activos (distintos a los por defecto)
   */
  const check_active_filters = () => {
    const default_filters = {
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
    };
    
    const has_filters = Object.entries(local_filters).some(([key, value]) => {
      if (key === 'start_date' || key === 'end_date') {
        return value !== default_filters[key as keyof typeof default_filters];
      }
      return value !== undefined && value !== '';
    });
    
    set_has_active_filters(has_filters);
  };
  
  // Efectos
  useEffect(() => {
    load_available_options();
  }, []);
  
  useEffect(() => {
    set_local_filters(filters);
  }, [filters]);
  
  useEffect(() => {
    check_active_filters();
  }, [local_filters]);
  
  // Función para manejar el Enter en los inputs
  const handle_key_press = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      apply_filters();
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros de Búsqueda
            {has_active_filters && (
              <Badge variant="secondary" className="ml-2">
                Activos
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {has_active_filters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clear_filters}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Limpiar
              </Button>
            )}
            
            <Button
              onClick={apply_filters}
              disabled={is_loading}
              size="sm"
            >
              <Search className="h-4 w-4 mr-2" />
              {is_loading ? 'Buscando...' : 'Buscar'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Filtros básicos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Rango de fechas */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Fecha Inicio
            </Label>
            <Input
              type="date"
              value={local_filters.start_date || ''}
              onChange={(e) => update_local_filter('start_date', e.target.value)}
              onKeyPress={handle_key_press}
            />
          </div>
          
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Fecha Fin
            </Label>
            <Input
              type="date"
              value={local_filters.end_date || ''}
              onChange={(e) => update_local_filter('end_date', e.target.value)}
              onKeyPress={handle_key_press}
            />
          </div>
          
          {/* Búsqueda de matrícula */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Matrícula
            </Label>
            <Input
              placeholder="Buscar matrícula..."
              value={local_filters.license_plate || ''}
              onChange={(e) => update_local_filter('license_plate', e.target.value)}
              onKeyPress={handle_key_press}
            />
          </div>
          
          {/* Cámara */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Cámara
            </Label>
            <Select
              value={local_filters.camera_name || ''}
              onValueChange={(value) => update_local_filter('camera_name', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas las cámaras" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todas las cámaras</SelectItem>
                {available_options.cameras.map((camera) => (
                  <SelectItem key={camera} value={camera}>
                    {camera}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Filtros avanzados */}
        <Collapsible open={is_advanced_open} onOpenChange={set_is_advanced_open}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0">
              <span className="text-sm font-medium">Filtros Avanzados</span>
              <div className={`transition-transform ${is_advanced_open ? 'rotate-180' : ''}`}>
                ▼
              </div>
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Tipo de vehículo */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  Tipo de Vehículo
                </Label>
                <Select
                  value={local_filters.vehicle_type || ''}
                  onValueChange={(value) => update_local_filter('vehicle_type', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los tipos</SelectItem>
                    {available_options.vehicle_types.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type === 'car' && 'Automóvil'}
                        {type === 'truck' && 'Camión'}
                        {type === 'motorcycle' && 'Motocicleta'}
                        {type === 'bus' && 'Autobús'}
                        {type === 'bicycle' && 'Bicicleta'}
                        {type === 'unknown' && 'Desconocido'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Estado del semáforo */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Estado Semáforo
                </Label>
                <Select
                  value={local_filters.traffic_light_status || ''}
                  onValueChange={(value) => update_local_filter('traffic_light_status', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos los estados</SelectItem>
                    <SelectItem value="red">🔴 Rojo</SelectItem>
                    <SelectItem value="yellow">🟡 Amarillo</SelectItem>
                    <SelectItem value="green">🟢 Verde</SelectItem>
                    <SelectItem value="unknown">⚪ Desconocido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Zona */}
              <div className="space-y-2">
                <Label>Zona</Label>
                <Select
                  value={local_filters.zone || ''}
                  onValueChange={(value) => update_local_filter('zone', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas las zonas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todas las zonas</SelectItem>
                    {available_options.zones.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Confianza mínima */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Confianza Mínima</Label>
                <span className="text-sm text-muted-foreground">
                  {local_filters.min_confidence !== undefined 
                    ? `${Math.round(local_filters.min_confidence * 100)}%` 
                    : 'Sin límite'
                  }
                </span>
              </div>
              <Slider
                value={[local_filters.min_confidence || 0]}
                onValueChange={([value]) => update_local_filter('min_confidence', value)}
                max={1}
                min={0}
                step={0.05}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
            
            {/* Filtros booleanos */}
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="false-positive"
                  checked={local_filters.false_positive === true}
                  onCheckedChange={(checked) => 
                    update_local_filter('false_positive', checked ? true : undefined)
                  }
                />
                <Label htmlFor="false-positive" className="text-sm">
                  Solo falsos positivos
                </Label>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
        
        {/* Resumen de filtros activos */}
        {has_active_filters && (
          <div className="border-t pt-4">
            <div className="flex flex-wrap gap-2">
              {local_filters.license_plate && (
                <Badge variant="secondary">
                  Matrícula: {local_filters.license_plate}
                </Badge>
              )}
              {local_filters.camera_name && (
                <Badge variant="secondary">
                  Cámara: {local_filters.camera_name}
                </Badge>
              )}
              {local_filters.vehicle_type && (
                <Badge variant="secondary">
                  Vehículo: {local_filters.vehicle_type}
                </Badge>
              )}
              {local_filters.traffic_light_status && (
                <Badge variant="secondary">
                  Semáforo: {local_filters.traffic_light_status}
                </Badge>
              )}
              {local_filters.zone && (
                <Badge variant="secondary">
                  Zona: {local_filters.zone}
                </Badge>
              )}
              {local_filters.min_confidence !== undefined && (
                <Badge variant="secondary">
                  Confianza ≥ {Math.round(local_filters.min_confidence * 100)}%
                </Badge>
              )}
              {local_filters.false_positive === true && (
                <Badge variant="destructive">
                  Solo falsos positivos
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}