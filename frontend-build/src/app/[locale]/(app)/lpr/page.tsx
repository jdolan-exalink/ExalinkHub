/**
 * Panel de LPR - Lista de eventos de matrículas
 * Lista todos los eventos de la tabla events de DB/Matriculas.db
 * Incluye buscador para filtrar por matrícula
 */

'use client';

import React, { useEffect, useState } from 'react';
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
    
    // Si viene con http://localhost:2221/media/, extraer solo el path
    if (url.includes('http://localhost:2221/media/')) {
      const path = url.replace('http://localhost:2221/media/', '');
      const result = `/api/lpr/files/media/${path}`;
      console.log('✅ URL convertida:', result);
      return result;
    }
    
    // Si ya es un path relativo, agregarlo a la ruta de API
    if (url.startsWith('/media/')) {
      const result = `/api/lpr/files${url}`;
      console.log('✅ URL relativa convertida:', result);
      return result;
    }
    
    console.log('⚠️ URL no convertida, retornando original:', url);
    return url;
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