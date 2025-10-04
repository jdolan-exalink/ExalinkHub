"use client";

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Image from 'next/image';
import { 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Car, 
  Truck, 
  Bike,
  Bus,
  X,
  Calendar,
  Clock,
  CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { PlateDetection, PlateFilters } from '@/lib/types';

const vehicleIcons = {
  car: Car,
  truck: Truck,
  motorcycle: Bike,
  bus: Bus
};

const vehicleColors = {
  car: 'bg-green-100 text-green-800',
  truck: 'bg-orange-100 text-orange-800',
  motorcycle: 'bg-red-100 text-red-800',
  bus: 'bg-yellow-100 text-yellow-800'
};

const directionColors = {
  entry: 'bg-blue-100 text-blue-800',
  exit: 'bg-purple-100 text-purple-800',
  unknown: 'bg-gray-100 text-gray-800'
};

export default function PlatesPage() {
  const [detections, setDetections] = useState<PlateDetection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDetection, setSelectedDetection] = useState<PlateDetection | null>(null);
  
  const [filters, setFilters] = useState<PlateFilters>({
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
    startTime: '00:00',
    endTime: '23:59',
    cameras: [],
    plateSearch: '',
    speedMin: undefined,
    speedMax: undefined,
    vehicleTypes: []
  });

  const availableCameras = [
    { id: 'acceso_sur', name: 'Acceso Sur' },
    { id: 'entrada_principal', name: 'Entrada Principal' },
    { id: 'salida_norte', name: 'Salida Norte' },
    { id: 'portones', name: 'Portones' }
  ];

  const vehicleTypeOptions = [
    { id: 'car', name: 'Autos', icon: Car },
    { id: 'truck', name: 'Camiones', icon: Truck },
    { id: 'motorcycle', name: 'Motos', icon: Bike },
    { id: 'bus', name: 'Colectivos', icon: Bus }
  ];

  const fetchDetections = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      
      if (filters.cameras.length > 0) {
        params.append('camera', filters.cameras.join(','));
      }
      if (filters.plateSearch) {
        params.append('plate', filters.plateSearch);
      }
      if (filters.speedMin !== undefined) {
        params.append('speedMin', filters.speedMin.toString());
      }
      if (filters.speedMax !== undefined) {
        params.append('speedMax', filters.speedMax.toString());
      }
      
      const startDateTime = new Date(`${filters.startDate}T${filters.startTime}`);
      const endDateTime = new Date(`${filters.endDate}T${filters.endTime}`);
      
      params.append('startDate', startDateTime.toISOString());
      params.append('endDate', endDateTime.toISOString());
      
      const response = await fetch(`/api/plates?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar las detecciones de matrículas');
      }
      
      const data = await response.json();
      setDetections(data.detections || []);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setDetections([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetections();
  }, []);

  const handleApplyFilters = () => {
    fetchDetections();
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setFilters({
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(new Date(), 'yyyy-MM-dd'),
      startTime: '00:00',
      endTime: '23:59',
      cameras: [],
      plateSearch: '',
      speedMin: undefined,
      speedMax: undefined,
      vehicleTypes: []
    });
  };

  const handleDownload = async (detection: PlateDetection) => {
    if (!detection.has_clip) {
      alert('⚠️ No hay video disponible para esta detección.');
      return;
    }
    
    try {
      // Simular descarga de clip
      const date = new Date(detection.timestamp * 1000);
      const dateStr = date.toISOString().slice(0, 19).replace(/[:.]/g, '-');
      const filename = `${detection.camera}_${detection.plate}_${dateStr}.mp4`;
      
      console.log(`Descargando clip: ${filename}`);
      alert(`✅ Iniciando descarga: ${filename}`);
      
    } catch (error) {
      console.error('Error downloading clip:', error);
      alert('❌ Error al descargar el video');
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b">
        <div className="mb-4">
          <h1 className="font-headline text-3xl font-bold tracking-tight flex items-center gap-3">
            <CreditCard className="h-8 w-8 text-primary" />
            Matrículas
          </h1>
          <p className="text-muted-foreground mt-1">
            Sistema de detección y seguimiento de matrículas vehiculares
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar matrícula..."
              value={filters.plateSearch}
              onChange={(e) => setFilters(prev => ({ ...prev, plateSearch: e.target.value }))}
              className="w-48"
            />
          </div>
          
          <Button
            variant="outline"
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtros
            {(filters.cameras.length > 0 || filters.speedMin !== undefined || filters.speedMax !== undefined) && (
              <Badge variant="secondary" className="ml-1">
                {filters.cameras.length + (filters.speedMin !== undefined ? 1 : 0) + (filters.speedMax !== undefined ? 1 : 0)}
              </Badge>
            )}
          </Button>
          
          <Button onClick={fetchDetections} disabled={loading}>
            {loading ? 'Cargando...' : 'Buscar'}
          </Button>
          
          <div className="text-sm text-muted-foreground">
            {detections.length} detecciones encontradas
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {error ? (
          <div className="p-6">
            <div className="text-center text-destructive">
              ❌ {error}
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <div className="p-6">
              <Card>
                <CardHeader>
                  <CardTitle>Detecciones de Matrículas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Captura</TableHead>
                          <TableHead>Matrícula</TableHead>
                          <TableHead>Cámara</TableHead>
                          <TableHead>Fecha y Hora</TableHead>
                          <TableHead>Velocidad</TableHead>
                          <TableHead>Semáforo</TableHead>
                          <TableHead>Clip</TableHead>
                          <TableHead>Acciones</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8">
                              Cargando detecciones...
                            </TableCell>
                          </TableRow>
                        ) : detections.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                              No se encontraron detecciones con los filtros aplicados
                            </TableCell>
                          </TableRow>
                        ) : (
                          detections.map((detection) => {
                            const VehicleIcon = vehicleIcons[detection.vehicle_type];
                            const isSpeedViolation = detection.speed && detection.speed > 60;
                            
                            return (
                              <TableRow key={detection.id}>
                                <TableCell>
                                  <div className="relative w-16 h-12 bg-gray-100 rounded overflow-hidden">
                                    <Image
                                      src={detection.image}
                                      alt={`Matrícula ${detection.plate}`}
                                      fill
                                      className="object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA2NCA0OCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNjQiIGhlaWdodD0iNDgiIGZpbGw9IiNmM2Y0ZjYiLz48dGV4dCB4PSIzMiIgeT0iMjgiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxMCIgZmlsbD0iIzk5YTNhZiI+SW1hZ2VuPC90ZXh0Pjwvc3ZnPg==';
                                      }}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="font-mono font-bold text-lg">
                                    {detection.plate || '—'}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={vehicleColors[detection.vehicle_type]}>
                                      <VehicleIcon className="h-3 w-3 mr-1" />
                                      {detection.camera}
                                    </Badge>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="text-sm">
                                    {format(new Date(detection.timestamp * 1000), 'dd/MM/yyyy', { locale: es })}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {format(new Date(detection.timestamp * 1000), 'HH:mm:ss')}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {detection.speed ? (
                                    <Badge 
                                      variant={isSpeedViolation ? "destructive" : "secondary"}
                                      className="font-mono"
                                    >
                                      {detection.speed} km/h
                                    </Badge>
                                  ) : (
                                    <span className="text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {isSpeedViolation ? (
                                    <span className="text-red-600 text-xl">❌</span>
                                  ) : (
                                    <span className="text-green-600 text-xl">✅</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {detection.has_clip ? (
                                    <Badge className="bg-blue-100 text-blue-800">
                                      🎥 Disponible
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-muted-foreground">
                                      📸 Solo imagen
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Dialog>
                                      <DialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setSelectedDetection(detection)}
                                        >
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                      </DialogTrigger>
                                      <DialogContent className="max-w-2xl">
                                        <DialogHeader>
                                          <DialogTitle>
                                            Detección de Matrícula: {detection.plate}
                                          </DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                          <div className="aspect-video relative bg-black rounded overflow-hidden">
                                            <Image
                                              src={detection.image}
                                              alt={`Matrícula ${detection.plate}`}
                                              fill
                                              className="object-contain"
                                            />
                                          </div>
                                          <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                              <strong>Matrícula:</strong> {detection.plate}
                                            </div>
                                            <div>
                                              <strong>Cámara:</strong> {detection.camera}
                                            </div>
                                            <div>
                                              <strong>Fecha:</strong> {format(new Date(detection.timestamp * 1000), 'dd/MM/yyyy HH:mm:ss')}
                                            </div>
                                            <div>
                                              <strong>Velocidad:</strong> {detection.speed ? `${detection.speed} km/h` : 'No detectada'}
                                            </div>
                                            <div>
                                              <strong>Vehículo:</strong> {detection.vehicle_type}
                                            </div>
                                            <div>
                                              <strong>Confianza:</strong> {Math.round(detection.confidence * 100)}%
                                            </div>
                                          </div>
                                        </div>
                                      </DialogContent>
                                    </Dialog>
                                    
                                    {detection.has_clip && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDownload(detection)}
                                      >
                                        <Download className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Filters Dialog */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Filtros de Búsqueda</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha de inicio</Label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Fecha de fin</Label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Hora de inicio</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={filters.startTime}
                  onChange={(e) => setFilters(prev => ({ ...prev, startTime: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Hora de fin</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="time"
                  value={filters.endTime}
                  onChange={(e) => setFilters(prev => ({ ...prev, endTime: e.target.value }))}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Velocidad mínima (km/h)</Label>
              <Input
                type="number"
                placeholder="Ej: 50"
                value={filters.speedMin || ''}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  speedMin: e.target.value ? parseInt(e.target.value) : undefined 
                }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Velocidad máxima (km/h)</Label>
              <Input
                type="number"
                placeholder="Ej: 100"
                value={filters.speedMax || ''}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  speedMax: e.target.value ? parseInt(e.target.value) : undefined 
                }))}
              />
            </div>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Cámaras</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {availableCameras.map(camera => (
                  <div key={camera.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={camera.id}
                      checked={filters.cameras.includes(camera.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFilters(prev => ({ 
                            ...prev, 
                            cameras: [...prev.cameras, camera.id] 
                          }));
                        } else {
                          setFilters(prev => ({ 
                            ...prev, 
                            cameras: prev.cameras.filter(c => c !== camera.id) 
                          }));
                        }
                      }}
                    />
                    <Label htmlFor={camera.id} className="text-sm">
                      {camera.name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <Label className="text-base font-medium">Tipos de vehículo</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {vehicleTypeOptions.map(type => {
                  const Icon = type.icon;
                  return (
                    <div key={type.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={type.id}
                        checked={filters.vehicleTypes.includes(type.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFilters(prev => ({ 
                              ...prev, 
                              vehicleTypes: [...prev.vehicleTypes, type.id] 
                            }));
                          } else {
                            setFilters(prev => ({ 
                              ...prev, 
                              vehicleTypes: prev.vehicleTypes.filter(v => v !== type.id) 
                            }));
                          }
                        }}
                      />
                      <Label htmlFor={type.id} className="text-sm flex items-center gap-1">
                        <Icon className="h-4 w-4" />
                        {type.name}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
          <div className="flex justify-between pt-4">
            <Button variant="outline" onClick={handleClearFilters}>
              <X className="h-4 w-4 mr-2" />
              Limpiar
            </Button>
            <Button onClick={handleApplyFilters}>
              <Search className="h-4 w-4 mr-2" />
              Aplicar Filtros
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}