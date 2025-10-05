# Sistema de Drag and Drop Refactorizado - ExalinkHub

## Descripción General

El sistema de drag and drop del Live View ha sido completamente refactorizado para soportar tanto cámaras individuales como servidores completos, proporcionando una experiencia de usuario más fluida y completa.

## Características Implementadas

### 1. Drag de Cámaras Individuales
- **Funcionalidad**: Arrastrar una cámara específica desde el sidebar al layout
- **Activación**: Solo se activa el drag en el **icono de la cámara y el nombre**
- **Comportamiento**:
  - Si la celda está vacía: coloca la cámara
  - Si la celda está ocupada: reemplaza la cámara existente
  - Si la cámara ya existe en el grid: intercambia posiciones
- **Doble-click**: Agrega la cámara a la primera celda vacía disponible
- **Indicadores visuales**: 
  - Overlay verde con nombre de la cámara
  - Badge "CAM" durante el drag
  - Ring de color primario en las celdas durante hover

### 2. Drag de Servidores Completos ⭐ NUEVO
- **Funcionalidad**: Arrastrar un servidor completo con todas sus cámaras habilitadas
- **Activación**: Solo se activa el drag en el **icono del servidor y el nombre**
- **Comportamiento**:
  - Distribuye automáticamente las cámaras del servidor en el layout
  - Empieza desde la posición donde se suelta
  - Solo incluye cámaras habilitadas
  - Respeta el tamaño máximo del layout actual
- **Doble-click**: Agrega todas las cámaras habilitadas del servidor al layout ⭐ NUEVO
- **Indicadores visuales**:
  - Overlay azul con nombre del servidor
  - Badge con número de cámaras disponibles
  - Ring azul en las celdas durante hover

## Componentes Principales

### DraggableServerItem (Actualizado)
```tsx
function DraggableServerItem({ server, serverCameras, onDoubleClick })
```
- Componente wrapper para hacer servidores arrastrables
- **Área de drag limitada**: Solo icono del servidor y nombre
- Incluye funcionalidad de doble-click para servidores
- Feedback visual mejorado durante el drag

### DraggableCameraItem (Actualizado)
```tsx
function DraggableCameraItem({ camera, onDoubleClick })
```
- Componente para cámaras individuales
- **Área de drag limitada**: Solo icono de cámara y nombre
- Mantiene funcionalidad de doble-click existente
- Feedback visual mejorado

### DroppableCell (Mejorado)
```tsx
function DroppableCell({ cell, onRemove, onFpsChange, children })
```
- Detecta el tipo de operación de drag
- Muestra diferentes indicadores según el tipo
- Feedback contextual durante el hover

## Funciones Principales

### handleDragEnd (Refactorizada)
```tsx
const handleDragEnd = (event: DragEndEvent)
```
- Función principal que maneja el final del drag
- Delega a funciones específicas según el tipo

### handleCameraDrop
```tsx
const handleCameraDrop = (dragData: any, over: any)
```
- Maneja el drop de cámaras individuales
- Lógica de reemplazo e intercambio
- Notificaciones específicas

### handleServerDrop ⭐ NUEVO
```tsx
const handleServerDrop = (dragData: any, over: any)
```
- Maneja el drop de servidores completos
- Distribución automática de cámaras
- Validación de cámaras disponibles

### addMultipleCamerasToGrid ⭐ NUEVO
```tsx
const addMultipleCamerasToGrid = (camerasToAdd: Camera[], startFromIndex: number)
```
- Función auxiliar para agregar múltiples cámaras
- Evita duplicados
- Distribución circular en el layout

## Tipos de Datos

### Datos de Drag - Cámara
```typescript
{
  camera: Camera,
  from: 'sidebar',
  type: 'camera'
}
```

### Datos de Drag - Servidor ⭐ NUEVO
```typescript
{
  server: FrigateServer,
  cameras: Camera[], // Solo habilitadas
  from: 'sidebar',
  type: 'server'
}
```

## Flujo de Trabajo

### Drag de Cámara Individual
1. Usuario hace drag del **icono o nombre** de una cámara desde el sidebar
2. `DraggableCameraItem` inicia el drag con tipo 'camera'
3. `DroppableCell` detecta hover y muestra indicador verde
4. Al drop, `handleCameraDrop` ejecuta la lógica de colocación
5. Notificación de confirmación

### Doble-click de Cámara
1. Usuario hace doble-click en el **icono o nombre** de una cámara
2. Cámara se agrega a la primera celda vacía disponible
3. Notificación de confirmación

### Drag de Servidor Completo
1. Usuario hace drag del **icono o nombre** de un servidor
2. `DraggableServerItem` inicia el drag con tipo 'server'
3. `DroppableCell` detecta hover y muestra indicador azul
4. Al drop, `handleServerDrop` distribuye cámaras automáticamente
5. Notificación con resumen de cámaras colocadas

### Doble-click de Servidor ⭐ NUEVO
1. Usuario hace doble-click en el **icono o nombre** de un servidor
2. Sistema dispara evento 'addServerToGrid'
3. `addMultipleCamerasToGrid` coloca todas las cámaras habilitadas
4. Notificación con resumen de cámaras agregadas

## Restricciones de Interacción

### Áreas Draggables
- **Cámaras**: Solo icono de video + nombre de la cámara
- **Servidores**: Solo icono de servidor + nombre del servidor

### Áreas NO Draggables
- Badge con número de cámaras del servidor
- Iconos de estado (círculos de conexión)
- Botones de dots/menú en cámaras
- Área del accordion trigger (excepto icono y nombre)

## Feedback Visual

### Durante el Drag
- **Cámara**: Overlay verde, badge "CAM", rotación sutil
- **Servidor**: Overlay azul, badge con número de cámaras, rotación sutil

### Durante el Hover
- **Cámara**: Ring verde, nombre de la cámara
- **Servidor**: Ring azul, nombre del servidor

### Notificaciones
- **Éxito**: Toast verde con detalles de la operación
- **Advertencia**: Toast amarillo para duplicados
- **Error**: Toast rojo para operaciones fallidas

## Casos de Uso

### 1. Setup Rápido de Vista
- **Drag servidor**: Arrastrar servidor completo para llenar layout automáticamente
- **Doble-click servidor**: Agregar todas las cámaras de un servidor con un doble-click
- Útil para configuraciones iniciales

### 2. Ajuste Fino
- **Drag cámara**: Arrastrar cámaras individuales para posicionamiento específico
- **Doble-click cámara**: Agregar cámara específica a la primera posición libre
- Intercambio de posiciones

### 3. Reemplazo de Contenido
- Drop sobre celdas ocupadas para reemplazar cámaras
- Intercambio inteligente de posiciones

## Eventos del Sistema

### Eventos Disparados
- `addServerToGrid`: Cuando se hace doble-click en un servidor
- Eventos de notificación para feedback visual

### Eventos Escuchados
- `loadSavedView`: Cargar vista guardada
- `requestSaveView`: Solicitud de guardado
- `addServerToGrid`: Agregar servidor completo al grid

## Mejoras Implementadas

1. **Restricción de Área de Drag**: Solo icono y nombre son draggables
2. **Doble-click en Servidores**: Nueva funcionalidad para agregar servidor completo
3. **Mejor Separación de Responsabilidades**: Drag separado del accordion trigger
4. **Feedback Visual Mejorado**: Indicadores más claros y específicos
5. **Prevención de Interferencias**: El drag no interfiere con la funcionalidad del accordion

## Notas de Implementación

- Utiliza `@dnd-kit/core` como librería base
- Compatible con todos los layouts existentes (1x1, 2x2, 3x3, 4x4, 5x5, 6x6, 1+5, 1+12)
- Mantiene compatibilidad con funcionalidad existente de doble-click
- Sistema de notificaciones integrado con el toast system
- Documentación de funciones en formato JSDoc
- Convención de nombres en snake_case según estándares del proyecto
- Áreas de interacción claramente definidas para mejor UX