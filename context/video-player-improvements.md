# Video Player - Mejoras de Reproducción

## Problema Identificado
El sistema presentaba errores de tipo "NotSupportedError: The element has no supported sources" al intentar reproducir videos de eventos de Frigate.

## Causas del Problema

### 1. Content-Disposition Header
**Ubicación**: `src/app/api/frigate/events/[id]/clip.mp4/route.ts`

El endpoint estaba configurado con el header `Content-Disposition: attachment` que forzaba la descarga del archivo en lugar de permitir la reproducción en línea.

**Solución Implementada**:
```typescript
// ANTES (problemático)
headers: {
  'Content-Type': 'video/mp4',
  'Content-Disposition': `attachment; filename="event_${eventId}.mp4"`,
  'Content-Length': buffer.length.toString(),
}

// DESPUÉS (correcto para streaming)
headers: {
  'Content-Type': 'video/mp4',
  'Content-Length': buffer.length.toString(),
  'Accept-Ranges': 'bytes',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
}
```

### 2. Manejo de Errores Insuficiente
**Ubicación**: `src/components/ui/event-player.tsx`

El elemento video no tenía manejo detallado de errores de carga y reproducción.

## Mejoras Implementadas

### 1. Enhanced Video Element
```typescript
/**
 * Elemento video mejorado con manejo detallado de errores y diagnósticos
 */
<video
  ref={videoRef}
  className={`w-full h-full object-contain ${showThumbnail ? 'hidden' : 'block'}`}
  preload="metadata"
  playsInline
  onError={(e) => {
    console.error('EventPlayer: Video error:', e);
    const video = e.target as HTMLVideoElement;
    if (video.error) {
      console.error('EventPlayer: Video error details:', {
        code: video.error.code,
        message: video.error.message,
        source: video.src
      });
      
      let errorMsg = 'Error al reproducir video';
      switch (video.error.code) {
        case video.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
          errorMsg = 'Formato de video no soportado';
          break;
        case video.error.MEDIA_ERR_NETWORK:
          errorMsg = 'Error de red al cargar video';
          break;
        case video.error.MEDIA_ERR_DECODE:
          errorMsg = 'Error al decodificar video';
          break;
        case video.error.MEDIA_ERR_ABORTED:
          errorMsg = 'Carga de video interrumpida';
          break;
      }
      setError(errorMsg);
    }
    setShowThumbnail(true);
    setIsPlaying(false);
  }}
  // ... otros event handlers
/>
```

### 2. Improved Clip Loading Function
```typescript
/**
 * Función mejorada para cargar clips de video con mejor manejo de errores
 * y reset del estado del elemento video
 */
const load_event_clip = async () => {
  if (!event || !videoRef.current) return;
  
  setIsLoading(true);
  setError(null);
  
  try {
    const clip_url = `/api/frigate/events/${event.id}/clip.mp4`;
    console.log('EventPlayer: Loading clip for event:', event.id, clip_url);
    
    // Test if clip is available with timeout
    const controller = new AbortController();
    const timeout_id = setTimeout(() => controller.abort(), 10000);
    
    try {
      const test_response = await fetch(clip_url, { 
        method: 'HEAD',
        signal: controller.signal
      });
      clearTimeout(timeout_id);
      
      if (test_response.ok) {
        console.log('EventPlayer: Clip HEAD request successful, Content-Type:', 
                   test_response.headers.get('Content-Type'));
        
        // Reset video element before setting new source
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        videoRef.current.src = '';
        videoRef.current.load(); // Reset video element state
        
        // Set new source with cache-busting parameter
        const timestamp = Date.now();
        videoRef.current.src = `${clip_url}?t=${timestamp}`;
        
        setShowThumbnail(true);
        console.log('EventPlayer: Clip URL set successfully for event:', event.id);
      } else {
        console.warn('EventPlayer: Clip not available for event:', event.id, 
                    'Status:', test_response.status);
        setError(`Video clip no disponible (HTTP ${test_response.status})`);
        setShowThumbnail(true);
      }
    } catch (fetch_error: any) {
      clearTimeout(timeout_id);
      
      if (fetch_error.name === 'AbortError') {
        console.warn('EventPlayer: Clip load timeout for event:', event.id);
        setError('Timeout al cargar video - servidor ocupado');
      } else {
        console.error('EventPlayer: Fetch error for event:', event.id, fetch_error);
        setError('Error al verificar disponibilidad del clip');
      }
      setShowThumbnail(true);
    }
    
  } catch (err: any) {
    console.error('EventPlayer: Unexpected error loading clip for event:', event.id, err);
    setError('Error inesperado al cargar clip de video');
    setShowThumbnail(true);
  } finally {
    setIsLoading(false);
  }
};
```

### 3. Enhanced Play/Pause Handler
```typescript
/**
 * Función mejorada para manejar play/pause con validación de estado del video
 */
const handle_play_pause = async () => {
  if (!videoRef.current || !event?.has_clip) return;
  
  if (showThumbnail) {
    setShowThumbnail(false);
  }
  
  try {
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      // Ensure video is ready to play
      if (videoRef.current.readyState < 2) {
        console.log('EventPlayer: Video not ready, waiting for metadata...');
        setIsLoading(true);
        await new Promise((resolve, reject) => {
          const video = videoRef.current!;
          const timeout = setTimeout(() => {
            reject(new Error('Video load timeout'));
          }, 5000);
          
          const on_loaded_data = () => {
            clearTimeout(timeout);
            video.removeEventListener('loadeddata', on_loaded_data);
            video.removeEventListener('error', on_error);
            resolve(void 0);
          };
          
          const on_error = () => {
            clearTimeout(timeout);
            video.removeEventListener('loadeddata', on_loaded_data);
            video.removeEventListener('error', on_error);
            reject(new Error('Video load error'));
          };
          
          video.addEventListener('loadeddata', on_loaded_data);
          video.addEventListener('error', on_error);
          
          if (video.readyState >= 2) {
            on_loaded_data();
          }
        });
        setIsLoading(false);
      }
      
      await videoRef.current.play();
      console.log('EventPlayer: Video playback started successfully');
    }
    setIsPlaying(!isPlaying);
  } catch (play_error: any) {
    console.error('EventPlayer: Play error:', play_error);
    setError(`Error al reproducir: ${play_error.message}`);
    setShowThumbnail(true);
    setIsPlaying(false);
    setIsLoading(false);
  }
};
```

## Características Técnicas Implementadas

### Headers HTTP Optimizados
- **Accept-Ranges**: `bytes` - Permite reproducción por rangos de bytes
- **Cache-Control**: `no-cache, no-store, must-revalidate` - Evita problemas de caché
- **Content-Type**: `video/mp4` - Especifica correctamente el tipo MIME
- **Sin Content-Disposition**: Permite reproducción en línea

### Atributos Video HTML5
- **preload**: `metadata` - Carga metadatos sin descargar video completo
- **playsInline**: Evita pantalla completa automática en móviles
- **object-contain**: Mantiene proporción del video

### Diagnósticos Mejorados
- Logging detallado de errores con códigos específicos
- Mensajes de error localizados en español
- Reset completo del estado del video entre cargas
- Cache-busting con timestamp para evitar caché

### Manejo de Estados Asíncrono
- Validación de `readyState` antes de reproducción
- Timeouts para evitar cuelgues
- Promises para operaciones asíncronas de video
- Cleanup apropiado de event listeners

## Archivos Modificados

1. **src/app/api/frigate/events/[id]/clip.mp4/route.ts**
   - Removido Content-Disposition header
   - Añadidos headers para streaming optimizado

2. **src/components/ui/event-player.tsx**
   - Mejorado manejo de errores del elemento video
   - Implementado reset completo del video entre cargas
   - Añadido manejo asíncrono de reproducción
   - Mejorados logs y diagnósticos

## Resultado
- ✅ Resolución del error "NotSupportedError"
- ✅ Reproducción en línea de videos de eventos
- ✅ Manejo robusto de errores con mensajes descriptivos
- ✅ Mejor experiencia de usuario con indicadores de carga
- ✅ Logs detallados para debugging futuro

## Próximas Mejoras Potenciales
- Implementar fallbacks para diferentes formatos de video
- Añadir subtítulos o overlays de información del evento
- Optimizar para dispositivos móviles con controles táctiles
- Implementar precarga inteligente de videos siguientes
- **✅ Soporte de temas (themes) en grabaciones**: Permitir ajustes de imagen como en vista en vivo

## Soporte de Temas en Grabaciones

### Problema Identificado
Las grabaciones de eventos no soportaban los ajustes de imagen (temas) que estaban disponibles en la vista en vivo, limitando la capacidad de mejorar la calidad visual de los videos grabados.

### Solución Implementada
Se agregó funcionalidad de mejora de imagen a `event-player.tsx` similar a la implementada en `camera-feed.tsx` para vista en vivo.

#### Características Implementadas

##### 1. Estado de Mejora de Imagen
```typescript
const [imageEnhancement, setImageEnhancement] = useState({
  sharpness: 1.0,
  contrast: 1.0,
  brightness: 1.0,
  saturation: 1.0
});
```

##### 2. Funciones de Control de Tema
```typescript
const toggleSharpness = () => {
  setImageEnhancement(prev => {
    const newSharpness = prev.sharpness === 1.0 ? 1.8 : 1.0;
    console.log('EventPlayer: Sharpness toggled:', prev.sharpness, '->', newSharpness);
    return {
      ...prev,
      sharpness: newSharpness
    };
  });
};

const toggleContrast = () => {
  setImageEnhancement(prev => {
    const newContrast = prev.contrast === 1.0 ? 1.4 : 1.0;
    console.log('EventPlayer: Contrast toggled:', prev.contrast, '->', newContrast);
    return {
      ...prev,
      contrast: newContrast
    };
  });
};
```

##### 3. Función Helper para Construir Filtros CSS
```typescript
// Helper function to build CSS filter string
const buildFilterString = () => {
  const filters = [];
  if (imageEnhancement.contrast !== 1.0) filters.push(`contrast(${imageEnhancement.contrast})`);
  if (imageEnhancement.brightness !== 1.0) filters.push(`brightness(${imageEnhancement.brightness})`);
  if (imageEnhancement.saturation !== 1.0) filters.push(`saturate(${imageEnhancement.saturation})`);
  if (imageEnhancement.sharpness > 1.0) filters.push('url(#sharpen)');
  
  const filterString = filters.join(' ');
  console.log('EventPlayer: Built filter string:', filterString, 'from:', imageEnhancement);
  return filterString;
};
```

##### 4. Aplicación de Filtros CSS
Los filtros se aplican tanto al elemento video como a las imágenes de snapshot usando la función helper:
```typescript
style={{
  filter: buildFilterString()
}}
```

##### 4. Controles de UI
Se agregaron botones de control en la barra de controles inferior:
```tsx
{/* Theme Controls */}
<div className="flex items-center gap-1 bg-black/70 rounded px-1">
  <Button
    variant="ghost"
    size="sm"
    onClick={toggleSharpness}
    className="text-white hover:bg-white/20 h-6 w-6 p-0 text-xs"
    title="Toggle sharpness"
  >
    S
  </Button>
  <Button
    variant="ghost"
    size="sm"
    onClick={toggleContrast}
    className="text-white hover:bg-white/20 h-6 w-6 p-0 text-xs"
    title="Toggle contrast"
  >
    C
  </Button>
</div>
```

##### 5. Filtro SVG para Enfoque
```svg
<svg width="0" height="0" style={{ position: 'absolute' }}>
  <defs>
    <filter id="sharpen">
      <feConvolveMatrix
        order="3"
        kernelMatrix="0 -1 0 -1 5 -1 0 -1 0"
        preserveAlpha="true"
      />
    </filter>
  </defs>
</svg>
```

### Archivos Modificados
- **src/components/ui/event-player.tsx**: 
  - Agregado estado de mejora de imagen, funciones de control, aplicación de filtros CSS, controles UI y filtro SVG
  - Corregidos errores de compilación causados por inserción de código malformada
  - Implementada función helper `buildFilterString()` para centralizar construcción de filtros CSS
  - Mejorado manejo de estado de filtros con logging detallado

### Resultado
- ✅ Las grabaciones ahora soportan ajustes de imagen como la vista en vivo
- ✅ Controles intuitivos para nitidez (S) y contraste (C)
- ✅ Mejora visual aplicada tanto a videos como snapshots
- ✅ Filtros CSS eficientes sin afectar rendimiento
- ✅ Consistencia con la experiencia de vista en vivo
- ✅ Corregidos errores de compilación y código malformado
- ✅ Implementación centralizada de construcción de filtros CSS

## Manejo de Políticas de Autoplay del Navegador

### Problema Identificado
Los navegadores modernos bloquean el autoplay de video/audio hasta que el usuario interactúa con la página, generando errores `NotAllowedError` al intentar reproducir videos automáticamente.

### Solución Implementada
Se agregó manejo específico para el error `NotAllowedError` en todos los componentes de video del sistema con mensajes informativos al usuario y estados de UI apropiados.

#### Características Implementadas

##### 1. Estado de Interacción Requerida (event-player.tsx)
```typescript
const [userInteractionRequired, setUserInteractionRequired] = useState(false);
```

##### 2. Manejo Específico del Error NotAllowedError
```typescript
try {
  await videoRef.current.play();
  setUserInteractionRequired(false);
} catch (playError: any) {
  if (playError.name === 'NotAllowedError') {
    setUserInteractionRequired(true);
    setError('Haz clic en "Reproducir Video" para iniciar la reproducción');
    setShowThumbnail(true);
  } else {
    setError(`Error al reproducir: ${playError.message}`);
  }
}
```

##### 3. Mensaje Informativo en el Botón de Play
```tsx
<Button size="lg" className="bg-white/90 hover:bg-white text-black" onClick={handlePlayPause}>
  <Play className="h-6 w-6 mr-2" />
  {userInteractionRequired ? 'Haz clic para reproducir' : 'Reproducir Video'}
</Button>
```

##### 4. Reset del Estado al Cambiar Eventos
```typescript
useEffect(() => {
  if (event) {
    // ... carga del evento
    setUserInteractionRequired(false); // Reset state
  }
}, [event?.id]);
```

##### 5. Manejo en Componentes de Grabaciones
Se implementó el mismo patrón de manejo de errores en todos los componentes de reproducción de video:

- **recording-browser.tsx**: Auto-play con manejo silencioso (solo logging)
- **recording-player.tsx**: Manejo completo con mensajes de error al usuario
- **modern-recording-player.tsx**: Manejo completo con mensajes de error al usuario

### Funciones Modificadas
- **handlePlayPause**: Agregado manejo específico para `NotAllowedError` en todos los componentes
- **handleReplay**: Agregado manejo de errores de autoplay
- **Auto-play functionality**: Mejorado con try/catch apropiado

### Resultado
- ✅ Manejo elegante del error `NotAllowedError` en todos los componentes de video
- ✅ Mensajes informativos al usuario sobre requerimientos de interacción
- ✅ UI adaptativa que guía al usuario para iniciar la reproducción
- ✅ Reset apropiado del estado entre eventos
- ✅ Experiencia de usuario mejorada en navegadores con políticas de autoplay estrictas
- ✅ Eliminación de errores de consola molestos causados por autoplay fallido