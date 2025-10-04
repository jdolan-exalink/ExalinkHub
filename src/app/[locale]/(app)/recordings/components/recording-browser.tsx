"use client";

import { useState, useEffect, useMemo } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Search } from 'lucide-react';
import RecordingPlayer from '@/components/ui/recording-player';
import FrigateTimeline from '@/components/ui/frigate-timeline';
import ExportModal, { type ExportOptions } from '@/components/ui/export-modal';
import type { Camera } from '@/lib/types';
import type { RecordingTimelineData } from '@/lib/frigate-api';

interface RecordingBrowserProps {
  cameras: Camera[];
}

export default function RecordingBrowser({ cameras }: RecordingBrowserProps) {
  const translate_recordings_browser = useTranslations('recordings.browser');
  const locale_code = useLocale();
  const date_button_formatter = useMemo(() => new Intl.DateTimeFormat(locale_code, { day: '2-digit', month: '2-digit', year: 'numeric' }), [locale_code]);
  const detailed_datetime_formatter = useMemo(() => new Intl.DateTimeFormat(locale_code, { dateStyle: 'medium', timeStyle: 'short' }), [locale_code]);
  const time_formatter = useMemo(() => new Intl.DateTimeFormat(locale_code, { hour: '2-digit', minute: '2-digit', second: '2-digit' }), [locale_code]);
  // Validate cameras prop
  if (!cameras || !Array.isArray(cameras)) {
    return (
      <div className="h-screen bg-black flex items-center justify-center">
        <div className="text-white text-center">
          <div className="text-lg font-medium mb-2">{translate_recordings_browser('no_camera_title')}</div>
          <div className="text-sm text-gray-400">{translate_recordings_browser('no_camera_message')}</div>
        </div>
      </div>
    );
  }

  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date()); // Set to a date that has recordings
  const [selectedHour, setSelectedHour] = useState<number>(12); // Start at noon
  const [recordingData, setRecordingData] = useState<RecordingTimelineData | null>(null);
  const [selectedTime, setSelectedTime] = useState<number | undefined>();
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [timelineSelectionMode, setTimelineSelectionMode] = useState(false);
  const [previewTime, setPreviewTime] = useState<number | undefined>();
  const [downloadProgress, setDownloadProgress] = useState<{ [key: string]: { progress: number; status: string } }>({});
  const [daysWithRecordings, setDaysWithRecordings] = useState<Set<string>>(new Set());
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [showVideoControls, setShowVideoControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  const [availableObjectsInHour, setAvailableObjectsInHour] = useState<{label: string, count: number}[]>([]);

  // Auto-select first camera
  useEffect(() => {
    if (cameras && cameras.length > 0 && !selectedCamera) {
      setSelectedCamera(cameras[0].id || cameras[0].name);
    }
  }, [cameras, selectedCamera]);

  // Load days with recordings when camera changes
  useEffect(() => {
    if (selectedCamera) {
      loadDaysWithRecordings();
    }
  }, [selectedCamera]);

  // Fetch recordings when camera, date, or hour changes
  useEffect(() => {
    if (selectedCamera && selectedDate) {
      fetchRecordings();
    }
  }, [selectedCamera, selectedDate, selectedHour]);

  const loadDaysWithRecordings = async () => {
    if (!selectedCamera) return;
    
    try {
      // Load last 60 days to show recording availability
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(endDate.getDate() - 60);
      
      const response = await fetch(
        `/api/frigate/recordings/summary?camera=${encodeURIComponent(selectedCamera)}&after=${Math.floor(startDate.getTime() / 1000)}&before=${Math.floor(endDate.getTime() / 1000)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        const daysSet = new Set<string>();
        
        // Parse response to get dates with recordings
        Object.keys(data).forEach(dateStr => {
          if (data[dateStr]) {
            daysSet.add(dateStr);
          }
        });
        
        setDaysWithRecordings(daysSet);
      }
    } catch (error) {
      console.error('Error loading days with recordings:', error);
    }
  };

  // Auto-hide video controls
  const handleMouseMove = () => {
    setShowVideoControls(true);
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
    const timeout = setTimeout(() => {
      setShowVideoControls(false);
    }, 3000); // Hide after 3 seconds of inactivity
    setControlsTimeout(timeout);
  };

  const handleMouseLeave = () => {
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
    const timeout = setTimeout(() => {
      setShowVideoControls(false);
    }, 1000); // Hide after 1 second when mouse leaves
    setControlsTimeout(timeout);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
    };
  }, [controlsTimeout]);

  // Auto-play when time selection changes
  useEffect(() => {
    if (selectedTime) {
      console.log('🎬 RecordingBrowser: selectedTime changed:', {
        selectedTime,
        date: new Date(selectedTime * 1000).toISOString(),
        time: format(new Date(selectedTime * 1000), 'HH:mm:ss')
      });
      
      // Auto-play the video
      const videoElement = document.querySelector('video');
      if (videoElement) {
        setTimeout(() => {
          videoElement.play().catch(console.error);
        }, 500);
      }
    }
  }, [selectedTime]);

  const fetchRecordings = async () => {
    if (!selectedCamera || !selectedDate) return;

    setIsLoading(true);
    setError(null);

    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      const response = await fetch(
        `/api/frigate/recordings?camera=${encodeURIComponent(selectedCamera)}&date=${dateStr}`
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch recordings: ${response.status}`);
      }

      const data = await response.json();
      setRecordingData(data);
      
      // Auto-select time based on selected hour
      const dateAtMidnight = new Date(selectedDate);
      dateAtMidnight.setHours(selectedHour, 0, 0, 0);
      const hourTimestamp = Math.floor(dateAtMidnight.getTime() / 1000);
      setSelectedTime(hourTimestamp);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch recordings');
      setRecordingData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeSelect = (timestamp: number) => {
    console.log('🎯 RecordingBrowser: Event clicked, navigating to timestamp:', {
      timestamp,
      date: new Date(timestamp * 1000).toISOString(),
      time: format(new Date(timestamp * 1000), 'HH:mm:ss')
    });
    setSelectedTime(timestamp);
  };

  const handleRangeSelect = (start: number, end: number) => {
    setSelectionRange({ start, end });
  };

  const handleDownloadRequest = async (start: number, end: number) => {
    const downloadKey = `${start}-${end}`;
    
    // Mostrar progreso
    setDownloadProgress(prev => ({
      ...prev,
      [downloadKey]: { progress: 0, status: 'Iniciando descarga...' }
    }));

    try {
      // Usar directamente la URL VOD de Frigate sin el servidor proxy
      const frigateBaseUrl = 'http://10.1.1.252:5000'; // URL directa de Frigate
      const vodUrl = `${frigateBaseUrl}/vod/${encodeURIComponent(selectedCamera)}/start/${start}/end/${end}/master.m3u8`;
      
      console.log('Descargando directamente desde Frigate:', vodUrl);
      console.log('Parámetros:', {
        camera: selectedCamera,
        start,
        end,
        startDate: new Date(start * 1000).toISOString(),
        endDate: new Date(end * 1000).toISOString()
      });
      
      // Actualizar progreso
      setDownloadProgress(prev => ({
        ...prev,
        [downloadKey]: { progress: 25, status: 'Conectando con Frigate...' }
      }));

      // Hacer petición directa a Frigate
      const response = await fetch(vodUrl);
      
      if (!response.ok) {
        throw new Error(`Error de Frigate: ${response.status} ${response.statusText}`);
      }

      // Obtener el contenido M3U8
      const m3u8Content = await response.text();
      console.log('M3U8 content:', m3u8Content);

      // Actualizar progreso
      setDownloadProgress(prev => ({
        ...prev,
        [downloadKey]: { progress: 75, status: 'Procesando stream...' }
      }));

      // Crear un blob con el contenido M3U8
      const blob = new Blob([m3u8Content], { type: 'application/vnd.apple.mpegurl' });
      
      // Crear y descargar el archivo M3U8
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${selectedCamera}_${format(new Date(start * 1000), 'yyyy-MM-dd_HH-mm-ss')}_to_${format(new Date(end * 1000), 'HH-mm-ss')}.m3u8`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      // Completar progreso
      setDownloadProgress(prev => ({
        ...prev,
        [downloadKey]: { progress: 100, status: 'M3U8 descargado! (Usar con VLC o similar)' }
      }));

      // Mostrar información al usuario
      alert(`Se ha descargado el archivo M3U8.\n\nPara ver el video:\n1. Abre VLC Media Player\n2. Arrastra el archivo .m3u8 a VLC\n3. El video se reproducirá desde Frigate\n\nNota: Necesitas acceso a ${frigateBaseUrl} para que funcione.`);

      // Limpiar progreso después de 5 segundos
      setTimeout(() => {
        setDownloadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[downloadKey];
          return newProgress;
        });
      }, 5000);

    } catch (error) {
      console.error('Error en descarga:', error);
      
      // Mostrar error en progreso
      setDownloadProgress(prev => ({
        ...prev,
        [downloadKey]: { 
          progress: 0, 
          status: `Error: ${error instanceof Error ? error.message : 'Error desconocido'}` 
        }
      }));

      // Mostrar alerta de error
      alert(`Error al descargar video: ${error instanceof Error ? error.message : 'Error desconocido'}\n\nVerifica que:\n1. Frigate esté ejecutándose en 10.1.1.252:5000\n2. Existan grabaciones para el período seleccionado\n3. La cámara '${selectedCamera}' sea válida`);

      // Limpiar progreso después de 5 segundos
      setTimeout(() => {
        setDownloadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[downloadKey];
          return newProgress;
        });
      }, 5000);
    }
  };

  const handleDownloadRange = (start: number, end: number) => {
    handleDownloadRequest(start, end);
  };

  const handleExport = async (options: ExportOptions) => {
    try {
      let startTime: number, endTime: number;
      // Use date from selected recordings instead of current time
      const baseDate = new Date(selectedDate);
      const currentTimestamp = Math.floor(baseDate.getTime() / 1000) + (selectedHour * 3600);
      
      switch (options.type) {
        case 'last_hour':
          endTime = currentTimestamp;
          startTime = currentTimestamp - 3600; // 1 hour
          break;
        case 'last_4_hours':
          endTime = currentTimestamp;
          startTime = currentTimestamp - (4 * 3600); // 4 hours
          break;
        case 'last_8_hours':
          endTime = currentTimestamp;
          startTime = currentTimestamp - (8 * 3600); // 8 hours
          break;
        case 'last_12_hours':
          endTime = currentTimestamp;
          startTime = currentTimestamp - (12 * 3600); // 12 hours
          break;
        case 'last_24_hours':
          endTime = currentTimestamp;
          startTime = currentTimestamp - (24 * 3600); // 24 hours
          break;
        case 'custom':
          if (options.startDate && options.endDate && options.startTime && options.endTime) {
            const startDateTime = new Date(options.startDate);
            const [startHour, startMinute] = options.startTime.split(':');
            startDateTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
            
            const endDateTime = new Date(options.endDate);
            const [endHour, endMinute] = options.endTime.split(':');
            endDateTime.setHours(parseInt(endHour), parseInt(endMinute), 59, 999);
            
            startTime = Math.floor(startDateTime.getTime() / 1000);
            endTime = Math.floor(endDateTime.getTime() / 1000);
          } else {
            alert('Error: Rango de fecha personalizado no especificado');
            return;
          }
          break;
        default:
          alert('Error: Tipo de exportación inválido');
          return;
      }

      // Ensure we have valid timestamps
      if (!startTime || !endTime || startTime >= endTime) {
        alert('Error: Rango de tiempo inválido para exportación');
        return;
      }
      
      console.log('Export time range:', {
        startTime,
        endTime,
        startDate: new Date(startTime * 1000).toISOString(),
        endDate: new Date(endTime * 1000).toISOString(),
        selectedDate,
        selectedHour
      });
      
      // Cerrar modal y descargar
      setShowExportModal(false);
      await handleDownloadRequest(startTime, endTime);
      
    } catch (error) {
      console.error('Error en handleExport:', error);
      alert(`Error al procesar exportación: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  };

  const handleTimelineSelection = () => {
    setShowExportModal(false);
    setTimelineSelectionMode(true);
    // Clear any existing selection
    setSelectionRange(null);
  };

  const handlePreviewTime = (timestamp: number) => {
    if (timelineSelectionMode) {
      setPreviewTime(timestamp);
    }
  };

  const handleSelectionComplete = async () => {
    if (selectionRange && timelineSelectionMode) {
      // Export the selected range
      await handleDownloadRequest(selectionRange.start, selectionRange.end);
      
      // Exit selection mode
      setTimelineSelectionMode(false);
      setPreviewTime(undefined);
    }
  };

  const handleCancelSelection = () => {
    setTimelineSelectionMode(false);
    setSelectionRange(null);
    setPreviewTime(undefined);
  };

  // Filter recording data based on selected filter
  const filteredRecordingData = useMemo(() => {
    if (!recordingData || selectedFilter === 'all') return recordingData;
    
    return {
      ...recordingData,
      events: recordingData.events?.filter(event => {
        switch (selectedFilter) {
          case 'person':
            return event.label === 'person';
          case 'car':
            return event.label === 'car' || event.label === 'vehicle';
          case 'bike':
            return event.label === 'bicycle' || event.label === 'bike';
          case 'dog':
            return event.label === 'dog' || event.label === 'cat';
          default:
            return true;
        }
      }) || []
    };
  }, [recordingData, selectedFilter]);

  // Calculate available objects in current hour for filter dropdown
  const currentHourObjects = useMemo(() => {
    if (!recordingData?.events || !selectedTime) return { objects: [], totalCount: 0 };
    
    const currentHour = new Date(selectedTime * 1000).getHours();
    const hourStart = new Date(selectedTime * 1000);
    hourStart.setMinutes(0, 0, 0);
    const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);
    
    // Filter events in current hour
    const hourEvents = recordingData.events.filter(event => {
      const eventTime = new Date(event.start_time * 1000);
      return eventTime >= hourStart && eventTime < hourEnd;
    });
    
    // Count by object type
    const counts: {[key: string]: number} = {};
    hourEvents.forEach(event => {
      counts[event.label] = (counts[event.label] || 0) + 1;
    });
    
    // Convert to array and sort by count
    const objects = Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
    
    return {
      objects,
      totalCount: hourEvents.length
    };
  }, [recordingData, selectedTime]);

  // Object icon mapping
  const getObjectIcon = (label: string) => {
    const iconMap: {[key: string]: string} = {
      person: '👤',
      car: '🚗',
      vehicle: '🚗',
      truck: '🚛',
      bicycle: '🚲',
      bike: '🚲',
      motorcycle: '🏍️',
      bus: '🚌',
      dog: '🐕',
      cat: '🐱',
      bird: '🐦',
      package: '📦'
    };
    return iconMap[label] || '❓';
  };

  return (
    <div className="h-screen bg-black flex flex-col">
      {/* Barra de Controles Superiores */}
      <div className="bg-gray-900 border-b border-gray-700 flex-shrink-0">
        {/* Controles */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Controles Izquierda: Cámara, Hora, Fecha */}
            <div className="flex items-center gap-6">
              <h1 className="text-white font-semibold text-lg mr-4">Grabaciones</h1>
              
              {/* Selector de Cámara */}
              <div className="flex items-center gap-2">
                <span className="text-white font-medium text-sm">Cámara:</span>
                <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                  <SelectTrigger className="w-48 h-9 bg-blue-600 border-blue-500 text-white font-medium hover:bg-blue-700">
                    <SelectValue placeholder="Seleccionar cámara" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    {cameras && cameras.length > 0 ? cameras.map(camera => (
                      <SelectItem 
                        key={camera.id || camera.name} 
                        value={camera.id || camera.name}
                        className="text-white hover:bg-blue-600"
                      >
                        {camera.name}
                      </SelectItem>
                    )) : (
                      <SelectItem value="no-cameras" disabled className="text-gray-400">
                        No hay cámaras disponibles
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Selector de Hora */}
              <div className="flex items-center gap-2">
                <span className="text-white font-medium text-sm">Hora:</span>
                <Select value={selectedHour.toString()} onValueChange={(value) => setSelectedHour(parseInt(value))}>
                  <SelectTrigger className="w-24 h-9 bg-green-600 border-green-500 text-white font-medium hover:bg-green-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem 
                        key={i} 
                        value={i.toString()}
                        className="text-white hover:bg-green-600"
                      >
                        {i.toString().padStart(2, '0')}:00
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Calendario */}
              <div className="flex items-center gap-2">
                <span className="text-white font-medium text-sm">Fecha:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-40 h-9 bg-purple-600 border-purple-500 text-white hover:bg-purple-700 justify-start text-left font-medium"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date_button_formatter.format(selectedDate)}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-gray-800 border-gray-600" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => date && setSelectedDate(date)}
                      disabled={(date) => date > new Date() || date < new Date("2020-01-01")}
                      initialFocus
                      className="bg-gray-800 text-white"
                      modifiers={{
                        recording: (date) => {
                          const dateStr = format(date, 'yyyy-MM-dd');
                          return daysWithRecordings.has(dateStr);
                        }
                      }}
                      modifiersStyles={{
                        recording: { 
                          backgroundColor: '#dc2626', 
                          color: 'white',
                          fontWeight: 'bold',
                          position: 'relative'
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Controles Derecha: Filtros y Estado */}
            <div className="flex items-center gap-4">
              {/* Filtro de Detecciones */}
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-white" />
                <span className="text-white font-medium text-sm">Filtros:</span>
                <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                  <SelectTrigger className="w-40 h-9 bg-orange-600 border-orange-500 text-white font-medium hover:bg-orange-700">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-600">
                    <SelectItem value="all" className="text-white hover:bg-orange-600">
                      🔍 Todos ({currentHourObjects.totalCount})
                    </SelectItem>
                    {currentHourObjects.objects.map(obj => (
                      <SelectItem key={obj.label} value={obj.label} className="text-white hover:bg-orange-600">
                        {getObjectIcon(obj.label)} {obj.label.charAt(0).toUpperCase() + obj.label.slice(1)} ({obj.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Estado */}
              <div className="flex items-center gap-2">
                {isLoading && (
                  <div className="text-yellow-400 text-sm font-medium">⏳ Cargando...</div>
                )}
                {error && (
                  <div className="text-red-400 text-sm font-medium">❌ Error: {error}</div>
                )}
                {recordingData && (
                  <div className="text-green-400 text-sm font-medium">
                    📹 {recordingData.segments?.length || 0} grabaciones • 🎯 {recordingData.events?.length || 0} eventos
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Indicators */}
      {Object.keys(downloadProgress).length > 0 && (
        <div className="bg-gray-900 border-b border-gray-700 px-4 py-2 flex-shrink-0">
          <div className="flex gap-4">
            {Object.entries(downloadProgress).map(([key, progress]) => (
              <div key={key} className="flex-1 max-w-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-blue-300 text-xs">{progress.status}</span>
                  <span className="text-blue-300 text-xs">{progress.progress}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1">
                  <div 
                    className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                    style={{ width: `${progress.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content Area - Video Player y Timeline */}
      <div className="flex-1 flex items-start justify-start bg-black px-4 py-2 min-h-0 overflow-hidden">
        {/* Contenedor principal alineado a la izquierda */}
        <div className="flex flex-col items-start justify-start gap-2">
          {/* Video container con aspecto 16:9 */}
          <div 
            className="bg-black relative"
            style={{
              width: 'calc((100vh - 280px - 80px) * 16 / 9)', // Calculamos ancho basado en altura disponible (header ~80px)
              height: 'calc(100vh - 280px - 80px)', // Altura disponible para video (restamos header y controles de video)
              maxWidth: '100%',
              aspectRatio: '16/9'
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            <RecordingPlayer
              camera={selectedCamera}
              timestamp={timelineSelectionMode && previewTime ? previewTime : selectedTime}
              selectionRange={selectionRange}
              onDownloadRequest={handleDownloadRequest}
              playbackSpeed={playbackSpeed}
              onPlaybackSpeedChange={setPlaybackSpeed}
              showExportButton={true}
              onExportClick={() => setShowExportModal(true)}
              className="w-full h-full"
            />
            
            {/* Controles de Video Overlay - Auto-ocultables */}
            <div className={`absolute top-4 left-4 right-4 transition-opacity duration-300 z-20 ${
              showVideoControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}>
              <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3">
                <div className="flex items-center justify-between">
                  {/* Información de la cámara */}
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                    <span className="text-white font-semibold">{selectedCamera}</span>
                    <span className="text-gray-300 text-sm">
                      {selectedTime ? detailed_datetime_formatter.format(new Date(selectedTime * 1000)) : ''}
                    </span>
                  </div>
                  
                  {/* Controles de reproducción */}
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm">Velocidad:</span>
                    <Select value={playbackSpeed.toString()} onValueChange={(value) => setPlaybackSpeed(parseFloat(value))}>
                      <SelectTrigger className="w-20 h-8 bg-gray-700 border-gray-600 text-white text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-600">
                        <SelectItem value="0.25" className="text-white hover:bg-gray-700">0.25x</SelectItem>
                        <SelectItem value="0.5" className="text-white hover:bg-gray-700">0.5x</SelectItem>
                        <SelectItem value="1" className="text-white hover:bg-gray-700">1x</SelectItem>
                        <SelectItem value="2" className="text-white hover:bg-gray-700">2x</SelectItem>
                        <SelectItem value="4" className="text-white hover:bg-gray-700">4x</SelectItem>
                        <SelectItem value="6" className="text-white hover:bg-gray-700">6x</SelectItem>
                        <SelectItem value="8" className="text-white hover:bg-gray-700">8x</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button
                      onClick={() => setShowExportModal(true)}
                      className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-3 text-sm"
                    >
                      Exportar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Overlay para preview time */}
            {timelineSelectionMode && previewTime && (
              <div className="absolute top-4 left-4 bg-black/80 text-white px-2 py-1 rounded text-xs z-10">
                Vista previa: {time_formatter.format(new Date(previewTime * 1000))}
              </div>
            )}
            
            {/* Overlay para controles de selección */}
            {timelineSelectionMode && (
              <div className="absolute top-4 right-4 bg-blue-600/90 border border-blue-400 rounded-lg p-2 z-10">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-300 rounded-full animate-pulse"></div>
                  <span className="text-white font-medium text-xs">Modo Selección</span>
                  {selectionRange && (
                    <span className="text-blue-100 text-xs">
                      {time_formatter.format(new Date(selectionRange.start * 1000))} - {time_formatter.format(new Date(selectionRange.end * 1000))}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 mt-2">
                  {selectionRange && (
                    <Button
                      onClick={handleSelectionComplete}
                      className="bg-green-600 hover:bg-green-700 text-white h-6 px-2 text-xs"
                    >
                      Descargar
                    </Button>
                  )}
                  <Button
                    onClick={handleCancelSelection}
                    variant="outline"
                    className="border-gray-300 text-gray-100 hover:bg-gray-700 h-6 px-2 text-xs"
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Timeline Section - Mismo ancho que el video */}
          <div 
            className="bg-gray-800 border border-gray-600 rounded-lg p-3"
            style={{
              width: 'calc((100vh - 280px - 80px) * 16 / 9)', // Mismo ancho que el video
              maxWidth: '100%'
            }}
          >
            <div className="h-16">
              <FrigateTimeline
                data={filteredRecordingData}
                camera={selectedCamera}
                onTimeSelect={handleTimeSelect}
                onRangeSelect={handleRangeSelect}
                onDownloadRange={handleDownloadRange}
                selectedTime={selectedTime}
                selectionRange={selectionRange}
                selectionMode={timelineSelectionMode}
                onPreviewTime={handlePreviewTime}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        selectedCamera={selectedCamera}
        selectedDate={selectedDate}
        selectedHour={selectedHour}
        onExport={handleExport}
        onTimelineSelection={handleTimelineSelection}
      />
    </div>
  );
}



