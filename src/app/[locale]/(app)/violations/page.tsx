/**
 * Página de Infracciones de Tránsito
 * 
 * Sistema de detección y gestión de infracciones de tráfico:
 * - Semáforo en rojo
 * - Moto sin casco
 * - Exceso de velocidad
 * - Otros tipos de infracciones configurables
 * 
 * Mantiene la estética del resto de paneles del sistema
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  AlertTriangle, 
  RefreshCw, 
  Filter, 
  Download, 
  Camera, 
  Clock,
  Car,
  Bike,
  CircleDot,
  Zap,
  Settings,
  Eye,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';

/**
 * Tipos de infracciones disponibles
 */
type ViolationType = 'red_light' | 'no_helmet' | 'speeding' | 'wrong_way' | 'parking' | 'other';

/**
 * Interfaz para una infracción
 */
interface Violation {
  id: string;
  type: ViolationType;
  camera: string;
  timestamp: string;
  plate?: string;
  speed?: number;
  speed_limit?: number;
  confidence: number;
  image_url?: string;
  video_url?: string;
  status: 'pending' | 'confirmed' | 'dismissed';
  notes?: string;
}

/**
 * Configuración de tipos de infracciones
 */
const violation_type_config: Record<ViolationType, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg_color: string;
}> = {
  red_light: {
    label: 'Semáforo en Rojo',
    icon: CircleDot,
    color: 'text-red-600',
    bg_color: 'bg-red-50',
  },
  no_helmet: {
    label: 'Sin Casco',
    icon: Bike,
    color: 'text-orange-600',
    bg_color: 'bg-orange-50',
  },
  speeding: {
    label: 'Exceso de Velocidad',
    icon: Zap,
    color: 'text-yellow-600',
    bg_color: 'bg-yellow-50',
  },
  wrong_way: {
    label: 'Dirección Prohibida',
    icon: AlertTriangle,
    color: 'text-purple-600',
    bg_color: 'bg-purple-50',
  },
  parking: {
    label: 'Estacionamiento Prohibido',
    icon: Car,
    color: 'text-blue-600',
    bg_color: 'bg-blue-50',
  },
  other: {
    label: 'Otra Infracción',
    icon: AlertTriangle,
    color: 'text-gray-600',
    bg_color: 'bg-gray-50',
  },
};

/**
 * Componente ViolationCard - Tarjeta de infracción
 */
interface ViolationCardProps {
  violation: Violation;
  on_view_details: (violation: Violation) => void;
  on_update_status: (id: string, status: 'confirmed' | 'dismissed') => void;
}

const ViolationCard: React.FC<ViolationCardProps> = ({ violation, on_view_details, on_update_status }) => {
  const config = violation_type_config[violation.type];
  const Icon = config.icon;

  const get_status_badge = (status: string) => {
    const status_map = {
      pending: { label: 'Pendiente', variant: 'outline' as const },
      confirmed: { label: 'Confirmada', variant: 'default' as const },
      dismissed: { label: 'Descartada', variant: 'secondary' as const },
    };
    return status_map[status as keyof typeof status_map] || status_map.pending;
  };

  const status_badge = get_status_badge(violation.status);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-full ${config.bg_color}`}>
              <Icon className={`h-5 w-5 ${config.color}`} />
            </div>
            <div>
              <CardTitle className="text-base">{config.label}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                <Clock className="inline h-3 w-3 mr-1" />
                {new Date(violation.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
          <Badge variant={status_badge.variant}>{status_badge.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Cámara:</span>
            <p className="font-medium">{violation.camera}</p>
          </div>
          {violation.plate && (
            <div>
              <span className="text-muted-foreground">Matrícula:</span>
              <p className="font-mono font-medium">{violation.plate}</p>
            </div>
          )}
          {violation.speed && (
            <div>
              <span className="text-muted-foreground">Velocidad:</span>
              <p className="font-medium text-red-600">
                {violation.speed} km/h
                {violation.speed_limit && ` (límite: ${violation.speed_limit})`}
              </p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Confianza:</span>
            <p className="font-medium">{(violation.confidence * 100).toFixed(1)}%</p>
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => on_view_details(violation)}
          >
            <Eye className="h-4 w-4 mr-1" />
            Ver Detalles
          </Button>
          {violation.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="default"
                onClick={() => on_update_status(violation.id, 'confirmed')}
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => on_update_status(violation.id, 'dismissed')}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default function ViolationsPage() {
  const [loading, set_loading] = useState(true);
  const [violations, set_violations] = useState<Violation[]>([]);
  const [filtered_violations, set_filtered_violations] = useState<Violation[]>([]);
  const [selected_violation, set_selected_violation] = useState<Violation | null>(null);
  const [dialog_open, set_dialog_open] = useState(false);

  // Filtros
  const [filter_type, set_filter_type] = useState<string>('all');
  const [filter_status, set_filter_status] = useState<string>('all');
  const [filter_camera, set_filter_camera] = useState<string>('all');
  const [filter_date, set_filter_date] = useState<string>('');

  /**
   * Cargar infracciones
   */
  const load_violations = async () => {
    set_loading(true);
    try {
      // TODO: Implementar endpoint real
      // Datos de ejemplo
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mock_violations: Violation[] = [
        {
          id: '1',
          type: 'red_light',
          camera: 'Esquina Principal',
          timestamp: new Date().toISOString(),
          plate: 'ABC123',
          confidence: 0.92,
          status: 'pending',
          image_url: '/api/placeholder/400/300'
        },
        {
          id: '2',
          type: 'speeding',
          camera: 'Ruta 9',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          plate: 'XYZ789',
          speed: 95,
          speed_limit: 60,
          confidence: 0.88,
          status: 'confirmed',
          image_url: '/api/placeholder/400/300'
        },
        {
          id: '3',
          type: 'no_helmet',
          camera: 'Avenida Central',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          confidence: 0.85,
          status: 'pending',
          image_url: '/api/placeholder/400/300'
        },
      ];
      
      set_violations(mock_violations);
      set_filtered_violations(mock_violations);
    } catch (error) {
      console.error('Error cargando infracciones:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las infracciones',
        variant: 'destructive',
      });
    } finally {
      set_loading(false);
    }
  };

  /**
   * Aplicar filtros
   */
  useEffect(() => {
    let filtered = [...violations];

    if (filter_type !== 'all') {
      filtered = filtered.filter(v => v.type === filter_type);
    }

    if (filter_status !== 'all') {
      filtered = filtered.filter(v => v.status === filter_status);
    }

    if (filter_camera !== 'all') {
      filtered = filtered.filter(v => v.camera === filter_camera);
    }

    if (filter_date) {
      const filter_date_obj = new Date(filter_date);
      filtered = filtered.filter(v => {
        const violation_date = new Date(v.timestamp);
        return violation_date.toDateString() === filter_date_obj.toDateString();
      });
    }

    set_filtered_violations(filtered);
  }, [filter_type, filter_status, filter_camera, filter_date, violations]);

  /**
   * Ver detalles de infracción
   */
  const handle_view_details = (violation: Violation) => {
    set_selected_violation(violation);
    set_dialog_open(true);
  };

  /**
   * Actualizar estado de infracción
   */
  const handle_update_status = (id: string, status: 'confirmed' | 'dismissed') => {
    set_violations(prev =>
      prev.map(v => (v.id === id ? { ...v, status } : v))
    );

    toast({
      title: 'Estado actualizado',
      description: `La infracción ha sido ${status === 'confirmed' ? 'confirmada' : 'descartada'}`,
    });
  };

  /**
   * Exportar infracciones
   */
  const handle_export = () => {
    toast({
      title: 'Exportando infracciones',
      description: 'Generando archivo Excel...',
    });
    // TODO: Implementar exportación
  };

  // Cargar datos al montar
  useEffect(() => {
    load_violations();
  }, []);

  // Obtener lista de cámaras únicas
  const cameras = Array.from(new Set(violations.map(v => v.camera)));

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-primary" />
            Infracciones de Tránsito
          </h1>
          <p className="text-muted-foreground mt-1">
            Sistema de detección y gestión de infracciones
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handle_export}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" size="sm" onClick={load_violations}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configurar
          </Button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(violation_type_config).map(([type, config]) => {
          const count = violations.filter(v => v.type === type).length;
          const Icon = config.icon;
          return (
            <Card key={type}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Icon className={`h-5 w-5 ${config.color}`} />
                  <Badge variant="outline">{count}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">{config.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Tipo de Infracción</Label>
              <Select value={filter_type} onValueChange={set_filter_type}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(violation_type_config).map(([type, config]) => (
                    <SelectItem key={type} value={type}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={filter_status} onValueChange={set_filter_status}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="confirmed">Confirmada</SelectItem>
                  <SelectItem value="dismissed">Descartada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cámara</Label>
              <Select value={filter_camera} onValueChange={set_filter_camera}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {cameras.map(camera => (
                    <SelectItem key={camera} value={camera}>
                      {camera}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={filter_date}
                onChange={e => set_filter_date(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de infracciones */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            Infracciones ({filtered_violations.length})
          </h2>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filtered_violations.length === 0 ? (
          <Alert>
            <AlertDescription>
              No se encontraron infracciones con los filtros aplicados.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered_violations.map(violation => (
              <ViolationCard
                key={violation.id}
                violation={violation}
                on_view_details={handle_view_details}
                on_update_status={handle_update_status}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialog de detalles */}
      <Dialog open={dialog_open} onOpenChange={set_dialog_open}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalles de Infracción</DialogTitle>
          </DialogHeader>
          {selected_violation && (
            <div className="space-y-4">
              {selected_violation.image_url && (
                <div className="rounded-lg overflow-hidden border">
                  <img
                    src={selected_violation.image_url}
                    alt="Evidencia"
                    className="w-full h-auto"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <p className="font-medium">
                    {violation_type_config[selected_violation.type].label}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Estado:</span>
                  <p className="font-medium capitalize">{selected_violation.status}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Cámara:</span>
                  <p className="font-medium">{selected_violation.camera}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fecha/Hora:</span>
                  <p className="font-medium">
                    {new Date(selected_violation.timestamp).toLocaleString()}
                  </p>
                </div>
                {selected_violation.plate && (
                  <div>
                    <span className="text-muted-foreground">Matrícula:</span>
                    <p className="font-mono font-medium">{selected_violation.plate}</p>
                  </div>
                )}
                {selected_violation.speed && (
                  <div>
                    <span className="text-muted-foreground">Velocidad:</span>
                    <p className="font-medium text-red-600">
                      {selected_violation.speed} km/h
                    </p>
                  </div>
                )}
              </div>
              {selected_violation.notes && (
                <div>
                  <span className="text-muted-foreground">Notas:</span>
                  <p className="mt-1">{selected_violation.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
