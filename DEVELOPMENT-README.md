# Entorno de Desarrollo ExalinkHub

Este documento explica cómo usar el entorno de desarrollo híbrido que combina servicios backend en Docker con frontend corriendo localmente para desarrollo más rápido.

## ✅ Estado Actual

**🟢 ENTORNO COMPLETAMENTE FUNCIONAL**

Todos los servicios están operativos y probados:
- ✅ Frontend Next.js: `http://localhost:9002` (hot reload automático, local)
- ✅ Backend LPR: `http://localhost:2221` (Docker, recarga automática)
- ✅ Backend Conteo: `http://localhost:2223` (Docker, recarga automática)
- ✅ Backend Notificaciones: `http://localhost:2224` (Docker, recarga automática)
- ✅ Redis: Base de datos en memoria (Docker)
- ✅ Health checks: Todos los servicios pasan sus verificaciones de salud

## 🚀 Inicio Rápido

### Windows (PowerShell)
```powershell
# Iniciar entorno completo (backend + frontend)
.\dev-start.bat

# Detener entorno completo
.\dev-stop.bat

# Iniciar solo frontend (si backends ya están corriendo)
.\dev-frontend.bat

# Limpiar contenedores e imágenes
.\dev-clean.bat
```

## 🚀 Setup Híbrido: Backend en Docker + Frontend Local

### Beneficios
- **⚡ Desarrollo frontend instantáneo**: Hot reload sin compilación Docker
- **🐳 Backends consistentes**: Servicios en contenedores con aislamiento
- **🔄 Recarga automática**: Cambios en backend se reflejan automáticamente
- **💾 Recursos optimizados**: Menos uso de CPU/memoria en desarrollo

### Arquitectura
```
Frontend (Local) ←→ Backend Services (Docker)
     ↓                    ↓
  npm run dev      docker-compose.dev.yml
  Puerto 9002       Puertos 2221, 2223, 2224
  Hot reload        Volume mounts
```

### Inicio del entorno híbrido
```bash
# Iniciar todo (backends + frontend)
.\dev-start.bat

# Solo frontend (si backends ya están corriendo)
.\dev-frontend.bat

# Ver estado
.\dev-status.bat

# Ver logs
.\dev-logs.bat

# Detener todo
.\dev-stop.bat
```

### Desarrollo típico
1. **Cambios en frontend**: Se reflejan instantáneamente (hot reload)
2. **Cambios en backend**: Se sincronizan automáticamente via volume mounts
3. **Debugging**: Logs separados para frontend (consola) y backends (Docker)
4. **Testing**: Frontend local conecta a backends en Docker normalmente

## 📁 Estructura del Entorno

### Arquitectura Híbrida
- **Frontend**: Corre localmente con `npm run dev` para hot reload instantáneo
- **Backends**: Corren en Docker para aislamiento y consistencia
- **Bases de datos**: Compartidas entre servicios

### Servicios Incluidos
- **Frontend (Next.js)**: `http://localhost:9002` - Hot reload automático, local
- **Backend LPR**: `http://localhost:2221` - Recarga automática en Docker
- **Backend Conteo**: `http://localhost:2223` - Recarga automática en Docker
- **Backend Notificaciones**: `http://localhost:2224` - Recarga automática en Docker
- **Redis**: Base de datos en memoria en Docker
- **Proxy Nginx** (opcional): `http://localhost:2280` / `https://localhost:2443`

### Volúmenes Montados (Solo Backends)
- **Código fuente backend**: Se monta directamente para cambios en tiempo real
- **Bases de datos**: `./DB`, `./data` - Persistentes
- **Media**: `./MEDIA` - Solo lectura
- **Logs**: `./LOG` - Para debugging

## 🔧 Desarrollo por Servicio

### Frontend (Next.js) - LOCAL
**Hot Reload**: ✅ Automático e instantáneo
- Modifica archivos en `src/`, `public/`, etc.
- Los cambios se reflejan inmediatamente en el navegador sin compilación
- No requiere reiniciar ni reconstruir contenedores

**Comandos útiles**:
```bash
# Iniciar frontend (desde dev-start.bat o manualmente)
npm run dev

# Ver procesos de Node.js
tasklist | findstr node

# Detener frontend
taskkill /f /im node.exe
```

### Backend LPR - DOCKER
**Recarga**: ✅ Automática (gracias al volumen montado)
- Modifica archivos en `backend/Matriculas/listener/`
- Los cambios se reflejan automáticamente sin reiniciar

**Comandos útiles**:
```bash
# Ver logs
.\dev-logs.bat matriculas-listener

# Reiniciar manualmente si es necesario
docker restart matriculas-listener-dev

# Acceder al contenedor
docker exec -it matriculas-listener-dev bash
```

### Backend Conteo - DOCKER
**Recarga**: ✅ Automática (gracias al volumen montado)
- Modifica archivos en `backend/conteo/`
- Los cambios se reflejan automáticamente sin reiniciar

**Comandos útiles**:
```bash
# Ver logs
.\dev-logs.bat conteo-backend

# Reiniciar manualmente si es necesario
docker restart exalink-conteo-backend-dev

# Acceder al contenedor
docker exec -it exalink-conteo-backend-dev bash
```

### Backend Notificaciones - DOCKER
**Recarga**: ✅ Automática (gracias al volumen montado)
- Modifica archivos en `backend/notificaciones/`
- Los cambios se reflejan automáticamente sin reiniciar

**Comandos útiles**:
```bash
# Ver logs
.\dev-logs.bat notificaciones-backend

# Reiniciar manualmente si es necesario
docker restart exalink-notificaciones-backend-dev

# Acceder al contenedor
docker exec -it exalink-notificaciones-backend-dev bash
```

## 🐛 Debugging

### Ver Logs de Servicios Backend
```bash
# Todos los servicios backend
.\dev-logs.bat

# Servicio específico
.\dev-logs.bat matriculas-listener
.\dev-logs.bat conteo-backend
.\dev-logs.bat notificaciones-backend

# Seguir logs en tiempo real
.\dev-logs.bat matriculas-listener 50 follow
```

### Ver Logs del Frontend
```bash
# El frontend corre localmente, los logs se muestran en la terminal
.\dev-logs.bat frontend

# O inicia el frontend manualmente para ver logs
.\dev-frontend.bat
```

### Acceder a Contenedores Backend
```bash
# Backend LPR
docker exec -it matriculas-listener-dev bash

# Backend Conteo
docker exec -it exalink-conteo-backend-dev bash

# Backend Notificaciones
docker exec -it exalink-notificaciones-backend-dev bash
```

### Verificar Estado de Servicios
```bash
# Estado completo (frontend local + backends Docker)
.\dev-status.bat

# Solo servicios Docker
docker-compose -f docker-compose.dev.yml ps
```

## 🔄 Sincronización de Cambios

### Frontend (Local)
Los cambios se sincronizan automáticamente gracias a Next.js dev mode.
- **Ventaja**: Hot reload instantáneo, sin compilación
- **Archivos**: `src/`, `public/`, `components/`, etc.
- **Tiempo**: Inmediato

### Backends Python (Docker)
Los cambios se sincronizan automáticamente gracias a los volúmenes montados.
- **Ventaja**: No requiere reiniciar contenedores
- **Archivos**: `backend/*/`
- **Tiempo**: Inmediato (Python recarga módulos automáticamente)

### Bases de Datos
- **Persistencia**: Se mantienen entre reinicios
- **Ubicación**: `./DB/`, `./data/`
- **Backup**: Los datos se preservan automáticamente

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

## � Desarrollo vs Producción

### Desarrollo (Setup Híbrido)
- **Frontend**: Local con `npm run dev` (hot reload instantáneo)
- **Backend**: Docker con volúmenes montados (recarga automática)
- **Bases de datos**: Compartidas, persistentes
- **Performance**: Optimizado para velocidad de desarrollo
- **Debugging**: Fácil acceso a logs y contenedores

### Producción (Docker Completo)
- **Todo en Docker**: Frontend compilado en imagen
- **Optimizado**: Imágenes más pequeñas, mejor performance
- **Escalable**: Múltiples instancias posibles
- **Seguro**: Sin dependencias locales

### Migración Desarrollo → Producción
```bash
# 1. Detener desarrollo
.\dev-stop.bat

# 2. Construir imágenes de producción
docker-compose build

# 3. Desplegar
.\deploy.bat

# 4. Verificar
curl http://localhost:2280
```

## 💡 Mejores Prácticas

### Desarrollo Frontend
- Mantén el frontend corriendo con `npm run dev` durante toda la sesión
- Los cambios se reflejan instantáneamente en el navegador
- Usa React DevTools para debugging
- Verifica conectividad con backends usando las herramientas de red del navegador

### Desarrollo Backend
- Los cambios en código Python se reflejan automáticamente
- Para cambios en dependencias (`requirements.txt`), reconstruye el contenedor
- Usa logs de Docker para debugging: `.\dev-logs.bat <service-name>`
- Accede a contenedores con `docker exec -it <container-name> bash` para debugging avanzado

### Gestión de Estado
- Las bases de datos se mantienen entre reinicios
- Usa `.\dev-clean.bat` solo cuando necesites estado limpio
- Los archivos multimedia en `./MEDIA` son persistentes

### Performance
- El setup híbrido es más rápido para desarrollo que Docker completo
- Si experimentas lentitud, verifica que Docker tenga suficientes recursos asignados
- Considera usar WSL2 en Windows para mejor performance de Docker

### Troubleshooting Sistemático
1. **Problema con frontend**: Verifica que Node.js esté corriendo con `.\dev-status.bat`
2. **Problema con backend**: Verifica contenedores con `docker ps` y logs con `.\dev-logs.bat`
3. **Problema de conectividad**: Verifica health checks de cada servicio
4. **Problema de performance**: Reinicia servicios o limpia Docker con `.\dev-clean.bat`

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

### "Port already in use" (Frontend)
```bash
# Verificar qué proceso usa el puerto 9002
netstat -ano | findstr :9002

# Detener proceso de Node.js
taskkill /f /im node.exe

# O cambiar puerto
set PORT=9003 && npm run dev
```

### "Changes not reflecting" en Frontend
```bash
# Reiniciar frontend
.\dev-stop.bat
.\dev-frontend.bat
```

### "Changes not reflecting" en Backend
```bash
# Forzar recarga del contenedor
docker-compose -f docker-compose.dev.yml restart <service-name>

# O reconstruir si es necesario
docker-compose -f docker-compose.dev.yml build --no-cache <service-name>
```

### "No space left on device"
```bash
# Limpiar Docker
docker system prune -a --volumes

# Limpiar solo contenedores de desarrollo
.\dev-clean.bat
```

### "Module not found" en Python
```bash
# Acceder al contenedor y verificar
docker exec -it <container-name> bash
pip list
pip install -r requirements.txt
```

### "Frontend no conecta a backends"
```bash
# Verificar que backends están corriendo
.\dev-status.bat

# Verificar conectividad
curl http://localhost:2221/health
curl http://localhost:2223/health
curl http://localhost:2224/health
```

### "Docker no está disponible"
```bash
# Verificar que Docker Desktop está corriendo
docker --version

# Reiniciar servicios Docker
.\dev-stop.bat
.\dev-start.bat
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