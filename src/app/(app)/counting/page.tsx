"use client";

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
  Car, 
  Truck, 
  Bike,
  Bus,
  BarChart3,
  Calendar,
  Filter,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Equal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell 
} from 'recharts';
import type { CountingMetrics, CountingFilters } from '@/lib/types';

const vehicleIcons = {
  cars: Car,
  trucks: Truck,
  motorcycles: Bike,
  buses: Bus,
  bicycles: Bike
};

const vehicleColors = {
  cars: '#22c55e',
  trucks: '#f97316', 
  motorcycles: '#ef4444',
  buses: '#eab308',
  bicycles: '#8b5cf6'
};

const vehicleLabels = {
  cars: 'Autos',
  trucks: 'Camiones',
  motorcycles: 'Motos',
  buses: 'Colectivos',
  bicycles: 'Bicicletas'
};

const directionIcons = {
  entries: ArrowUp,
  exits: ArrowDown,
  total: Equal
};

const directionColors = {
  entries: 'text-green-600',
  exits: 'text-red-600',
  total: 'text-blue-600'
};

export default function CountingPage() {
  const [metrics, setMetrics] = useState<CountingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  
  const [filters, setFilters] = useState<CountingFilters>({
    date: format(new Date(), 'yyyy-MM-dd'),
    cameras: [],
    vehicleTypes: []
  });

  const availableCameras = [
    { id: 'acceso_sur', name: 'Acceso Sur' },
    { id: 'entrada_principal', name: 'Entrada Principal' },
    { id: 'salida_norte', name: 'Salida Norte' },
    { id: 'portones', name: 'Portones' }
  ];

  const vehicleTypeOptions = [
    { id: 'cars', name: 'Autos', icon: Car },
    { id: 'trucks', name: 'Camiones', icon: Truck },
    { id: 'motorcycles', name: 'Motos', icon: Bike },
    { id: 'buses', name: 'Colectivos', icon: Bus },
    { id: 'bicycles', name: 'Bicicletas', icon: Bike }
  ];

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      
      if (filters.date) {
        params.append('date', filters.date);
      }
      if (filters.cameras.length > 0) {
        params.append('cameras', filters.cameras.join(','));
      }
      if (filters.vehicleTypes.length > 0) {
        params.append('vehicleTypes', filters.vehicleTypes.join(','));
      }
      
      const response = await fetch(`/api/counting?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar las métricas de conteo');
      }
      
      const data = await response.json();
      setMetrics(data);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleApplyFilters = () => {
    fetchMetrics();
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setFilters({
      date: format(new Date(), 'yyyy-MM-dd'),
      cameras: [],
      vehicleTypes: []
    });
  };

  // Preparar datos para gráficos
  const hourlyChartData = metrics?.hourlyData.map(hour => ({
    hour: `${hour.hour.toString().padStart(2, '0')}:00`,
    Entradas: hour.entries,
    Salidas: hour.exits,
    Total: hour.total
  })) || [];

  const vehicleChartData = metrics ? Object.entries(metrics.vehicleBreakdown).map(([key, value]) => ({
    name: vehicleLabels[key as keyof typeof vehicleLabels],
    value,
    color: vehicleColors[key as keyof typeof vehicleColors]
  })) : [];

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b">
        <div className="mb-4">
          <h1 className="font-headline text-3xl font-bold tracking-tight flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            Sistema de Conteo
          </h1>
          <p className="text-muted-foreground mt-1">
            Análisis y métricas de flujo vehicular
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={filters.date}
              onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
              className="w-40"
            />
          </div>
          
          <Button
            variant="outline"
            onClick={() => setShowFilters(true)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtros
            {(filters.cameras.length > 0 || filters.vehicleTypes.length > 0) && (
              <Badge variant="secondary" className="ml-1">
                {filters.cameras.length + filters.vehicleTypes.length}
              </Badge>
            )}
          </Button>
          
          <Button onClick={fetchMetrics} disabled={loading}>
            {loading ? 'Cargando...' : 'Actualizar'}
          </Button>
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
        ) : loading ? (
          <div className="p-6">
            <div className="text-center">
              Cargando métricas...
            </div>
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <div className="p-6 space-y-6">
              {/* Métricas Generales */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total (IN + OUT)</CardTitle>
                    <Equal className="h-4 w-4 text-blue-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                      {metrics?.totalVehicles.toLocaleString() || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Vehículos detectados
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Entrantes</CardTitle>
                    <ArrowUp className="h-4 w-4 text-green-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">
                      {metrics?.totalEntries.toLocaleString() || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {metrics && ((metrics.totalEntries / metrics.totalVehicles) * 100).toFixed(1)}% del total
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Salientes</CardTitle>
                    <ArrowDown className="h-4 w-4 text-red-600" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">
                      {metrics?.totalExits.toLocaleString() || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {metrics && ((metrics.totalExits / metrics.totalVehicles) * 100).toFixed(1)}% del total
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Por Objeto</CardTitle>
                    <Car className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {metrics ? Object.keys(metrics.vehicleBreakdown).length : 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Tipos de vehículos
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Gráficos */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gráfico por Hora */}
                <Card>
                  <CardHeader>
                    <CardTitle>Por Hora</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={hourlyChartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis />
                        <Tooltip 
                          labelStyle={{ color: '#000' }}
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                        />
                        <Legend />
                        <Bar dataKey="Entradas" fill="#22c55e" />
                        <Bar dataKey="Salidas" fill="#ef4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Gráfico por Objetos */}
                <Card>
                  <CardHeader>
                    <CardTitle>Por Objetos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={vehicleChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {vehicleChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #ccc' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Tabla por Cámara */}
              <Card>
                <CardHeader>
                  <CardTitle>Detalle por Cámara</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cámara</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Entrantes</TableHead>
                          <TableHead>Salientes</TableHead>
                          <TableHead>Por objeto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {metrics?.cameraData.map((camera) => (
                          <TableRow key={camera.camera}>
                            <TableCell className="font-medium">
                              {availableCameras.find(c => c.id === camera.camera)?.name || camera.camera}
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-blue-100 text-blue-800">
                                {camera.total.toLocaleString()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-green-100 text-green-800">
                                👆 {camera.entries.toLocaleString()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className="bg-red-100 text-red-800">
                                👇 {camera.exits.toLocaleString()}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(camera.vehicles).map(([type, count]) => {
                                  if (count === 0) return null;
                                  const Icon = vehicleIcons[type as keyof typeof vehicleIcons];
                                  return (
                                    <Badge key={type} variant="outline" className="text-xs">
                                      <Icon className="h-3 w-3 mr-1" />
                                      {count}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </TableCell>
                          </TableRow>
                        )) || []}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Métricas por Vehículo */}
              <Card>
                <CardHeader>
                  <CardTitle>Distribución por Tipo de Vehículo</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {metrics && Object.entries(metrics.vehicleBreakdown).map(([type, count]) => {
                      const Icon = vehicleIcons[type as keyof typeof vehicleIcons];
                      const percentage = (count / metrics.totalVehicles) * 100;
                      
                      return (
                        <div key={type} className="text-center p-4 border rounded-lg">
                          <Icon 
                            className="h-8 w-8 mx-auto mb-2"
                            style={{ color: vehicleColors[type as keyof typeof vehicleColors] }}
                          />
                          <div className="text-2xl font-bold mb-1">
                            {count.toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground mb-1">
                            {vehicleLabels[type as keyof typeof vehicleLabels]}
                          </div>
                          <Badge 
                            variant="secondary"
                            style={{ 
                              backgroundColor: `${vehicleColors[type as keyof typeof vehicleColors]}20`,
                              color: vehicleColors[type as keyof typeof vehicleColors]
                            }}
                          >
                            {percentage.toFixed(1)}%
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Filters Dialog */}
      <Dialog open={showFilters} onOpenChange={setShowFilters}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Filtros de Conteo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Cámaras</Label>
              <div className="grid grid-cols-1 gap-2 mt-2">
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
              <div className="grid grid-cols-1 gap-2 mt-2">
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
              Limpiar
            </Button>
            <Button onClick={handleApplyFilters}>
              Aplicar Filtros
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}