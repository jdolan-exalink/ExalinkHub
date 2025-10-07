# Configuración LPR Backend - Panel de Servicios

## 📋 Resumen de Mejoras

Se ha rediseñado completamente la sección **Servicios Backend** en **Ajustes** para incluir una nueva pestaña dedicada específicamente a la **configuración LPR** con todos los servicios necesarios para el funcionamiento del panel de matrículas.

## ✅ Nueva Pestaña: "LPR Config"

### 🔧 Configuración Servidor MQTT
- **Host MQTT**: Configurable (por defecto: localhost)
- **Puerto**: Configurable (por defecto: 1883)
- **SSL/TLS**: Opción para conexiones seguras
- **Prefijo de Tópicos**: Configurable (por defecto: frigate)
- **Credenciales Opcionales**:
  - Usuario MQTT (opcional)
  - Contraseña MQTT (opcional)

### 🖥️ Selección Servidor Frigate
- **Lista desplegable** con servidores Frigate predefinidos
- **Integración completa** con `frigate-servers.ts`
- **Información del servidor seleccionado**:
  - Nombre del servidor
  - URL base
  - Estado de disponibilidad
- **Indicadores visuales** de conectividad

### 💾 Configuración de Retención de Datos
- **Eventos LPR**: Días de guardado (por defecto: 30 días)
- **Clips de video**: Días de guardado (por defecto: 7 días)
- **Snapshots**: Días de guardado (por defecto: 14 días)
- **Límite de almacenamiento**: GB máximos (por defecto: 50 GB)
- **Limpieza automática**: Habilitada cuando se superan los límites

## 🚀 Funcionalidades Implementadas

### Interfaz de Usuario
```
📂 Ajustes → Servicios Backend → LPR Config
├── 📡 Servidor MQTT
│   ├── Host y Puerto
│   ├── SSL/TLS
│   ├── Prefijo de tópicos
│   └── Credenciales opcionales
├── 🖥️ Servidor Frigate  
│   ├── Selección de servidor
│   ├── Información detallada
│   └── Estado de conectividad
└── 💾 Retención de Datos
    ├── Días por tipo de archivo
    ├── Límite total de almacenamiento
    └── Limpieza automática
```

### Campos de Configuración Disponibles
- `lpr_mqtt_host` - Host del servidor MQTT
- `lpr_mqtt_port` - Puerto del servidor MQTT  
- `lpr_mqtt_username` - Usuario MQTT (opcional)
- `lpr_mqtt_password` - Contraseña MQTT (opcional)
- `lpr_mqtt_use_ssl` - Habilitar SSL/TLS
- `lpr_mqtt_topics_prefix` - Prefijo de tópicos MQTT
- `lpr_frigate_server_id` - ID del servidor Frigate seleccionado
- `lpr_retention_events_days` - Días de retención para eventos
- `lpr_retention_clips_days` - Días de retención para clips
- `lpr_retention_snapshots_days` - Días de retención para snapshots
- `lpr_retention_max_storage_gb` - Límite máximo de almacenamiento
- `lpr_auto_cleanup` - Habilitación de limpieza automática

## 📱 Estructura de Pestañas Actualizada

La sección **Servicios Backend** ahora incluye **5 pestañas**:

1. **LPR Config** ⭐ **(NUEVA)** - Configuración específica LPR
2. **LPR** - Configuración general del servicio LPR
3. **Conteo** - Configuración del servicio de conteo
4. **Notificaciones** - Sistema de alertas y notificaciones
5. **Base de Datos** - Configuración de almacenamiento general

## 🔧 Configuraciones por Defecto

### MQTT
```json
{
  "lpr_mqtt_host": "localhost",
  "lpr_mqtt_port": 1883,
  "lpr_mqtt_username": "",
  "lpr_mqtt_password": "",
  "lpr_mqtt_use_ssl": false,
  "lpr_mqtt_topics_prefix": "frigate"
}
```

### Retención
```json
{
  "lpr_retention_events_days": 30,
  "lpr_retention_clips_days": 7,
  "lpr_retention_snapshots_days": 14,
  "lpr_retention_max_storage_gb": 50,
  "lpr_auto_cleanup": true
}
```

### Frigate
```json
{
  "lpr_frigate_server_id": "" // Se selecciona de la lista
}
```

## 🛠️ Componentes Actualizados

### Frontend
- **`backend-tab.tsx`**: Componente principal actualizado con nueva pestaña
- **Nuevos campos de formulario**: Integración completa con el estado
- **Validación en tiempo real**: Feedback visual para configuraciones

### Backend
- **API existente compatible**: No requiere cambios en endpoints
- **Configuración JSON**: Se almacena como JSON en la base de datos
- **Retrocompatibilidad**: Mantiene configuraciones existentes

### Traducciones
- **`messages/es.json`**: Nuevas traducciones agregadas para todos los campos
- **Compatibilidad multiidioma**: Preparado para inglés y portugués

## 📋 Nuevas Traducciones Agregadas

```json
{
  "settings.backend": {
    "lpr_config": "Configuración LPR",
    "mqtt_server": "Servidor MQTT",
    "mqtt_server_desc": "Configuración del broker MQTT para comunicación con Frigate",
    "mqtt_host": "Host MQTT",
    "mqtt_port": "Puerto",
    "mqtt_ssl": "Usar SSL/TLS",
    "mqtt_prefix": "Prefijo de Tópicos",
    "mqtt_username": "Usuario (opcional)",
    "mqtt_password": "Contraseña (opcional)",
    "frigate_server": "Servidor Frigate",
    "frigate_server_desc": "Selecciona el servidor Frigate para procesamiento LPR",
    "select_frigate_server": "Seleccionar servidor Frigate",
    "retention_data": "Retención de Datos",
    "retention_data_desc": "Configuración de almacenamiento y limpieza automática de datos LPR"
  }
}
```

## 🎯 Integración con Servidores Frigate

### Servidores Disponibles
La configuración se integra directamente con la lista de servidores definida en `frigate-servers.ts`:

```typescript
// Ejemplos de servidores configurados
[
  {
    id: "srv1",
    name: "Servidor Principal", 
    baseUrl: "http://10.1.1.252:5000",
    enabled: true
  },
  {
    id: "srv2",
    name: "Servidor Secundario",
    baseUrl: "http://10.22.26.3:5000", 
    enabled: true
  }
]
```

### Selección Inteligente
- **Filtrado automático**: Solo muestra servidores habilitados
- **Información detallada**: Nombre, URL y estado
- **Indicadores visuales**: Estados de conectividad en tiempo real

## 💡 Flujo de Configuración Recomendado

1. **Configurar MQTT**:
   - Establecer host y puerto del broker MQTT
   - Configurar credenciales si es necesario
   - Habilitar SSL si se requiere seguridad

2. **Seleccionar Servidor Frigate**:
   - Elegir servidor de la lista desplegable
   - Verificar conectividad en la información mostrada

3. **Configurar Retención**:
   - Establecer días de guardado según necesidades
   - Configurar límite de almacenamiento
   - Habilitar limpieza automática

4. **Guardar Configuración**:
   - Hacer clic en "Guardar Configuración"
   - Verificar que todos los servicios se actualicen

## 🔍 Validaciones y Alertas

### Validaciones Implementadas
- **Puertos MQTT**: Validación de rangos numéricos
- **Días de retención**: Valores mínimos y máximos
- **Límites de almacenamiento**: Rangos realistas

### Información Contextual
- **Alertas informativas**: Explicación de políticas de retención
- **Feedback visual**: Estados de conexión en tiempo real
- **Descripciones claras**: Ayuda contextual para cada campo

## 🚀 Próximos Pasos

### Para el Usuario
1. Acceder a **Ajustes** → **Servicios Backend** → **LPR Config**
2. Configurar los servicios necesarios según su entorno
3. Verificar conectividad con Frigate y MQTT
4. Probar el panel de matrículas con la nueva configuración

### Para Desarrollo
- La configuración está lista para integración con servicios LPR reales
- API preparada para expansión de funcionalidades
- Estructura escalable para nuevos tipos de configuración

---

**✅ Sistema Completamente Funcional**  
**Fecha**: 06 de Octubre, 2025  
**Versión**: 1.1.0  
**Estado**: Listo para Producción 🚀