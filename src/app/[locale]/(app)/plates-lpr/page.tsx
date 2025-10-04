'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Clock, CheckCircle, XCircle, Timer } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LPRFilters } from '@/components/ui/lpr-filters';
import { LPRTable } from '@/components/ui/lpr-table';
import { LPRSnapshotModal, LPRClipModal } from '@/components/ui/lpr-modals';
import { ConfidenceLegend } from '@/components/ui/confidence-light';
import type { LPRFilters as LPRFiltersType, LPREvent, LPRSearchResult } from '@/lib/types';

export default function PlatesPage() {
  // Estados principales
  const [events, setEvents] = useState<LPREvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<LPRSearchResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Estados de modales
  const [selectedEvent, setSelectedEvent] = useState<LPREvent | null>(null);
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [clipModalOpen, setClipModalOpen] = useState(false);
  
  // Filtros por defecto (hoy)
  const [filters, setFilters] = useState<LPRFiltersType>(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    return {
      startDate: todayStr,
      endDate: todayStr,
      startTime: '00:00',
      endTime: '23:59',
      cameras: [], // Todas las cámaras por defecto
      plateSearch: '',
      confidenceMin: undefined,
      speedMin: undefined,
      speedMax: undefined,
      vehicleTypes: [],
      serverIds: []
    };
  });

  // Cargar eventos al cambiar filtros o página
  useEffect(() => {
    if (filters.startDate && filters.endDate) {
      searchEvents();
    }
  }, []);

  const searchEvents = async (page: number = 1) => {
    setIsLoading(true);
    setCurrentPage(page);
    
    try {
      // Primero buscar en base de datos local
      const localParams = new URLSearchParams();
      
      // Convertir fechas a timestamps
      const startTimestamp = Math.floor(
        new Date(`${filters.startDate}T${filters.startTime}`).getTime() / 1000
      );
      const endTimestamp = Math.floor(
        new Date(`${filters.endDate}T${filters.endTime}`).getTime() / 1000
      );
      
      localParams.set('after', startTimestamp.toString());
      localParams.set('before', endTimestamp.toString());
      localParams.set('limit', '50'); // Límite por página
      localParams.set('offset', ((page - 1) * 50).toString());
      
      // Filtros opcionales
      if (filters.plateSearch) {
        localParams.set('plate', filters.plateSearch);
      }
      
      if (filters.confidenceMin) {
        localParams.set('confidence_min', filters.confidenceMin.toString());
      }
      
      // Cámaras seleccionadas
      filters.cameras.forEach(camera => {
        const cameraName = camera.includes(':') ? camera.split(':')[1] : camera;
        localParams.append('camera', cameraName);
      });
      
      console.log('🔍 Buscando eventos LPR locales:', localParams.toString());
      
      // Intentar búsqueda local primero
      let localReadings: any[] = [];
      let hasLocalData = false;
      
      try {
        const localResponse = await fetch(`/api/lpr/readings?${localParams.toString()}`);
        if (localResponse.ok) {
          const localResult = await localResponse.json();
          localReadings = localResult.readings || [];
          hasLocalData = localReadings.length > 0;
          
          if (hasLocalData) {
            console.log(`✓ ${localReadings.length} lecturas locales encontradas`);
            
            // Convertir formato de BD local a LPREvent
            const convertedEvents = localReadings.map(reading => ({
              id: reading.event_id,
              serverId: reading.server_id,
              serverName: reading.server_name,
              camera: reading.camera,
              plate: reading.plate,
              timestamp: reading.timestamp,
              endTime: reading.end_time,
              speed: reading.speed,
              confidence: reading.confidence,
              vehicleType: reading.vehicle_type || 'unknown',
              direction: reading.direction || 'unknown',
              box: reading.box ? JSON.parse(reading.box) : undefined,
              has_clip: reading.has_clip,
              has_snapshot: reading.has_snapshot,
              score: reading.score,
              cropUrl: reading.local_files?.crop_url,
              // URLs locales si están disponibles
              snapshotUrl: reading.local_files?.snapshot_url,
              clipUrl: reading.local_files?.clip_url
            }));
            
            setSearchResult({
              events: convertedEvents,
              total: localResult.total,
              page: localResult.page,
              limit: localResult.limit,
              hasMore: localResult.hasMore,
              serverStatus: { local: 'online' }
            });
            
            if (page === 1) {
              setEvents(convertedEvents);
            } else {
              setEvents(prev => [...prev, ...convertedEvents]);
            }
            
            setIsLoading(false);
            return; // Usar datos locales, no consultar Frigate
          }
        }
      } catch (localError) {
        console.log('⚠️ Error consultando BD local, fallback a Frigate:', localError);
      }
      
      // Fallback: buscar en Frigate si no hay datos locales
      console.log('🔄 No hay datos locales, consultando Frigate...');
      
      const params = new URLSearchParams();
      params.set('after', startTimestamp.toString());
      params.set('before', endTimestamp.toString());
      params.set('page', page.toString());
      params.set('limit', '50');
      
      if (filters.plateSearch) {
        params.set('plate', filters.plateSearch);
      }
      
      if (filters.confidenceMin) {
        params.set('confidence_min', filters.confidenceMin.toString());
      }
      
      filters.cameras.forEach(camera => {
        params.append('camera', camera);
      });
      
      const response = await fetch(`/api/frigate/lpr/events?${params.toString()}`);
      const result: LPRSearchResult = await response.json();
      
      if (response.ok) {
        setSearchResult(result);
        
        if (page === 1) {
          setEvents(result.events);
        } else {
          setEvents(prev => [...prev, ...result.events]);
        }
        
        console.log(`✓ ${result.events.length} eventos Frigate cargados (página ${page})`);
      } else {
        console.error('Error en búsqueda:', result);
        setSearchResult({
          events: [],
          total: 0,
          page: 1,
          limit: 50,
          hasMore: false,
          serverStatus: {}
        });
        setEvents([]);
      }
      
    } catch (error) {
      console.error('Error buscando eventos:', error);
      setSearchResult({
        events: [],
        total: 0,
        page: 1,
        limit: 50,
        hasMore: false,
        serverStatus: {}
      });
      setEvents([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFiltersChange = (newFilters: LPRFiltersType) => {
    setFilters(newFilters);
  };

  const handleSearch = () => {
    setCurrentPage(1);
    searchEvents(1);
  };

  const handleLoadMore = () => {
    if (searchResult?.hasMore && !isLoading) {
      searchEvents(currentPage + 1);
    }
  };

  // Handlers para modales
  const handleViewSnapshot = (event: LPREvent) => {
    setSelectedEvent(event);
    setSnapshotModalOpen(true);
  };

  const handleViewClip = (event: LPREvent) => {
    setSelectedEvent(event);
    setClipModalOpen(true);
  };

  const handleDownloadSnapshot = (event: LPREvent) => {
    // Priorizar archivo local si está disponible
    if ((event as any).snapshotUrl) {
      const url = `${(event as any).snapshotUrl}?download=1`;
      window.open(url, '_blank');
    } else {
      // Fallback a URL de Frigate
      const url = `/api/frigate/lpr/snapshot?server=${event.serverId}&event=${event.id}&download=1`;
      
      // Verificar que el archivo existe antes de intentar descarga
      fetch(url, { method: 'HEAD' })
        .then(response => {
          if (response.ok) {
            window.open(url, '_blank');
          } else {
            alert('⚠️ El archivo snapshot no está disponible en el servidor.');
          }
        })
        .catch(() => {
          alert('❌ Error al verificar la disponibilidad del archivo.');
        });
    }
  };

  const handleDownloadClip = (event: LPREvent) => {
    if (!event.has_clip) {
      alert('⚠️ No hay video disponible para este evento.');
      return;
    }

    // Priorizar archivo local si está disponible
    if ((event as any).clipUrl) {
      const url = `${(event as any).clipUrl}?download=1`;
      window.open(url, '_blank');
    } else {
      // Fallback a URL de Frigate
      const url = `/api/frigate/lpr/clip?server=${event.serverId}&event=${event.id}&download=1`;
      
      // Verificar que el archivo existe antes de intentar descarga
      fetch(url, { method: 'HEAD' })
        .then(response => {
          if (response.ok) {
            window.open(url, '_blank');
          } else {
            alert('⚠️ El archivo de video no está disponible en el servidor.');
          }
        })
        .catch(() => {
          alert('❌ Error al verificar la disponibilidad del video.');
        });
    }
  };

  // Renderizar estado de servidores
  const renderServerStatus = () => {
    if (!searchResult?.serverStatus) return null;

    const statusEntries = Object.entries(searchResult.serverStatus);
    if (statusEntries.length === 0) return null;

    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Estado de Servidores</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {statusEntries.map(([serverId, status]) => (
              <Badge
                key={serverId}
                variant={status === 'online' ? 'default' : 'destructive'}
                className="flex items-center gap-1"
              >
                {status === 'online' && <CheckCircle className="h-3 w-3" />}
                {status === 'offline' && <XCircle className="h-3 w-3" />}
                {status === 'timeout' && <Timer className="h-3 w-3" />}
                {serverId} ({status})
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Matrículas</h1>
          <p className="text-gray-600 mt-1">
            Búsqueda y análisis de detecciones de matrículas en tiempo real
          </p>
        </div>
        
        {searchResult && (
          <div className="text-right">
            <div className="text-2xl font-bold text-blue-600">{searchResult.total}</div>
            <div className="text-sm text-gray-500">eventos encontrados</div>
          </div>
        )}
      </div>

      {/* Leyenda del sistema de confianza */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium mb-2">Sistema de Confianza</h3>
              <ConfidenceLegend />
            </div>
            <div className="text-xs text-gray-500">
              <Clock className="h-4 w-4 inline mr-1" />
              Última actualización: {new Date().toLocaleTimeString('es-ES')}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filtros de búsqueda */}
      <LPRFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onSearch={handleSearch}
        isLoading={isLoading}
      />

      {/* Estado de servidores */}
      {renderServerStatus()}

      {/* Alertas */}
      {searchResult && Object.values(searchResult.serverStatus).includes('offline') && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Algunos servidores no están disponibles. Los resultados pueden estar incompletos.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabla de resultados */}
      <LPRTable
        events={events}
        isLoading={isLoading && currentPage === 1}
        onViewSnapshot={handleViewSnapshot}
        onViewClip={handleViewClip}
        onDownloadSnapshot={handleDownloadSnapshot}
        onDownloadClip={handleDownloadClip}
      />

      {/* Paginación */}
      {searchResult && searchResult.hasMore && (
        <div className="flex justify-center py-6">
          <Button
            onClick={handleLoadMore}
            disabled={isLoading}
            variant="outline"
            size="lg"
          >
            {isLoading ? 'Cargando...' : 'Cargar más eventos'}
          </Button>
        </div>
      )}

      {/* Estadísticas finales */}
      {searchResult && events.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{events.length}</div>
                <div className="text-sm text-gray-500">Eventos mostrados</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{searchResult.total}</div>
                <div className="text-sm text-gray-500">Total encontrados</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-600">
                  {new Set(events.map(e => e.camera)).size}
                </div>
                <div className="text-sm text-gray-500">Cámaras activas</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">
                  {new Set(events.map(e => e.plate)).size}
                </div>
                <div className="text-sm text-gray-500">Matrículas únicas</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modales */}
      <LPRSnapshotModal
        event={selectedEvent}
        isOpen={snapshotModalOpen}
        onClose={() => {
          setSnapshotModalOpen(false);
          setSelectedEvent(null);
        }}
        onDownload={handleDownloadSnapshot}
      />

      <LPRClipModal
        event={selectedEvent}
        isOpen={clipModalOpen}
        onClose={() => {
          setClipModalOpen(false);
          setSelectedEvent(null);
        }}
        onDownload={handleDownloadClip}
      />
    </div>
  );
}