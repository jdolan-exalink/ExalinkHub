/**
 * Panel de LPR - Lista de eventos de matrículas
 * Lista todos los eventos de la tabla events de DB/Matriculas.db
 * Incluye buscador para filtrar por matrícula
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Search, RefreshCw, X, Calendar, Download, Home, Car, Bike, Truck, Bus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';

type LprEvent = {
  id: number;
  plate: string;
  camera: string;
  timestamp: number;
  server_name: string;
  speed: number | null;
  confidence: number;
  local_files: {
    snapshot_url: string | null;
    clip_url: string | null;
    crop_url: string | null;
  };
  zone: string;
  vehicle_type: string;
  traffic_light_status: string | null;
  false_positive: boolean;
};

export default function LprPanelPage() {
  const [events, setEvents] = useState<LprEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [totalEvents, setTotalEvents] = useState(0);
  const [editingPlate, setEditingPlate] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  // Estados para filtros de fecha
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  // Estados para modales
  const [imageModal, setImageModal] = useState<{ open: boolean; url: string; title: string }>({
    open: false,
    url: '',
    title: ''
  });
  const [videoModal, setVideoModal] = useState<{ open: boolean; url: string; title: string }>({
    open: false,
    url: '',
    title: ''
  });

  /**
   * Carga eventos LPR desde el backend mediante el endpoint proxy.
   * Aplica filtros de matrícula, rango de fechas y paginación.
   * 
   * @param plate_filter - Filtro de matrícula parcial (opcional)
   * @param start_datetime - Fecha/hora inicio en formato ISO (opcional)
   * @param end_datetime - Fecha/hora fin en formato ISO (opcional)
   * @param page - Número de página (por defecto 1)
   */
  const load_events = async (plate_filter?: string, start_datetime?: string, end_datetime?: string, page: number = 1) => {
    try {
      setLoading(true);
      const offset = (page - 1) * itemsPerPage;
      let url = `/api/lpr/readings?limit=${itemsPerPage}&offset=${offset}`;
      
      if (plate_filter && plate_filter.trim()) {
        url += `&plate=${encodeURIComponent(plate_filter.trim())}`;
      }
      
      // Convertir datetime ISO a timestamp Unix
      if (start_datetime) {
        const start_timestamp = Math.floor(new Date(start_datetime).getTime() / 1000);
        url += `&after=${start_timestamp}`;
      }
      
      if (end_datetime) {
        const end_timestamp = Math.floor(new Date(end_datetime).getTime() / 1000);
        url += `&before=${end_timestamp}`;
      }

      console.log('📡 Consultando:', url);
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log(`✅ Eventos recibidos: ${data.readings?.length || 0} de ${data.total || 0}`);
        setEvents(data.readings || []);
        setTotalEvents(data.total || 0);
        setCurrentPage(page);
      } else {
        console.error('❌ Error al cargar eventos:', response.statusText);
        setEvents([]);
        setTotalEvents(0);
      }
    } catch (error) {
      console.error('❌ Error al cargar eventos:', error);
      setEvents([]);
      setTotalEvents(0);
    } finally {
      setLoading(false);
    }
  };

  // Función para obtener fecha y hora combinadas
  const getDateTimeString = (date: Date | undefined, time: string): string | undefined => {
    if (!date) return undefined;
    const [hours, minutes] = time.split(':');
    const dateTime = new Date(date);
    dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    return dateTime.toISOString();
  };

  // Función para resetear a hoy y limpiar todos los filtros
  const resetToToday = () => {
    const today = new Date();
    setStartDate(today);
    setEndDate(today);
    setStartTime('00:00');
    setEndTime('23:59');
    setSearchTerm(''); // Limpiar búsqueda
    setCurrentPage(1);
  };

  // Función para navegar a la fecha anterior
  const navigateToPreviousDay = () => {
    if (startDate && endDate) {
      const newStartDate = new Date(startDate);
      const newEndDate = new Date(endDate);
      newStartDate.setDate(newStartDate.getDate() - 1);
      newEndDate.setDate(newEndDate.getDate() - 1);
      setStartDate(newStartDate);
      setEndDate(newEndDate);
      setCurrentPage(1);
    }
  };

  // Función para navegar a la fecha siguiente
  const navigateToNextDay = () => {
    if (startDate && endDate) {
      const newStartDate = new Date(startDate);
      const newEndDate = new Date(endDate);
      newStartDate.setDate(newStartDate.getDate() + 1);
      newEndDate.setDate(newEndDate.getDate() + 1);
      setStartDate(newStartDate);
      setEndDate(newEndDate);
      setCurrentPage(1);
    }
  };

  // Función para cambiar items por página
  const changeItemsPerPage = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Resetear a primera página
  };

  /**
   * Aplica los filtros de fecha/hora y reinicia la paginación a la primera página.
   */
  const apply_filters = () => {
    setCurrentPage(1); // Resetear a la primera página
    const start_datetime = getDateTimeString(startDate, startTime);
    const end_datetime = getDateTimeString(endDate, endTime);
    load_events(searchTerm, start_datetime, end_datetime, 1);
  };

  // Efecto para cargar eventos cuando cambian los filtros (sin currentPage para evitar loops)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1); // Resetear a página 1 cuando cambian filtros
      const start_datetime = getDateTimeString(startDate, startTime);
      const end_datetime = getDateTimeString(endDate, endTime);
      load_events(searchTerm, start_datetime, end_datetime, 1);
    }, 300); // Debounce de 300ms

    return () => clearTimeout(timeoutId);
  }, [searchTerm, startDate, endDate, startTime, endTime, itemsPerPage]); // Agregado itemsPerPage

  // Formatear timestamp
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('es-AR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Formatear confianza como porcentaje
  const formatConfidence = (confidence: number) => {
    return `${(confidence * 100).toFixed(1)}%`;
  };

  // Iniciar edición de matrícula
  const startEditing = (event: LprEvent) => {
    setEditingPlate(event.id);
    setEditValue(normalizePlate(event.plate));
  };

  // Guardar edición de matrícula
  const saveEditing = () => {
    if (editingPlate !== null && editValue.trim()) {
      setEvents(events.map(event =>
        event.id === editingPlate
          ? { ...event, plate: normalizePlate(editValue.trim()) }
          : event
      ));
    }
    setEditingPlate(null);
    setEditValue('');
  };

  // Cancelar edición
  const cancelEditing = () => {
    setEditingPlate(null);
    setEditValue('');
  };

  // Manejar tecla Enter/Escape en edición
  const handleEditKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEditing();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  // Abrir modal de imagen
  const openImageModal = (url: string, title: string) => {
    setImageModal({ open: true, url, title });
  };

  // Cerrar modal de imagen
  const closeImageModal = () => {
    setImageModal({ open: false, url: '', title: '' });
  };

  // Abrir modal de video
  const openVideoModal = (url: string, title: string) => {
    setVideoModal({ open: true, url, title });
  };

  // Cerrar modal de video
  const closeVideoModal = () => {
    setVideoModal({ open: false, url: '', title: '' });
  };

  // Función para exportar a XLSX
  const exportToXLSX = () => {
    if (events.length === 0) {
      alert('No hay datos para exportar');
      return;
    }

    const exportData = events.map(event => ({
      'ID': event.id,
      'Matrícula': event.plate && event.plate.trim() ? event.plate : 'N/A',
      'Cámara': event.camera,
      'Fecha/Hora': formatTimestamp(event.timestamp),
      'Servidor': event.server_name,
      'Velocidad (km/h)': event.speed != null ? Math.round(event.speed) : 'N/A',
      'Confianza (%)': `${(event.confidence * 100).toFixed(1)}%`,
      'Zona': event.zone,
      'Tipo de Vehículo': getVehicleTypeName(event.vehicle_type),
      'Semáforo': event.traffic_light_status || 'N/A',
      'Falso Positivo': event.false_positive ? 'Sí' : 'No'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Eventos LPR');

    // Generar nombre del archivo con fecha actual
    const now = new Date();
    const fileName = `eventos_lpr_${format(now, 'yyyy-MM-dd_HH-mm-ss')}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  // Función para obtener el icono del tipo de vehículo
  const getVehicleIcon = (vehicleType: string) => {
    const type = vehicleType.toLowerCase();
    switch (type) {
      case 'car':
      case 'auto':
        return <Car className="h-4 w-4" />;
      case 'motorcycle':
      case 'moto':
      case 'bike':
        return <Bike className="h-4 w-4" />;
      case 'truck':
      case 'camion':
        return <Truck className="h-4 w-4" />;
      case 'bus':
      case 'colectivo':
        return <Bus className="h-4 w-4" />;
      default:
        return <Car className="h-4 w-4" />; // Icono por defecto
    }
  };

  // Función para obtener el nombre legible del tipo de vehículo
  const getVehicleTypeName = (vehicleType: string) => {
    const type = vehicleType.toLowerCase();
    switch (type) {
      case 'car':
      case 'auto':
        return 'Auto';
      case 'motorcycle':
      case 'moto':
      case 'bike':
        return 'Moto';
      case 'truck':
      case 'camion':
        return 'Camión';
      case 'bus':
      case 'colectivo':
        return 'Colectivo';
      default:
        return vehicleType;
    }
  };

  /**
   * Normaliza una matrícula eliminando todo excepto letras y números.
   * Elimina espacios, guiones y caracteres especiales.
   */
  const normalizePlate = (plate: string): string => {
    if (!plate) return '';
    return plate.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  };

  /**
   * Convierte path interno del backend LPR a URL de API accesible.
   * Los paths vienen como: http://localhost:2221/media/helvecia/2025-10-19/...
   * Los convertimos a: /api/lpr/files/media/helvecia/2025-10-19/...
   */
  const to_internal_url = (url: string | null) => {
    if (!url) return null;
    
    // Si viene con http://localhost:2221/media/, extraer solo el path
    if (url.includes('http://localhost:2221/media/')) {
      const path = url.replace('http://localhost:2221/media/', '');
      return `/api/lpr/files/media/${path}`;
    }
    
    // Si ya es un path relativo, agregarlo a la ruta de API
    if (url.startsWith('/media/')) {
      return `/api/lpr/files${url}`;
    }
    
    return url;
  };

  return (
    <div className="w-full p-4 space-y-3">
      {/* Modal de imagen con overlay oscuro y zoom con rueda */}
      <Dialog open={imageModal.open} onOpenChange={closeImageModal}>
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden bg-background/95 backdrop-blur-sm border-2 relative">
          {/* Botón X único arriba a la derecha */}
          <Button aria-label="Cerrar" variant="ghost" size="sm" onClick={closeImageModal} className="absolute top-2 right-2 z-10 hover:bg-destructive hover:text-destructive-foreground">
            <X className="h-5 w-5" />
          </Button>
          <div className="flex flex-col items-center w-full">
            <div className="text-lg font-bold mb-2 flex items-center gap-2">📷 {imageModal.title}</div>
            <div className="flex justify-center items-center bg-black/90 rounded-lg p-4 min-h-[60vh]">
              {imageModal.url ? (
                <img
                  src={imageModal.url}
                  alt={imageModal.title || 'Snapshot'}
                  className="max-w-full max-h-[75vh] rounded-md border"
                  onError={e => { e.currentTarget.src = '/placeholder.png'; }}
                />
              ) : (
                <div className="text-xs text-muted-foreground">Sin imagen</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Panel LPR - Reconocimiento de Matrículas</h1>
          <p className="text-muted-foreground">
            Sistema de detección y registro de matrículas vehiculares en tiempo real
          </p>
        </div>
        <Button 
          onClick={() => {
            const start_datetime = getDateTimeString(startDate, startTime);
            const end_datetime = getDateTimeString(endDate, endTime);
            load_events(searchTerm, start_datetime, end_datetime, currentPage);
          }} 
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Buscador y Filtros - Compacto y estético */}
      <Card className="border-gray-300 shadow-sm ring-1 ring-gray-200 bg-gray-50">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Search className="h-4 w-4" />
            Buscar y Filtrar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4 pt-0">
          {/* Fila de búsqueda y controles */}
          <div className="flex flex-wrap gap-3 items-center">
            <Input
              placeholder="Ingrese matrícula (ej: ABC123)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 text-sm px-2 max-w-xs border-gray-300 bg-white focus:ring-2 focus:ring-blue-400"
              onKeyDown={e => e.key === 'Enter' && apply_filters()}
              title="Buscar por matrícula"
            />
            <span className="text-xs text-muted-foreground" title="Cantidad de eventos en la página">{events.length} / {totalEvents}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Mostrar:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => changeItemsPerPage(Number(e.target.value))}
                className="h-8 text-sm px-2 border border-gray-300 rounded bg-white"
                title="Seleccionar cantidad de elementos por página"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
              </select>
              <span className="text-xs text-muted-foreground">por página</span>
            </div>
            <Button onClick={resetToToday} variant="outline" size="sm" className="h-8 px-2">
              <Home className="h-4 w-4 mr-1" />Hoy
            </Button>
            <Button onClick={exportToXLSX} variant="outline" size="sm" className="h-8 px-2" disabled={totalEvents === 0}>
              <Download className="h-4 w-4 mr-1" />Exportar XLSX
            </Button>
            <Button onClick={apply_filters} variant="default" size="sm" className="h-8 px-3 ml-auto">
              Aplicar filtros
            </Button>
            <Button onClick={resetToToday} variant="ghost" size="sm" className="h-8 px-2 text-xs ml-1" title="Limpiar filtros">
              <X className="h-4 w-4" />
            </Button>
          </div>
          {/* Navegación temporal */}
          <div className="flex items-center gap-3 mt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={navigateToPreviousDay}
              disabled={loading}
              title="Día anterior"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
            </Button>
            <span className="font-medium text-sm">
              {startDate && endDate && startDate.toDateString() === endDate.toDateString()
                ? format(startDate, 'EEEE, dd/MM/yyyy', { locale: es })
                : `${startDate ? format(startDate, 'dd/MM/yyyy', { locale: es }) : ''} - ${endDate ? format(endDate, 'dd/MM/yyyy', { locale: es }) : ''}`
              }
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={navigateToNextDay}
              disabled={loading}
              title="Día siguiente"
            >
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          {/* Filtros de fecha - compactos y en grid */}
          <div className="grid grid-cols-3 gap-3 items-end mt-2">
            {/* Desde */}
            <div>
              <label className="block text-xs font-medium mb-1">Desde</label>
              <div className="relative">
                <Button
                  variant="outline"
                  className="w-full h-9 justify-start text-left font-normal text-sm border-gray-300 bg-white"
                  onClick={() => setShowStartCalendar(!showStartCalendar)}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, 'dd/MM/yyyy', { locale: es }) : 'Seleccionar fecha'}
                </Button>
                {showStartCalendar && (
                  <div className="absolute z-20 mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-2" style={{ minWidth: 220 }}>
                    <DayPicker
                      mode="single"
                      selected={startDate}
                      onSelect={(date) => {
                        setStartDate(date);
                        setShowStartCalendar(false);
                      }}
                      locale={es}
                      modifiersClassNames={{
                        today: 'bg-blue-100 text-blue-800 underline',
                        selected: 'bg-blue-600 text-white',
                      }}
                      className="rounded-md"
                    />
                  </div>
                )}
              </div>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-8 text-sm px-2 mt-1 border-gray-300 bg-white"
              />
            </div>
            {/* Hasta */}
            <div>
              <label className="block text-xs font-medium mb-1">Hasta</label>
              <div className="relative">
                <Button
                  variant="outline"
                  className="w-full h-9 justify-start text-left font-normal text-sm border-gray-300 bg-white"
                  onClick={() => setShowEndCalendar(!showEndCalendar)}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, 'dd/MM/yyyy', { locale: es }) : 'Seleccionar fecha'}
                </Button>
                {showEndCalendar && (
                  <div className="absolute z-20 mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-2" style={{ minWidth: 220 }}>
                    <DayPicker
                      mode="single"
                      selected={endDate}
                      onSelect={(date) => {
                        setEndDate(date);
                        setShowEndCalendar(false);
                      }}
                      locale={es}
                      modifiersClassNames={{
                        today: 'bg-blue-100 text-blue-800 underline',
                        selected: 'bg-blue-600 text-white',
                      }}
                      className="rounded-md"
                    />
                  </div>
                )}
              </div>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-8 text-sm px-2 mt-1 border-gray-300 bg-white"
              />
            </div>
            {/* Botón aplicar filtros */}
            <div className="flex flex-col gap-2 items-end">
              <Button onClick={apply_filters} className="h-9 w-full text-sm" color="blue">
                Aplicar filtros
              </Button>
              <Button onClick={resetToToday} variant="ghost" size="sm" className="h-8 px-2 text-xs" title="Limpiar filtros">
                Limpiar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de eventos */}
      <Card>
        <CardHeader className="py-2 px-3">
          <CardTitle className="text-base">Eventos de Matrículas</CardTitle>
        </CardHeader>
        <CardContent className="py-2 px-3">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2 text-sm">Cargando eventos...</span>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              {searchTerm ? 'No se encontraron eventos con esa matrícula' : 'No hay eventos registrados'}
            </div>
          ) : (
            <div className="max-h-[700px] overflow-y-auto space-y-0.5">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="border rounded p-1 hover:bg-muted/40 transition-colors space-y-0.5"
                >
                  {/* Línea 1: Crop, Matrícula, Fecha, Velocidad al lado de Cámara, Confianza al lado de Tipo, Zona */}
                  {/* Fila 1: Crop | Fecha/Hora | Velocidad | Cámara | Ver Clip */}
                  <div className="grid grid-cols-[100px_1fr_1fr_1fr_100px] gap-1 items-center">
                    {/* Crop */}
                    <div className="flex items-center justify-center">
                      {event.local_files.crop_url && event.local_files.snapshot_url ? (
                        <div 
                          className="w-[100px] h-[32px] flex items-center justify-center border border-primary/20 rounded bg-black/5 cursor-pointer hover:border-primary hover:shadow transition-all overflow-hidden"
                          onClick={() => {
                            const url = to_internal_url(event.local_files.snapshot_url);
                            if (url) openImageModal(url, `Snapshot - ${normalizePlate(event.plate || '')}`);
                          }}
                          title="Click para ver snapshot completo"
                        >
                          <img
                            src={to_internal_url(event.local_files.crop_url) || ''}
                            alt={`Crop ${event.plate}`}
                            className="max-w-full max-h-full object-contain"
                            onError={(e) => {
                              const parent = e.currentTarget.parentElement;
                              if (parent) parent.innerHTML = '<div class=\"text-xs text-muted-foreground\">Sin imagen</div>';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-[100px] h-[32px] flex items-center justify-center border rounded bg-muted/20">
                          <span className="text-xs text-muted-foreground">Sin imagen</span>
                        </div>
                      )}
                    </div>
                    {/* Fecha/Hora */}
                    <div className="flex flex-col items-center">
                      <div className="text-[10px] text-muted-foreground uppercase font-medium">Fecha/Hora</div>
                      <div className="text-xs font-mono">{formatTimestamp(event.timestamp)}</div>
                    </div>
                    {/* Velocidad */}
                    <div className="flex flex-col items-center">
                      <div className="text-[10px] text-muted-foreground uppercase font-medium">Velocidad</div>
                      <div className="text-xs font-semibold">
                        {(() => {
                          const speed = event.speed;
                          const speedStr = String(speed || '').trim().toLowerCase();
                          if (!speedStr || speedStr === '0' || speedStr === '0.0' || speedStr === 'null' || speedStr === 'undefined') {
                            return 'N/A';
                          }
                          const speedNum = parseFloat(speedStr);
                          if (isNaN(speedNum) || speedNum <= 0) {
                            return 'N/A';
                          }
                          return `${Math.round(speedNum)} km/h`;
                        })()}
                      </div>
                    </div>
                    {/* Cámara */}
                    <div className="flex flex-col items-center">
                      <div className="text-[10px] text-muted-foreground uppercase font-medium">Cámara</div>
                      <div className="text-xs font-semibold">{event.camera}</div>
                    </div>
                    {/* Ver Clip */}
                    <div className="flex items-center justify-center">
                      {event.local_files.clip_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const url = to_internal_url(event.local_files.clip_url);
                            if (url) openVideoModal(url, `Clip - ${normalizePlate(event.plate || '')}`);
                          }}
                          className="w-[90px] hover:bg-primary hover:text-primary-foreground transition-colors text-xs px-2 py-1 h-6"
                        >
                          🎬 Ver Clip
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Fila 2: Matrícula | Tipo | Confianza | Zona */}
                  <div className="grid grid-cols-[100px_1fr_1fr_1fr_100px] gap-1 items-center mt-0.5">
                    {/* Matrícula */}
                    <div className="flex items-center justify-center">
                      {editingPlate === event.id ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={saveEditing}
                          onKeyDown={handleEditKeyPress}
                          className="w-full text-base font-black text-center bg-background border border-primary rounded px-1 py-0.5 uppercase tracking-wider"
                          placeholder="ABC123"
                          autoFocus
                        />
                      ) : (
                        <div
                          className="w-full text-base font-black text-center cursor-pointer hover:bg-muted rounded px-1 py-0.5 uppercase tracking-wider border border-transparent hover:border-primary/50 transition-all"
                          onDoubleClick={() => startEditing(event)}
                          title="Doble click para editar"
                        >
                          {event.plate && event.plate.trim() ? normalizePlate(event.plate) : 'N/A'}
                        </div>
                      )}
                    </div>
                    {/* Tipo */}
                    <div className="flex items-center gap-1 text-xs justify-center">
                      {getVehicleIcon(event.vehicle_type)}
                      <span>{getVehicleTypeName(event.vehicle_type)}</span>
                    </div>
                    {/* Confianza */}
                    <div className="flex flex-col items-center">
                      <div className="text-[10px] text-muted-foreground uppercase font-medium">Confianza</div>
                      <Badge variant={Number(event.confidence) > 80 ? 'default' : 'secondary'} className="text-[10px] px-1 py-0">
                        {String(event.confidence) !== 'N/A' ? `${event.confidence}%` : 'N/A'}
                      </Badge>
                    </div>
                    {/* Zona */}
                    <div className="flex flex-col items-center">
                      <div className="text-[10px] text-muted-foreground uppercase font-medium">Zona</div>
                      <div className="text-xs">{event.zone}</div>
                    </div>
                    {/* Espacio vacío para alinear */}
                    <div></div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {/* Paginación siempre visible */}
          <div className="mt-4 pt-2 border-t">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-xs text-muted-foreground">
                {totalEvents > 0 ? (
                  <>
                    Mostrando <span className="font-semibold">{((currentPage - 1) * itemsPerPage) + 1}</span> a{' '}
                    <span className="font-semibold">{Math.min(currentPage * itemsPerPage, totalEvents)}</span> de{' '}
                    <span className="font-semibold">{totalEvents}</span> eventos totales
                  </>
                ) : (
                  <>Sin eventos para los filtros seleccionados</>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const new_page = currentPage - 1;
                    load_events(searchTerm, getDateTimeString(startDate, startTime), getDateTimeString(endDate, endTime), new_page);
                  }}
                  disabled={currentPage === 1 || loading || totalEvents === 0}
                >
                  ← Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {(() => {
                    const total_pages = Math.max(1, Math.ceil(totalEvents / itemsPerPage));
                    const pages_to_show: (number | string)[] = [];
                    if (total_pages <= 7) {
                      for (let i = 1; i <= total_pages; i++) {
                        pages_to_show.push(i);
                      }
                    } else {
                      pages_to_show.push(1);
                      if (currentPage > 3) {
                        pages_to_show.push('...');
                      }
                      for (let i = Math.max(2, currentPage - 1); i <= Math.min(total_pages - 1, currentPage + 1); i++) {
                        pages_to_show.push(i);
                      }
                      if (currentPage < total_pages - 2) {
                        pages_to_show.push('...');
                      }
                      pages_to_show.push(total_pages);
                    }
                    return pages_to_show.map((page, idx) => {
                      if (page === '...') {
                        return <span key={`ellipsis-${idx}`} className="px-1 text-muted-foreground">…</span>;
                      }
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => {
                            load_events(searchTerm, getDateTimeString(startDate, startTime), getDateTimeString(endDate, endTime), page as number);
                          }}
                          disabled={loading || totalEvents === 0}
                          className="min-w-[32px]"
                        >
                          {page}
                        </Button>
                      );
                    });
                  })()}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const new_page = currentPage + 1;
                    load_events(searchTerm, getDateTimeString(startDate, startTime), getDateTimeString(endDate, endTime), new_page);
                  }}
                  disabled={currentPage >= Math.ceil(totalEvents / itemsPerPage) || loading || totalEvents === 0}
                >
                  Siguiente →
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}