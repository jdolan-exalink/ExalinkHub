# Documentación: Patrón de reproductor de eventos con controles fijos

## Objetivo
Mantener los controles y el layout del reproductor de eventos visibles y fijos, cambiando únicamente el video al seleccionar una nueva detección/evento. Esto mejora la experiencia de usuario y evita que los controles desaparezcan o se reemplacen accidentalmente.

## Implementación
- El componente padre debe mantener el reproductor montado y solo actualizar el prop `event`.
- El componente `EventPlayer` debe resetear su estado interno (thumbnail, error, tiempo, etc.) cada vez que cambia el evento, pero nunca desmontar los controles ni el layout.
- Usar un efecto `useEffect` para resetear los estados internos al cambiar el evento:

```tsx
useEffect(() => {
  setShowThumbnail(true);
  setIsPlaying(false);
  setError(null);
  setCurrentTime(0);
  setDuration(0);
  setIsMuted(false);
  setVolume(1);
  if (event && event.has_clip) {
    loadEventClip();
  }
}, [event?.id]);
```

## Problemas comunes
- Si el componente padre desmonta el reproductor, los controles desaparecen. Solución: solo cambiar el prop `event`.
- Si el estado interno no se resetea, pueden quedar overlays o errores visibles. Solución: resetear todos los estados relevantes en el efecto.

## Ejemplo de uso
```tsx
<EventPlayer
  event={selectedEvent}
  onPreviousEvent={...}
  onNextEvent={...}
  onDownload={...}
/>
```

## Integración con API Frigate
- El video se carga desde `/api/frigate/events/{event.id}/clip.mp4`.
- El snapshot se carga desde `/api/frigate/events/{event.id}/snapshot.jpg`.
- El estado del evento seleccionado debe estar en el componente padre y actualizarse al seleccionar una detección.

---
Última actualización: 2025-10-06
Autor: GitHub Copilot
