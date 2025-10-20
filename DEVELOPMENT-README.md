# Entorno de Desarrollo ExalinkHub

Este documento explica cómo usar el entorno de desarrollo con Docker Compose que permite modificaciones en tiempo real sin necesidad de reconstruir imágenes.

## ✅ Estado Actual

**🟢 ENTORNO COMPLETAMENTE FUNCIONAL**

Todos los servicios están operativos y probados:
- ✅ Frontend Next.js: `http://localhost:9002` (hot reload automático)
- ✅ Backend LPR: `http://localhost:2221` (health: `{"status":"ok","servers":["helvecia"]}`)
- ✅ Backend Conteo: `http://localhost:2223` (health: `{"status":"ok"}`)
- ✅ Backend Notificaciones: `http://localhost:2224` (health: `{"status":"ok"}`)
- ✅ Redis: Base de datos en memoria
- ✅ Health checks: Todos los servicios pasan sus verificaciones de salud

## 🚀 Inicio Rápido

### Windows (PowerShell)
```powershell
# Iniciar entorno de desarrollo
.\dev-start.bat

# Detener entorno
.\dev-stop.bat

# Limpiar contenedores e imágenes
.\dev-clean.bat
```

### Linux/Mac
```bash
# Iniciar entorno de desarrollo
docker-compose -f docker-compose.dev.yml up --build

# Detener entorno
docker-compose -f docker-compose.dev.yml down

# Limpiar
docker-compose -f docker-compose.dev.yml down --volumes --remove-orphans
```

## 📁 Estructura del Entorno

### Servicios Incluidos
- **Frontend (Next.js)**: `http://localhost:9002` - Hot reload automático
- **Backend LPR**: `http://localhost:2221` - Recarga automática
- **Backend Conteo**: `http://localhost:2223` - Recarga automática
- **Backend Notificaciones**: `http://localhost:2224` - Recarga automática
- **Redis**: Base de datos en memoria
- **Proxy Nginx** (opcional): `http://localhost:2280` / `https://localhost:2443`

### Volúmenes Montados
- **Código fuente**: Se monta directamente para cambios en tiempo real
- **Bases de datos**: `./DB`, `./data` - Persistentes
- **Media**: `./MEDIA` - Solo lectura
- **Logs**: `./LOG` - Para debugging

## 🔧 Desarrollo por Servicio

### Frontend (Next.js)
**Hot Reload**: ✅ Automático
- Modifica archivos en `src/`, `public/`, etc.
- Los cambios se reflejan inmediatamente en el navegador

**Comandos útiles**:
```bash
# Ver logs del frontend
docker logs exalink-frontend-dev -f

# Acceder al contenedor
docker exec -it exalink-frontend-dev sh
```

### Backend LPR
**Recarga**: ⚠️ Reinicio manual requerido
- Modifica archivos en `backend/Matriculas/listener/`
- Requiere reiniciar el contenedor para ver cambios

**Comandos útiles**:
```bash
# Reiniciar backend LPR
docker restart matriculas-listener-dev

# Ver logs
docker logs matriculas-listener-dev -f
```

### Backend Conteo
**Recarga**: ⚠️ Reinicio manual requerido
- Modifica archivos en `backend/conteo/`
- Requiere reiniciar el contenedor

**Comandos útiles**:
```bash
# Reiniciar backend conteo
docker restart exalink-conteo-backend-dev

# Ver logs
docker logs exalink-conteo-backend-dev -f
```

### Backend Notificaciones
**Recarga**: ⚠️ Reinicio manual requerido
- Modifica archivos en `backend/notificaciones/`
- Requiere reiniciar el contenedor

## 🐛 Debugging

### Ver Logs de Todos los Servicios
```bash
docker-compose -f docker-compose.dev.yml logs -f
```

### Ver Logs de un Servicio Específico
```bash
docker-compose -f docker-compose.dev.yml logs -f frontend
docker-compose -f docker-compose.dev.yml logs -f matriculas-listener
```

### Acceder a un Contenedor
```bash
# Frontend
docker exec -it exalink-frontend-dev sh

# Backend LPR
docker exec -it matriculas-listener-dev bash

# Backend Conteo
docker exec -it exalink-conteo-backend-dev bash
```

### Verificar Estado de Servicios
```bash
docker-compose -f docker-compose.dev.yml ps
```

## 🔄 Sincronización de Cambios

### Frontend
Los cambios se sincronizan automáticamente gracias a Next.js dev mode.

### Backends Python
Para cambios en código Python, reinicia el contenedor correspondiente:
```bash
docker-compose -f docker-compose.dev.yml restart <service-name>
```

## 📊 Monitoreo

### Health Checks
Todos los servicios tienen health checks configurados:
- Frontend: `http://localhost:9002/api/health`
- LPR: `http://localhost:2221/health`
- Conteo: `http://localhost:2223/health`
- Notificaciones: `http://localhost:2224/health`

### Métricas
- Redis: Puerto estándar con contraseña
- Contenedores: `docker stats`

## 🚀 Despliegue a Producción

Cuando los cambios estén listos:

1. **Construir imágenes de producción**:
   ```bash
   docker-compose build
   ```

2. **Desplegar**:
   ```bash
   .\deploy.bat
   ```

## ⚡ Optimizaciones

### Para Mejor Performance en Windows
- Usa WSL2 para Docker si es posible
- Configura Docker Desktop con más recursos (CPU/RAM)
- Usa volúmenes named en lugar de bind mounts si hay problemas de performance

### Para Desarrollo Acelerado
- Mantén los contenedores corriendo y solo reinicia cuando cambies código Python
- Usa `docker-compose -f docker-compose.dev.yml up -d` para modo detached
- Configura tu editor para recargar automáticamente al guardar

### Problemas Resueltos

#### ❌ "requirements.txt not found" en Backend LPR
**Síntoma:** Error durante el build: `COPY requirements.txt .: not found`
**Causa:** Contexto de build incorrecto (`./backend/Matriculas` en lugar de `./backend/Matriculas/listener`)
**Solución:** Cambiar contexto de build a `./backend/Matriculas/listener` en `docker-compose.dev.yml`

#### ❌ Frontend no responde en puerto 9002
**Síntoma:** Puerto abierto pero conexiones terminan inesperadamente
**Causa:** Inconsistencia en mapeo de puertos (contenedor:3000 ↔ host:9002, pero Next.js escucha en 9002)
**Solución:** Cambiar mapeo a `9002:9002` y actualizar health check

## 🐛 Troubleshooting

### "Port already in use"
```bash
# Liberar puertos
netstat -ano | findstr :9002
taskkill /PID <PID> /F
```

### "No space left on device"
```bash
# Limpiar Docker
docker system prune -a --volumes
```

### "Changes not reflecting"
```bash
# Forzar rebuild de un servicio
docker-compose -f docker-compose.dev.yml build --no-cache <service-name>
docker-compose -f docker-compose.dev.yml up -d <service-name>
```

### "Module not found" en Python
```bash
# Acceder al contenedor y verificar
docker exec -it <container-name> bash
pip list
pip install -r requirements.txt
```

## 📝 Notas Importantes

- **Persistencia**: Las bases de datos y archivos multimedia se mantienen entre reinicios
- **Red**: Todos los servicios están en la red `exalink-lpr-network-dev`
- **Seguridad**: Este setup es solo para desarrollo local
- **Performance**: El hot reload del frontend es instantáneo, los backends requieren reinicio manual

## 🔗 Enlaces Útiles

- [Documentación Next.js](https://nextjs.org/docs)
- [Docker Compose Docs](https://docs.docker.com/compose/)
- [Python Development](https://docs.python.org/3/library/development.html)