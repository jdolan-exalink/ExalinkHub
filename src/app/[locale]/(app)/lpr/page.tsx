/**
 * Panel de LPR - Lista de eventos de matrículas
 * Lista todos los eventos de la tabla events de DB/Matriculas.db
 * Incluye buscador para filtrar por matrícula
 */

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Search, RefreshCw, X, Calendar, Download, Home, Car, Bike, Truck, Bus, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogOverlay } from '@/components/ui/dialog';
import { DayPicker } from 'react-day-picker';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { debounce } from 'lodash';

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

// Componente de barra de filtros unificada
function LprFilterBar({
  value,
  onChange,
  onRefresh,
  onClear,
  page,
  totalPages,
  totalItems,
  pageSize,
  plate,
  fromDate,
  toDate,
  loading = false,
  onExport,
}: {
  value: { plate: string; fromDate?: Date; toDate?: Date; page: number; pageSize: number };
  onChange: (next: { plate: string; fromDate?: Date; toDate?: Date; page: number; pageSize: number }) => void;
  onRefresh: () => void;
  onClear: () => void;
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  plate: string;
  fromDate?: Date;
  toDate?: Date;
  loading?: boolean;
  onExport?: () => void;
}) {
  const [localPlate, setLocalPlate] = useState(plate ?? "");
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showEndCalendar, setShowEndCalendar] = useState(false);

  // Aplica filtros automáticamente con debounce
  const debouncedApply = useMemo(
    () => debounce((next) => onChange(next), 500),
    [onChange]
  );

  function handleChange(next: Partial<{ plate: string; fromDate?: Date; toDate?: Date; page: number; pageSize: number }>) {
    debouncedApply({
      plate: localPlate,
      fromDate,
      toDate,
      page,
      pageSize,
      ...next,
    });
  }

  // Función para formatear fecha para input
  function formatInputDate(d?: Date) {
    if (!d) return "";
    const pad = (n: number) => `${n}`.padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
      {/* fila principal */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Buscar */}
        <div className="flex items-center gap-2">
          <input
            value={localPlate}
            onChange={(e) => {
              setLocalPlate(e.target.value);
              handleChange({ plate: e.target.value, page: 1 });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                // Aplicar inmediatamente al presionar Enter
                onChange({
                  plate: localPlate,
                  fromDate,
                  toDate,
                  page: 1,
                  pageSize,
                });
              }
            }}
            placeholder="Ingrese matrícula (ej: ABC123)…"
            className="h-9 w-64 min-w-[220px] rounded-md border border-gray-300 bg-gray-50 px-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            title="Buscar por matrícula"
          />
          <button
            onClick={() => handleChange({ plate: "", page: 1 })}
            className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm hover:bg-gray-50"
            title="Limpiar búsqueda"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Rango de fechas */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="date"
              value={formatInputDate(fromDate)}
              onChange={(e) => handleChange({ fromDate: e.target.value ? new Date(e.target.value) : undefined, page: 1 })}
              className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              title="Fecha de inicio"
            />
          </div>
          <span className="text-gray-400">—</span>
          <div className="relative">
            <input
              type="date"
              value={formatInputDate(toDate)}
              onChange={(e) => handleChange({ toDate: e.target.value ? new Date(e.target.value) : undefined, page: 1 })}
              className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              title="Fecha de fin"
            />
          </div>
          <button
            onClick={() => {
              const now = new Date();
              const start = new Date(now);
              start.setHours(0, 0, 0, 0);
              const end = new Date(now);
              end.setHours(23, 59, 59, 999);
              handleChange({ fromDate: start, toDate: end, page: 1 });
            }}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm hover:bg-gray-50"
            title="Hoy"
          >
            <Home className="mr-1 inline h-4 w-4" />
            Hoy
          </button>
        </div>

        {/* Mostrar N / Exportar / Actualizar / Limpiar filtros */}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1 text-sm">
            <span className="text-gray-500">Mostrar:</span>
            <select
              value={pageSize}
              onChange={(e) => handleChange({ pageSize: Number(e.target.value), page: 1 })}
              className="h-9 rounded-md border border-gray-300 bg-white px-2 text-sm"
              title="Seleccionar cantidad de elementos por página"
            >
              <option>25</option>
              <option>50</option>
              <option>100</option>
            </select>
            <span className="text-gray-500">por página</span>
          </div>

          <button
            className="h-9 rounded-md border border-indigo-200 bg-indigo-50 px-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
            onClick={onExport}
            disabled={totalItems === 0}
          >
            <Download className="mr-1 inline h-4 w-4" />
            Exportar XLSX
          </button>

          {/* Actualizar dentro de la barra */}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="h-9 rounded-md bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            title="Actualizar"
          >
            <RefreshCw className={`mr-1 inline h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>

          {/* Cancelar/Limpiar filtros */}
          <button
            onClick={() => {
              onClear?.();
              setLocalPlate("");
            }}
            className="h-9 rounded-md border border-gray-300 bg-white px-3 text-sm hover:bg-gray-50"
            title="Limpiar filtros"
          >
            Limpiar
          </button>
        </div>

        {/* Línea 2: estado + paginación */}
        <div className="flex w-full items-center justify-between pt-1 text-sm text-gray-600">
          <span>
            Mostrando {Math.min(totalItems, (page - 1) * pageSize + 1)}–
            {Math.min(page * pageSize, totalItems)} de {totalItems} registros
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => handleChange({ page: page - 1 })}
              className="h-8 rounded-md border border-gray-300 bg-white px-2 disabled:opacity-40"
              title="Anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="mx-1 min-w-[60px] text-center">{page} / {Math.max(totalPages, 1)}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => handleChange({ page: page + 1 })}
              className="h-8 rounded-md border border-gray-300 bg-white px-2 disabled:opacity-40"
              title="Siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LprPanelPage() {
  console.log('🔄 Renderizando LprPanelPage');

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
  const [imageModal, setImageModal] = useState<{
    open: boolean;
    url: string;
    title: string;
    zoom: number;
    panX: number;
    panY: number;
    isDragging: boolean;
    dragStart: { x: number; y: number };
  }>({
    open: false,
    url: '',
    title: '',
    zoom: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    dragStart: { x: 0, y: 0 }
  });
  const [videoModal, setVideoModal] = useState<{
    open: boolean;
    url: string;
    title: string;
    zoom: number;
    panX: number;
    panY: number;
    isDragging: boolean;
    dragStart: { x: number; y: number };
  }>({
    open: false,
    url: '',
    title: '',
    zoom: 1,
    panX: 0,
    panY: 0,
    isDragging: false,
    dragStart: { x: 0, y: 0 }
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

  // Efecto para cargar eventos iniciales
  useEffect(() => {
    const start_datetime = getDateTimeString(startDate, startTime);
    const end_datetime = getDateTimeString(endDate, endTime);
    load_events(searchTerm, start_datetime, end_datetime, currentPage);
  }, []); // Solo al montar el componente

  // Log cuando cambian los eventos
  useEffect(() => {
    console.log('📊 Eventos actualizados:', events.length, 'eventos');
    if (events.length > 0) {
      console.log('🎯 Primer evento de ejemplo:', {
        id: events[0].id,
        plate: events[0].plate,
        urls: events[0].local_files
      });
    }
  }, [events]);

  // Log cuando cambian los modales
  useEffect(() => {
    console.log('🔍 Estado modal imagen:', { open: imageModal.open, url: imageModal.url, title: imageModal.title });
  }, [imageModal]);

  useEffect(() => {
    console.log('🎬 Estado modal video:', { open: videoModal.open, url: videoModal.url, title: videoModal.title });
  }, [videoModal]);

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

  // Estados para verificar existencia de archivos
  const [checkingFile, setCheckingFile] = useState<{ type: 'image' | 'video' | null; title: string }>({
    type: null,
    title: ''
  });

  // Estado para manejar errores de video
  const [videoError, setVideoError] = useState<string | null>(null);

  // Abrir modal de imagen con verificación previa
  const openImageModal = async (url: string, title: string) => {
    console.log('🖼️ Intentando abrir modal de imagen:', { url, title });
    setCheckingFile({ type: 'image', title });

    try {
      console.log('🔍 Verificando existencia del archivo:', url);
      const exists = await check_file_exists(url);
      console.log('✅ Resultado de verificación:', exists);
      
      if (exists) {
        console.log('🖼️ Abriendo modal de imagen:', { url, title });
        setImageModal({
          open: true,
          url,
          title,
          zoom: 1,
          panX: 0,
          panY: 0,
          isDragging: false,
          dragStart: { x: 0, y: 0 }
        });
        console.log('✅ Modal de imagen establecido como abierto');
      } else {
        alert(`❌ Error: El archivo de imagen no existe o no está disponible.\n\nArchivo: ${title}`);
      }
    } catch (error) {
      console.error('❌ Error verificando archivo de imagen:', error);
      alert(`❌ Error: No se pudo verificar la existencia del archivo de imagen.\n\nArchivo: ${title}`);
    } finally {
      setCheckingFile({ type: null, title: '' });
    }
  };

  // Cerrar modal de imagen
  const closeImageModal = () => {
    setImageModal({
      open: false,
      url: '',
      title: '',
      zoom: 1,
      panX: 0,
      panY: 0,
      isDragging: false,
      dragStart: { x: 0, y: 0 }
    });
  };

  // Abrir modal de video con verificación previa
  const openVideoModal = async (url: string, title: string) => {
    console.log('🎬 Intentando abrir modal de video:', { url, title });
    setCheckingFile({ type: 'video', title });

    try {
      console.log('🔍 Verificando existencia del archivo de video:', url);
      const exists = await check_file_exists(url);
      console.log('✅ Resultado de verificación de video:', exists);
      
      if (exists) {
        console.log('🎬 Abriendo modal de video:', { url, title });
        setVideoModal({
          open: true,
          url,
          title,
          zoom: 1,
          panX: 0,
          panY: 0,
          isDragging: false,
          dragStart: { x: 0, y: 0 }
        });
        console.log('✅ Modal de video establecido como abierto');
      } else {
        alert(`❌ Error: El archivo de video no existe o no está disponible.\n\nArchivo: ${title}`);
      }
    } catch (error) {
      console.error('❌ Error verificando archivo de video:', error);
      alert(`❌ Error: No se pudo verificar la existencia del archivo de video.\n\nArchivo: ${title}`);
    } finally {
      setCheckingFile({ type: null, title: '' });
    }
  };  // Cerrar modal de video
  const closeVideoModal = () => {
    setVideoModal({
      open: false,
      url: '',
      title: '',
      zoom: 1,
      panX: 0,
      panY: 0,
      isDragging: false,
      dragStart: { x: 0, y: 0 }
    });
    setVideoError(null);
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
    if (!url) {
      console.log('⚠️ to_internal_url: URL es null/undefined');
      return null;
    }

    console.log('🔄 Convirtiendo URL:', url);

    try {
      // Normalizar separadores
      const normalized = url.replace(/\\/g, '/');

      // Detectar cualquier host que apunte al puerto 2221 y contenga '/media/' (ej: http://localhost:2221/media/, http://matriculas-listener:2221/media/)
      const mediaMatch = normalized.match(/https?:\/\/[^/]+:2221\/media\/(.+)/i);
      if (mediaMatch && mediaMatch[1]) {
        const pathPart = mediaMatch[1];
        const result = `/api/lpr/files/media/${pathPart}`;
        console.log('✅ URL convertida desde host: ', result);
        return result;
      }

      // Si empieza con /media/ (ruta relativa), usar proxy
      if (normalized.startsWith('/media/')) {
        const result = `/api/lpr/files/media/${normalized.replace(/^\/media\//, '')}`;
        console.log('✅ URL relativa convertida:', result);
        return result;
      }

      // Si es ya el proxy interno, devolver tal cual
      if (normalized.startsWith('/api/lpr/files/')) {
        return normalized;
      }

      // Si es una URL http(s) a otro host sin /media/, retornarla (p. ej. URLs externas)
      if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
        console.log('⚠️ URL externa sin /media/, retornando original:', normalized);
        return normalized;
      }

      // Por defecto, asumir path relativo dentro de media
      const fallback = `/api/lpr/files/media/${normalized}`;
      console.log('ℹ️ Fallback a proxy media:', fallback);
      return fallback;
    } catch (err) {
      console.warn('⚠️ Error en to_internal_url:', err);
      return url;
    }
  };

  /**
   * Verifica si un archivo existe físicamente antes de intentar accederlo.
   * Realiza una petición HEAD para verificar la existencia sin descargar el archivo completo.
   * 
   * @param url - URL del archivo a verificar
   * @returns Promise<boolean> - true si el archivo existe, false si no
   */
  const check_file_exists = async (url: string): Promise<boolean> => {
    try {
      console.log('🔍 HEAD request to:', url);
      const response = await fetch(url, { method: 'HEAD' });
      console.log('🔍 Response status:', response.status, response.ok);
      return response.ok;
    } catch (error) {
      console.warn('⚠️ Error verificando existencia de archivo:', url, error);
      return false;
    }
  };

  // Funciones para el sistema de zoom del video
  const handleVideoZoom = (delta: number) => {
    setVideoModal(prev => ({
      ...prev,
      zoom: Math.max(0.5, Math.min(5, prev.zoom + delta))
    }));
  };

  const handleVideoPan = (deltaX: number, deltaY: number) => {
    setVideoModal(prev => ({
      ...prev,
      panX: prev.panX + deltaX,
      panY: prev.panY + deltaY
    }));
  };

  const resetVideoZoom = () => {
    setVideoModal(prev => ({
      ...prev,
      zoom: 1,
      panX: 0,
      panY: 0
    }));
  };

  const handleVideoMouseDown = (e: React.MouseEvent) => {
    if (videoModal.zoom > 1) {
      setVideoModal(prev => ({
        ...prev,
        isDragging: true,
        dragStart: { x: e.clientX - prev.panX, y: e.clientY - prev.panY }
      }));
    }
  };

  const handleVideoMouseMove = (e: React.MouseEvent) => {
    if (videoModal.isDragging) {
      const newPanX = e.clientX - videoModal.dragStart.x;
      const newPanY = e.clientY - videoModal.dragStart.y;
      setVideoModal(prev => ({
        ...prev,
        panX: newPanX,
        panY: newPanY
      }));
    }
  };

  const handleVideoMouseUp = () => {
    setVideoModal(prev => ({
      ...prev,
      isDragging: false
    }));
  };

  const handleVideoWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
    handleVideoZoom(zoomDelta);
  };

  const handleVideoDoubleClick = (e: React.MouseEvent) => {
    if (videoModal.zoom > 1) {
      resetVideoZoom();
    } else {
      // Zoom al doble click
      setVideoModal(prev => ({
        ...prev,
        zoom: 2
      }));
    }
  };

  // Funciones para el sistema de zoom de imagen (zoom mínimo 1.0)
  const handleImageZoom = (delta: number) => {
    setImageModal(prev => ({
      ...prev,
      zoom: Math.max(1, Math.min(5, prev.zoom + delta))
    }));
  };

  const handleImagePan = (deltaX: number, deltaY: number) => {
    setImageModal(prev => ({
      ...prev,
      panX: prev.panX + deltaX,
      panY: prev.panY + deltaY
    }));
  };

  const resetImageZoom = () => {
    setImageModal(prev => ({
      ...prev,
      zoom: 1,
      panX: 0,
      panY: 0
    }));
  };

  const handleImageMouseDown = (e: React.MouseEvent) => {
    if (imageModal.zoom > 1) {
      setImageModal(prev => ({
        ...prev,
        isDragging: true,
        dragStart: { x: e.clientX - prev.panX, y: e.clientY - prev.panY }
      }));
    }
  };

  const handleImageMouseMove = (e: React.MouseEvent) => {
    if (imageModal.isDragging) {
      const newPanX = e.clientX - imageModal.dragStart.x;
      const newPanY = e.clientY - imageModal.dragStart.y;
      setImageModal(prev => ({
        ...prev,
        panX: newPanX,
        panY: newPanY
      }));
    }
  };

  const handleImageMouseUp = () => {
    setImageModal(prev => ({
      ...prev,
      isDragging: false
    }));
  };

  const handleImageWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
    handleImageZoom(zoomDelta);
  };

  const handleImageDoubleClick = (e: React.MouseEvent) => {
    if (imageModal.zoom > 1) {
      resetImageZoom();
    } else {
      // Zoom al doble click
      setImageModal(prev => ({
        ...prev,
        zoom: 2
      }));
    }
  };

  return (
    <div className="w-full p-4 space-y-3">
      {/* Modal de imagen con sistema de zoom completo */}
      <Dialog open={imageModal.open} onOpenChange={closeImageModal}>
        <DialogOverlay className="bg-black/80 fixed inset-0 z-[9998]" />
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden bg-background border-2 relative z-[9999] shadow-2xl fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <DialogTitle className="sr-only">📷 {imageModal.title}</DialogTitle>
          <DialogDescription className="sr-only">
            Visualización de imagen con controles de zoom avanzados: rueda del mouse, arrastre, doble click y botones
          </DialogDescription>

          {/* Barra superior con controles */}
          <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between bg-black/50 backdrop-blur-sm rounded-lg p-2">
            <div className="text-lg font-bold text-white flex items-center gap-2">
              📷 {imageModal.title}
            </div>

            {/* Controles de zoom */}
            <div className="flex items-center gap-2">
              <div className="text-xs text-white/80 mr-2">
                Zoom: {imageModal.zoom.toFixed(1)}x
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleImageZoom(-0.5)}
                disabled={imageModal.zoom <= 1}
                className="h-8 w-8 p-0"
                title="Alejar"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={resetImageZoom}
                className="h-8 px-2 text-xs"
                title="Reset zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleImageZoom(0.5)}
                disabled={imageModal.zoom >= 5}
                className="h-8 w-8 p-0"
                title="Acercar"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            {/* Botón cerrar */}
            <Button
              aria-label="Cerrar"
              variant="secondary"
              size="sm"
              onClick={closeImageModal}
              className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Información de ayuda */}
          <div className="absolute bottom-2 left-2 z-20 bg-black/50 backdrop-blur-sm rounded-lg p-2 text-xs text-white/80 max-w-md">
            <div className="font-semibold mb-1">🎯 Controles de Zoom:</div>
            <div className="space-y-0.5 text-xs">
              <div>• <strong>Rueda mouse:</strong> Zoom in/out</div>
              <div>• <strong>Arrastrar:</strong> Mover imagen (zoom &gt; 1x)</div>
              <div>• <strong>Doble click:</strong> Zoom 2x / Reset</div>
              <div>• <strong>Botones:</strong> Zoom +, Zoom -, Reset</div>
            </div>
          </div>

          {/* Contenedor de la imagen con zoom */}
          <div className="flex justify-center items-center min-h-[70vh] mt-12 mb-8">
            <div
              className="relative overflow-hidden bg-black rounded-lg border cursor-move"
              style={{
                width: '100%',
                maxWidth: '800px',
                height: '60vh',
                maxHeight: '600px'
              }}
              onMouseDown={handleImageMouseDown}
              onMouseMove={handleImageMouseMove}
              onMouseUp={handleImageMouseUp}
              onMouseLeave={handleImageMouseUp}
              onWheel={handleImageWheel}
              onDoubleClick={handleImageDoubleClick}
            >
              {imageModal.url ? (
                <img
                  src={imageModal.url}
                  alt={imageModal.title || 'Snapshot'}
                  className="w-full h-full object-contain transition-transform duration-200 ease-out"
                  style={{
                    transform: `scale(${imageModal.zoom}) translate(${imageModal.panX / imageModal.zoom}px, ${imageModal.panY / imageModal.zoom}px)`,
                    transformOrigin: 'center center',
                    cursor: imageModal.zoom > 1 ? (imageModal.isDragging ? 'grabbing' : 'grab') : 'default'
                  }}
                  onError={e => {
                    console.error('Error cargando imagen:', e);
                    e.currentTarget.src = '/placeholder.png';
                  }}
                />
              ) : (
                <div className="text-white text-center p-4">Sin imagen</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de video con sistema de zoom completo */}
      <Dialog open={videoModal.open} onOpenChange={closeVideoModal}>
        <DialogOverlay className="bg-black/80 fixed inset-0 z-[9998]" />
        <DialogContent className="max-w-6xl max-h-[95vh] overflow-hidden bg-background border-2 relative z-[9999] shadow-2xl fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <DialogTitle className="sr-only">🎬 {videoModal.title}</DialogTitle>
          <DialogDescription className="sr-only">
            Reproductor de video con controles de zoom avanzados: rueda del mouse, arrastre, doble click y botones
          </DialogDescription>

          {/* Barra superior con controles */}
          <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between bg-black/50 backdrop-blur-sm rounded-lg p-2">
            <div className="text-lg font-bold text-white flex items-center gap-2">
              🎬 {videoModal.title}
            </div>

            {/* Controles de zoom */}
            <div className="flex items-center gap-2">
              <div className="text-xs text-white/80 mr-2">
                Zoom: {videoModal.zoom.toFixed(1)}x
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleVideoZoom(-0.5)}
                disabled={videoModal.zoom <= 0.5}
                className="h-8 w-8 p-0"
                title="Alejar"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={resetVideoZoom}
                className="h-8 px-2 text-xs"
                title="Reset zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleVideoZoom(0.5)}
                disabled={videoModal.zoom >= 5}
                className="h-8 w-8 p-0"
                title="Acercar"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            {/* Botón cerrar */}
            <Button
              aria-label="Cerrar"
              variant="secondary"
              size="sm"
              onClick={closeVideoModal}
              className="h-8 w-8 p-0 hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Información de ayuda */}
          <div className="absolute bottom-2 left-2 z-20 bg-black/50 backdrop-blur-sm rounded-lg p-2 text-xs text-white/80 max-w-md">
            <div className="font-semibold mb-1">🎯 Controles de Zoom:</div>
            <div className="space-y-0.5 text-xs">
              <div>• <strong>Rueda mouse:</strong> Zoom in/out</div>
              <div>• <strong>Arrastrar:</strong> Mover video (zoom &gt; 1x)</div>
              <div>• <strong>Doble click:</strong> Zoom 2x / Reset</div>
              <div>• <strong>Botones:</strong> Zoom +, Zoom -, Reset</div>
            </div>
          </div>

          {/* Contenedor del video con zoom */}
          <div className="flex justify-center items-center min-h-[70vh] mt-12 mb-8">
            <div
              className="relative overflow-hidden bg-black rounded-lg border cursor-move"
              style={{
                width: '100%',
                maxWidth: '800px',
                height: '60vh',
                maxHeight: '600px'
              }}
              onMouseDown={handleVideoMouseDown}
              onMouseMove={handleVideoMouseMove}
              onMouseUp={handleVideoMouseUp}
              onMouseLeave={handleVideoMouseUp}
              onWheel={handleVideoWheel}
              onDoubleClick={handleVideoDoubleClick}
            >
              {videoModal.url ? (
                videoError ? (
                  <div className="text-white text-center p-4">
                    Error al cargar el video: {videoError}
                  </div>
                ) : (
                  <video
                    src={videoModal.url}
                    controls
                    className="w-full h-full object-contain transition-transform duration-200 ease-out"
                    style={{
                      transform: `scale(${videoModal.zoom}) translate(${videoModal.panX / videoModal.zoom}px, ${videoModal.panY / videoModal.zoom}px)`,
                      transformOrigin: 'center center',
                      cursor: videoModal.zoom > 1 ? (videoModal.isDragging ? 'grabbing' : 'grab') : 'default'
                    }}
                    onError={e => {
                      console.error('Error cargando video:', e);
                      setVideoError('No se pudo cargar el video. Verifica que el archivo exista.');
                    }}
                    onLoadStart={() => setVideoError(null)}
                  >
                    Tu navegador no soporta el elemento de video.
                  </video>
                )
              ) : (
                <div className="text-white text-center p-4">Sin video</div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reconocimiento de Matrículas</h1>
        </div>
      </div>

      {/* Nueva barra de filtros unificada */}
      <LprFilterBar
        value={{
          plate: searchTerm,
          fromDate: startDate,
          toDate: endDate,
          page: currentPage,
          pageSize: itemsPerPage
        }}
        onChange={(newFilters) => {
          setSearchTerm(newFilters.plate);
          setStartDate(newFilters.fromDate);
          setEndDate(newFilters.toDate);
          setCurrentPage(newFilters.page);
          setItemsPerPage(newFilters.pageSize);

          // Aplicar filtros inmediatamente
          const start_datetime = newFilters.fromDate ? getDateTimeString(newFilters.fromDate, startTime) : undefined;
          const end_datetime = newFilters.toDate ? getDateTimeString(newFilters.toDate, endTime) : undefined;
          load_events(newFilters.plate, start_datetime, end_datetime, newFilters.page);
        }}
        onRefresh={() => {
          const start_datetime = getDateTimeString(startDate, startTime);
          const end_datetime = getDateTimeString(endDate, endTime);
          load_events(searchTerm, start_datetime, end_datetime, currentPage);
        }}
        onClear={() => {
          setSearchTerm('');
          setStartDate(new Date());
          setEndDate(new Date());
          setStartTime('00:00');
          setEndTime('23:59');
          setCurrentPage(1);
          load_events('', getDateTimeString(new Date(), '00:00'), getDateTimeString(new Date(), '23:59'), 1);
        }}
        onExport={exportToXLSX}
        page={currentPage}
        totalPages={Math.max(1, Math.ceil(totalEvents / itemsPerPage))}
        totalItems={totalEvents}
        pageSize={itemsPerPage}
        plate={searchTerm}
        fromDate={startDate}
        toDate={endDate}
        loading={loading}
      />

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
                          className={`w-[100px] h-[32px] flex items-center justify-center border rounded bg-black/5 cursor-pointer transition-all overflow-hidden ${
                            checkingFile.type === 'image' && checkingFile.title.includes(normalizePlate(event.plate || ''))
                              ? 'border-yellow-400 bg-yellow-50 animate-pulse'
                              : 'border-primary/20 hover:border-primary hover:shadow'
                          }`}
                          onClick={async () => {
                            console.log('🖼️ Click en crop detectado para evento:', event.id, event.plate);
                            const url = to_internal_url(event.local_files.snapshot_url);
                            console.log('🖼️ URL convertida para snapshot:', url);
                            if (url) {
                              await openImageModal(url, `Snapshot - ${normalizePlate(event.plate || '')}`);
                            } else {
                              console.error('❌ URL convertida es null/undefined');
                            }
                          }}
                          title={
                            checkingFile.type === 'image' && checkingFile.title.includes(normalizePlate(event.plate || ''))
                              ? 'Verificando archivo...'
                              : 'Click para ver snapshot completo'
                          }
                        >
                          {checkingFile.type === 'image' && checkingFile.title.includes(normalizePlate(event.plate || '')) ? (
                            <div className="flex items-center gap-1">
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              <span className="text-xs">Verificando...</span>
                            </div>
                          ) : (
                            <img
                              src={to_internal_url(event.local_files.crop_url) || ''}
                              alt={`Crop ${event.plate}`}
                              className="max-w-full max-h-full object-contain"
                              onError={(e) => {
                                const parent = e.currentTarget.parentElement;
                                if (parent) parent.innerHTML = '<div class=\"text-xs text-muted-foreground\">Sin imagen</div>';
                              }}
                            />
                          )}
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
                          onClick={async () => {
                            console.log('🎬 Click en botón Ver Clip detectado para evento:', event.id, event.plate);
                            const url = to_internal_url(event.local_files.clip_url);
                            console.log('🎬 URL convertida para clip:', url);
                            if (url) {
                              await openVideoModal(url, `Clip - ${normalizePlate(event.plate || '')}`);
                            } else {
                              console.error('❌ URL convertida es null/undefined para clip');
                            }
                          }}
                          disabled={checkingFile.type === 'video' && checkingFile.title.includes(normalizePlate(event.plate || ''))}
                          className="w-[90px] hover:bg-primary hover:text-primary-foreground transition-colors text-xs px-2 py-1 h-6"
                        >
                          {checkingFile.type === 'video' && checkingFile.title.includes(normalizePlate(event.plate || '')) ? (
                            <div className="flex items-center gap-1">
                              <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                              <span>Verificando...</span>
                            </div>
                          ) : (
                            <>🎬 Ver Clip</>
                          )}
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
        </CardContent>
      </Card>
    </div>
  );
}