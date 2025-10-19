# Fix: Docker CLI en Contenedor Frontend

## Problema Identificado

Al intentar obtener logs de los contenedores backend desde el frontend, se obtenía el siguiente error:

```
Error al obtener logs: Command failed: docker --version
/bin/sh: docker: not found
```

### Causa Raíz

El contenedor del frontend intentaba ejecutar comandos `docker` (como `docker logs`, `docker stats`, `docker inspect`) pero el cliente de Docker no estaba instalado en la imagen de producción.

Aunque el socket de Docker estaba correctamente montado en el contenedor:
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
```

El problema era que:
1. El `docker-cli` solo estaba instalado en la etapa `base` del Dockerfile (para build)
2. La etapa `runner` (producción) no tenía el cliente de Docker instalado
3. El usuario `nextjs` no tenía permisos para acceder al socket de Docker

## Solución Implementada

### 1. Instalar Docker CLI en la Etapa Runner

Se modificó `frontend-build/Dockerfile` para instalar `docker-cli` en la etapa de producción:

```dockerfile
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
# Instalar Docker CLI para poder ejecutar comandos docker desde el contenedor
RUN apk add --no-cache docker-cli
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
# Agregar usuario nextjs al grupo docker para acceder al socket
RUN addgroup nextjs docker || true
```

### 2. Permisos de Usuario

Se agregó el usuario `nextjs` al grupo `docker` para permitir acceso al socket de Docker sin necesidad de ejecutar como root.

### 3. Socket de Docker Montado

El `docker-compose.yml` ya tenía el socket montado correctamente:

```yaml
frontend:
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
```

## Cómo Aplicar el Fix

### Opción 1: Usar Script de Reconstrucción (Recomendado)

**Windows:**
```bash
./rebuild-frontend.bat
```

**Linux/Mac:**
```bash
chmod +x rebuild-frontend.sh
./rebuild-frontend.sh
```

### Opción 2: Manual

```bash
# Detener contenedor
docker stop exalink-frontend

# Reconstruir imagen
docker-compose build --no-cache frontend

# Iniciar contenedor
docker-compose up -d frontend

# Verificar logs
docker logs -f exalink-frontend
```

## Verificación

Después de aplicar el fix, verificar que funciona correctamente:

1. **Verificar que Docker CLI está instalado:**
   ```bash
   docker exec exalink-frontend docker --version
   ```
   Debería mostrar: `Docker version X.X.X, build XXXXXX`

2. **Verificar acceso al socket:**
   ```bash
   docker exec exalink-frontend docker ps
   ```
   Debería listar los contenedores en ejecución

3. **Probar endpoint de logs:**
   - Acceder a la página de ajustes backend
   - Verificar que se muestran los logs de cada servicio
   - No debería aparecer el error "docker: not found"

## Funcionalidades Habilitadas

Con este fix, el frontend ahora puede:

✅ **Obtener logs de contenedores**
- Endpoint: `/api/config/backend/status`
- Función: `get_docker_container_logs(service_name, lines)`

✅ **Obtener estado de contenedores**
- Función: `getDockerContainerStatus(serviceName)`
- Métricas: CPU, memoria, uptime, status

✅ **Controlar contenedores**
- Iniciar: `startDockerContainer(serviceName)`
- Detener: `stopDockerContainer(serviceName)`
- Reiniciar: `restartDockerContainer(serviceName)`

✅ **Configurar restart policy**
- Función: `setContainerRestartPolicy(serviceName, autoStart)`

## Archivos Modificados

1. **`frontend-build/Dockerfile`**
   - Agregado `docker-cli` en etapa runner
   - Agregado usuario nextjs al grupo docker

2. **Scripts creados:**
   - `rebuild-frontend.bat` (Windows)
   - `rebuild-frontend.sh` (Linux/Mac)

## Consideraciones de Seguridad

⚠️ **Importante**: Dar acceso al socket de Docker es equivalente a dar acceso root al host. Asegúrate de:

1. **Montar el socket como solo lectura** (`:ro`) cuando sea posible
2. **Limitar los comandos** que se ejecutan desde el frontend
3. **Validar inputs** antes de ejecutar comandos docker
4. **No exponer** esta funcionalidad a usuarios no autenticados
5. **Usar autenticación** en todos los endpoints que ejecutan comandos docker

## Alternativas Consideradas

### Alternativa 1: API HTTP de Docker
Usar la API HTTP de Docker en lugar del socket:
```typescript
const response = await fetch('http://host.docker.internal:2375/containers/json');
```
**Pros**: No requiere cliente docker
**Contras**: Requiere exponer API de Docker en el host

### Alternativa 2: Servicio Intermedio
Crear un servicio backend dedicado para gestionar Docker:
```
Frontend -> Backend Docker Manager -> Docker Socket
```
**Pros**: Mejor separación de responsabilidades
**Contras**: Más complejo, más servicios

### Alternativa 3: Docker-in-Docker (DinD)
Ejecutar Docker dentro del contenedor:
```dockerfile
FROM docker:dind
```
**Pros**: Aislamiento completo
**Contras**: Mayor consumo de recursos, más complejo

## Solución Elegida

Se eligió la **Solución 1** (instalar docker-cli) porque:
- ✅ Simple y directa
- ✅ Bajo overhead
- ✅ Usa el socket del host (no duplica daemon)
- ✅ Fácil de mantener
- ✅ Compatible con la arquitectura actual

## Próximos Pasos

1. ✅ Reconstruir imagen del frontend
2. ✅ Verificar que los logs se muestran correctamente
3. ⏳ Probar control de contenedores (start/stop/restart)
4. ⏳ Implementar validación de permisos en endpoints
5. ⏳ Agregar rate limiting para comandos docker
6. ⏳ Documentar endpoints de gestión de contenedores

## Soporte

Si encuentras problemas después de aplicar el fix:

1. **Verificar logs del frontend:**
   ```bash
   docker logs exalink-frontend
   ```

2. **Verificar permisos del socket:**
   ```bash
   docker exec exalink-frontend ls -la /var/run/docker.sock
   ```

3. **Verificar grupo docker:**
   ```bash
   docker exec exalink-frontend id nextjs
   ```

4. **Reconstruir sin caché:**
   ```bash
   docker-compose build --no-cache frontend
   ```
