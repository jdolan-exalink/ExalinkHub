# Scripts de Desarrollo ExalinkHub

Esta carpeta contiene scripts para facilitar el desarrollo y testing del sistema ExalinkHub.

## Scripts Disponibles

### 🚀 Inicio y Control

#### `dev-start.bat`
Inicia todos los servicios de desarrollo en modo detached (-d).
```bash
.\dev-start.bat
```
- Construye imágenes si es necesario
- Inicia servicios en background
- Permite continuar trabajando mientras los contenedores corren

#### `dev-stop.bat`
Detiene todos los servicios de desarrollo.
```bash
.\dev-stop.bat
```

#### `dev-restart.bat`
Reinicia servicios específicos o todos los servicios.
```bash
# Reiniciar todos los servicios
.\dev-restart.bat

# Reiniciar solo un servicio específico
.\dev-restart.bat frontend
.\dev-restart.bat lpr-backend
```

### 📊 Monitoreo

#### `dev-status.bat`
Muestra el estado actual de todos los servicios de desarrollo.
```bash
.\dev-status.bat
```
- Estado de contenedores Docker
- Puertos disponibles
- Uso de recursos (CPU, memoria, red)

#### `dev-logs.bat`
Muestra logs de los servicios de desarrollo.
```bash
# Ver logs de todos los servicios (últimas 100 líneas)
.\dev-logs.bat

# Ver logs de un servicio específico
.\dev-logs.bat frontend
.\dev-logs.bat lpr-backend

# Ver logs con más líneas
.\dev-logs.bat all 200

# Seguir logs en tiempo real
.\dev-logs.bat frontend follow
```

### 🧹 Mantenimiento

#### `dev-clean.bat`
Limpia el entorno de desarrollo eliminando contenedores, imágenes y volúmenes no utilizados.
```bash
.\dev-clean.bat
```

#### `dev-check.bat`
Verifica que la configuración de desarrollo esté correcta.
```bash
.\dev-check.bat
```
- Verifica instalación de Docker y Docker Compose
- Valida archivos de configuración
- Comprueba disponibilidad de puertos

#### `dev-update.bat`
Actualiza el código fuente y reconstruye los contenedores.
```bash
.\dev-update.bat
```
- Sincroniza cambios del código fuente
- Reconstruye imágenes Docker
- Reinicia servicios con cambios aplicados

## Servicios Incluidos

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| Frontend | 9002 | Interfaz web Next.js |
| LPR Backend | 2221 | Servicio de reconocimiento de matrículas |
| Conteo Backend | 2223 | Servicio de conteo de personas |
| Notificaciones Backend | 2224 | Servicio de notificaciones |
| Redis | 6379 | Cache y colas de mensajes |

## Flujo de Trabajo Típico

### Desarrollo Diario
```bash
# Verificar configuración
.\dev-check.bat

# Iniciar servicios
.\dev-start.bat

# Verificar estado
.\dev-status.bat

# Ver logs si hay problemas
.\dev-logs.bat

# Trabajar en el código...
# Los cambios se reflejan automáticamente (hot reload)

# Detener cuando termines
.\dev-stop.bat
```

### Actualización de Código
```bash
# Hacer cambios en el código
# ...

# Actualizar y reconstruir
.\dev-update.bat

# Verificar que todo funciona
.\dev-status.bat
```

### Troubleshooting
```bash
# Si hay problemas, limpiar todo
.\dev-clean.bat

# Verificar configuración
.\dev-check.bat

# Reiniciar desde cero
.\dev-start.bat
```

## URLs de Acceso

- **Frontend Principal**: http://localhost:9002
- **Página LPR**: http://localhost:9002/es/plates-lpr
- **Configuración LPR**: http://localhost:9002/es/settings
- **API Backend LPR**: http://localhost:2221
- **API Backend Conteo**: http://localhost:2223
- **API Backend Notificaciones**: http://localhost:2224

## Notas Importantes

- Los servicios corren en modo detached, permitiendo trabajar mientras monitoreas logs
- El frontend tiene hot reload automático para cambios en código
- Los backends requieren reconstrucción para cambios en código Python
- Usa `dev-logs.bat` para monitorear logs en segmentos sin bloquear la terminal
- Si hay errores de puerto, verifica que no haya otros servicios usando los mismos puertos