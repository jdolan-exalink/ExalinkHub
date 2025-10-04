"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Filter, X } from 'lucide-react';
import { 
  IconUser, IconCar, IconTruck, IconBike, IconMotorbike, IconBus, 
  IconDog, IconCat, IconPackage, IconSearch 
} from '@tabler/icons-react';

interface DetectionFilterProps {
  selectedFilters: string[];
  onFiltersChange: (filters: string[]) => void;
  className?: string;
}

// Available detection types
const DETECTION_TYPES = [
  { id: 'person', label: 'Personas', icon: IconUser },
  { id: 'car', label: 'Automóviles', icon: IconCar },
  { id: 'truck', label: 'Camiones', icon: IconTruck },
  { id: 'bicycle', label: 'Bicicletas', icon: IconBike },
  { id: 'motorcycle', label: 'Motocicletas', icon: IconMotorbike },
  { id: 'bus', label: 'Autobuses', icon: IconBus },
  { id: 'dog', label: 'Perros', icon: IconDog },
  { id: 'cat', label: 'Gatos', icon: IconCat },
  { id: 'package', label: 'Paquetes', icon: IconPackage }
];

export default function DetectionFilter({ selectedFilters, onFiltersChange, className }: DetectionFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleFilterToggle = (filterId: string) => {
    const newFilters = selectedFilters.includes(filterId)
      ? selectedFilters.filter(f => f !== filterId)
      : [...selectedFilters, filterId];
    
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    onFiltersChange([]);
  };

  const selectAllFilters = () => {
    onFiltersChange(DETECTION_TYPES.map(type => type.id));
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-white font-medium text-sm">Detecciones:</span>
      
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 bg-gray-800 border-gray-600 text-white hover:bg-gray-700"
          >
            <Filter className="h-4 w-4 mr-2" />
            {selectedFilters.length === 0 ? 'Todas' : `${selectedFilters.length} seleccionadas`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 bg-gray-800 border-gray-600" align="end">
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-medium">Filtros de Detección</h4>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllFilters}
                  className="text-xs text-blue-400 hover:text-blue-300 hover:bg-gray-700 h-6 px-2"
                >
                  Todas
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllFilters}
                  className="text-xs text-gray-400 hover:text-gray-300 hover:bg-gray-700 h-6 px-2"
                >
                  Ninguna
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              {DETECTION_TYPES.map((type) => {
                const IconComponent = type.icon;
                const isSelected = selectedFilters.includes(type.id);
                
                return (
                  <button
                    key={type.id}
                    onClick={() => handleFilterToggle(type.id)}
                    className={`flex items-center gap-2 p-2 rounded text-left transition-colors ${
                      isSelected 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <IconComponent size={16} />
                    <span className="text-sm">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected filters badges */}
      {selectedFilters.length > 0 && (
        <div className="flex items-center gap-1 max-w-xs overflow-x-auto">
          {selectedFilters.slice(0, 3).map((filterId) => {
            const type = DETECTION_TYPES.find(t => t.id === filterId);
            if (!type) return null;
            
            const IconComponent = type.icon;
            
            return (
              <Badge
                key={filterId}
                variant="secondary"
                className="bg-blue-600/20 text-blue-300 border-blue-500/30 text-xs whitespace-nowrap"
              >
                <IconComponent size={12} className="mr-1" />
                {type.label}
                <button
                  onClick={() => handleFilterToggle(filterId)}
                  className="ml-1 hover:bg-blue-500/30 rounded-full p-0.5"
                >
                  <X size={10} />
                </button>
              </Badge>
            );
          })}
          {selectedFilters.length > 3 && (
            <Badge variant="secondary" className="bg-gray-600/50 text-gray-300 text-xs">
              +{selectedFilters.length - 3} más
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}