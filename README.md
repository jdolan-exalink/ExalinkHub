# ℹ️ Contexto

Siempre que se realice una nueva versión, cambio relevante o despliegue, este README debe ser actualizado para reflejar la información y pasos correctos.


# ExalinkHub v0.0.23

Sistema de monitoreo LPR, conteo y notificaciones. Instalación y despliegue rápido:

## 🚀 Instalación rápida

### 🆕 Cambios v0.0.23
- Corrección de formato ENV en Dockerfile para evitar warnings.
- Mejor documentación de recuperación de contenedores y volúmenes corruptos.
- Redirección principal a /live para usuarios autenticados.
- Mejoras en la gestión de permisos y troubleshooting.
## 🛠️ Recuperación forzada de contenedores y volúmenes

Si tienes errores de 'ContainerConfig' o no puedes borrar contenedores corriendo, ejecuta:

```bash
docker stop $(docker ps -aq)
docker rm -f $(docker ps -aq)
docker volume prune -f
docker system prune -af
docker-compose build --no-cache
docker-compose up -d --build
```

Esto detiene y elimina todos los contenedores, limpia volúmenes huérfanos y fuerza la reconstrucción completa.

1. Instala Docker y Docker Compose:
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker.io docker-compose-plugin
   ```

2. Descarga la última versión:
   ```bash
   git clone --branch v0.0.22 https://github.com/jdolan-exalink/ExalinkHub.git
   cd ExalinkHub
   ```

3. Despliega el sistema:
   ```bash
   chmod +x init.sh && ./init.sh && docker compose up --build -d
   ```

4. Accede a la vista en vivo:
   - http://<IP-del-servidor>:9002/live

## 📝 Notas
- Toda la configuración se gestiona vía la interfaz web y base de datos.
- No es necesario editar archivos .env para Frigate, MQTT ni servicios backend.
- Para gestión avanzada, usa los scripts `docker-deploy.sh` o `docker-deploy.bat`.

---
ExalinkHub © 2025

---

## �🚀 Despliegue con Docker Compose

Este proyecto incluye una configuración completa de Docker Compose que permite desplegar todo el sistema ExalinkHub con un solo comando.

### Servicios Incluidos

- **Frontend (Next.js)**: Dashboard web en puerto 9002
- **LPR Backend**: Sistema de reconocimiento de matrículas en puerto 2221
- **Conteo Backend**: Sistema de conteo vehicular en puerto 2223
- **Notificaciones Backend**: Sistema de notificaciones en puerto 2224
- **Redis**: Cache y almacenamiento temporal

### Inicio Rápido

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd ExalinkHub
   ```

2. **Desplegar con Docker Compose**
   ```bash
   docker-compose up --build -d
   ```

3. **Acceder al sistema**
   - Dashboard: http://localhost:9002
   - LPR Backend: http://localhost:2221
   - Conteo Backend: http://localhost:2223
   - Notificaciones Backend: http://localhost:2224

### Verificación de Estado

```bash
# Ver estado de contenedores
docker-compose ps

# Ver logs
docker-compose logs

# Health check del frontend
curl http://localhost:9002/api/health
```

### Configuración

Los servicios están configurados con:
- Redes Docker internas para comunicación segura
- Volúmenes persistentes para bases de datos
- Health checks automáticos
- Reinicio automático en caso de fallos

### Desarrollo

Para desarrollo local, restaurar el archivo override:
```bash
mv docker-compose.override.yml.backup docker-compose.override.yml
```

### Arquitectura

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   LPR Backend   │
│   (Next.js)     │◄──►│   (FastAPI)     │
│   Port: 9002    │    │   Port: 2221    │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Conteo Backend  │    │   Redis Cache   │
│   (FastAPI)     │◄──►│                 │
│   Port: 2223    │    └─────────────────┘
└─────────────────┘
         │
         ▼
┌─────────────────┐
│ Notificaciones  │
│   Backend       │
│   (FastAPI)     │
│   Port: 2224    │
└─────────────────┘
```

## 📋 Características

- ✅ Despliegue completo con Docker Compose
- ✅ Dashboard web moderno con Next.js
- ✅ Sistema LPR para reconocimiento de matrículas
- ✅ Conteo vehicular en tiempo real
- ✅ Sistema de notificaciones
- ✅ Bases de datos SQLite persistentes
- ✅ Health checks y monitoreo
- ✅ Configuración de red segura

## 🔧 Tecnologías

- **Frontend**: Next.js 15, React, TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python), Node.js
- **Base de datos**: SQLite
- **Cache**: Redis
- **Contenedorización**: Docker & Docker Compose 2025

Sistema unificado de gestión inteligente con IA para reconocimiento de matrículas (LPR), conteo de personas y notificaciones automatizadas.

## 🚀 Características Principales

- **Reconocimiento de Matrículas (LPR)**: Sistema avanzado de detección y reconocimiento de placas vehiculares
- **Conteo de Personas**: Análisis inteligente de flujo de personas con IA
- **Sistema de Notificaciones**: Alertas automáticas por email y otros canales
- **Interfaz Web Moderna**: Dashboard completo con Next.js y React
- **Arquitectura Microservicios**: Backend modular con APIs REST independientes
- **Despliegue con Docker**: Contenedorización completa para fácil distribución
- **Base de Datos SQLite**: Almacenamiento eficiente y portable
- **Monitoreo Integrado**: Métricas y health checks en tiempo real

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend APIs  │    │   Databases     │
│   Next.js       │◄──►│   FastAPI       │◄──►│   SQLite        │
│   React         │    │   Uvicorn       │    │   Redis Cache   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   LPR Service   │    │ Counting Service│    │Notification Svc│
│   OpenCV        │    │   YOLO/IA       │    │   SMTP Email    │
│   AI Models     │    │   Real-time     │    │   Templates     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📋 Prerrequisitos

- **Docker** 20.10+
- **Docker Compose** 2.0+
- **Git** (para clonar el repositorio)
- **4GB RAM** mínimo recomendado
- **10GB espacio en disco** para imágenes y datos

### Verificación de Prerrequisitos

```bash
# Verificar Docker
docker --version
docker-compose --version

# Verificar puertos disponibles
netstat -tulpn | grep -E ':(2221|2223|2224|2280|2443|9002)'
```

## 🚀 Despliegue Rápido

### Opción 1: Despliegue Completo (Recomendado)

```bash
# 1. Clonar el repositorio
git clone https://github.com/jdolan-exalink/ExalinkHub.git
cd ExalinkHub

# 2. Configurar variables de entorno (opcional)
cp .env.example .env

# 3. Ejecutar script de inicialización
chmod +x init.sh
./init.sh

# 4. Construir e iniciar todos los servicios
docker-compose up --build -d

# 5. Verificar que todo esté funcionando
docker-compose ps
```

### Opción 2: Despliegue para Desarrollo

```bash
# Para desarrollo con hot-reload
docker-compose -f docker-compose.yml -f docker-compose.override.yml up --build
```

### Acceder al Sistema

- **Dashboard Principal**: http://localhost:9002
- **LPR Backend**: http://localhost:2221/docs (API docs)
- **Conteo Backend**: http://localhost:2223/docs
- **Notificaciones Backend**: http://localhost:2224/docs

### Servicios Incluidos

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| Frontend | 9002 | Interfaz web principal |
| LPR Backend | 2221 | API de reconocimiento de matrículas |
| Conteo Backend | 2223 | API de conteo de personas |
| Notificaciones | 2224 | API de notificaciones |
| Redis | 6379 | Cache y sesiones |
| Nginx Proxy | 2280/2443 | Proxy reverso (opcional) |

## 🛠️ Desarrollo Local

### Configuración del Entorno

```bash
# Instalar dependencias
npm install

# Configurar base de datos de desarrollo
npm run db:init

# Iniciar servicios backend (en otra terminal)
docker-compose up lpr-backend conteo-backend notificaciones-backend -d

# Iniciar frontend en modo desarrollo
npm run dev
```

### Estructura del Proyecto

```
ExalinkHub/
├── src/                    # Código fuente del frontend
│   ├── app/               # Páginas Next.js
│   ├── components/        # Componentes React
│   └── lib/               # Utilidades
├── backend/               # Servicios backend
│   ├── lpr/              # Servicio LPR
│   ├── conteo/           # Servicio de conteo
│   └── notificaciones/   # Servicio de notificaciones
├── DB/                    # Bases de datos SQLite
├── docker-compose.yml     # Configuración Docker
└── Dockerfile.frontend    # Dockerfile del frontend
```

## 🚀 Despliegue Rápido

### 1. Clonar el Repositorio

```bash
git clone https://github.com/jdolan-exalink/ExalinkHub.git
cd ExalinkHub
```

### 2. Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar configuración según tus necesidades
nano .env  # o usa tu editor preferido
```

### 3. Desplegar el Sistema Completo

**Opción A: Usando script de deployment (Recomendado)**

**Linux/macOS:**
```bash
chmod +x docker-deploy.sh
./docker-deploy.sh deploy
```

**Windows:**
```cmd
docker-deploy.bat deploy
```

**Opción B: Usando Docker Compose directamente**
```bash
# Construir y desplegar
docker-compose up -d --build

# Verificar estado
docker-compose ps
```

### 4. Acceder al Sistema

- **Aplicación Web**: http://localhost:9002
- **API LPR**: http://localhost:2221
- **API Conteo**: http://localhost:2223
- **API Notificaciones**: http://localhost:2224

## 🔧 Servicios y Puertos

| Servicio | Puerto | Descripción | Estado |
|----------|--------|-------------|--------|
| **Frontend** | 9002 | Interfaz web Next.js | ✅ |
| **LPR Backend** | 2221 | API reconocimiento matrículas | ✅ |
| **Conteo Backend** | 2223 | API conteo de personas | ✅ |
| **Notificaciones** | 2224 | API sistema de alertas | ✅ |
| **Redis Cache** | 6379 | Cache y sesiones | ✅ |
| **Proxy Nginx** | 2280/2443 | Proxy reverso (opcional) | ⚠️ |
| **Node Exporter** | 9100 | Métricas sistema (opcional) | ⚠️ |

## ⚙️ Configuración Avanzada

### Variables de Entorno Principales

```bash
# Puertos de servicios
LPR_PORT=2221
CONTEO_PORT=2223
NOTIFICACIONES_PORT=2224

# Base de datos Redis
REDIS_PASSWORD=tu_password_seguro

# Configuración de email (para notificaciones)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=tu-email@gmail.com
SMTP_PASSWORD=tu-app-password

# Zona horaria
TZ=America/Mexico_City

# Modo debug
DEBUG=false
```

### Configuración de Servicios Individuales

Cada backend tiene archivos de configuración JSON en `backend/*/config/`:

- `lpr_config.json` - Configuración LPR
- `counting_config.json` - Configuración conteo
- `notifications_config.json` - Configuración notificaciones

## 📊 Monitoreo y Gestión

### Verificar Estado de Servicios

```bash
# Estado completo
./docker-deploy.sh status

# Ver logs de un servicio específico
./docker-deploy.sh logs lpr-backend

# Acceder a shell de un contenedor
./docker-deploy.sh shell lpr-backend
```

### Health Checks

```bash
# Verificar APIs individuales
curl http://localhost:2221/health
curl http://localhost:2223/health
curl http://localhost:2224/health
```

## 🔄 Gestión del Sistema

### Comandos Útiles

```bash
# Detener todos los servicios
./docker-deploy.sh stop

# Reiniciar servicios
./docker-deploy.sh restart

# Limpiar sistema (eliminar contenedores, volúmenes, imágenes)
./docker-deploy.sh cleanup

# Crear backup de datos
./docker-deploy.sh backup

# Actualizar sistema
./docker-deploy.sh update
```

### Gestión Manual con Docker Compose

```bash
# Ver estado de contenedores
docker-compose ps

# Ver logs en tiempo real
docker-compose logs -f

# Reiniciar un servicio específico
docker-compose restart lpr-backend

# Escalar servicios (si aplica)
docker-compose up -d --scale lpr-backend=2
```



## ⚠️ Advertencia sobre permisos y contexto de build

Si ves errores como `permission denied: unknown` relacionados con `/usr/local/bin/docker-entrypoint.sh`, ejecuta:

```bash
docker-compose build --no-cache
docker-compose down -v
docker-compose up -d --build
```

**Importante:** Ejecuta siempre los comandos de build y despliegue desde la raíz del proyecto (`ExalinkHub`) para que el contexto incluya todos los archivos necesarios, especialmente `backend/lpr/docker-entrypoint.sh`.

Esto fuerza la reconstrucción de la imagen y aplica los permisos correctos.

Si ves errores como `permission denied: unknown` relacionados con `/usr/local/bin/docker-entrypoint.sh`, ejecuta:

```bash
docker-compose build --no-cache
docker-compose down -v
docker-compose up -d --build
```

Esto fuerza la reconstrucción de la imagen y aplica los permisos correctos.

## 🐛 Solución de Problemas

### Problemas Comunes

1. **Puerto ocupado**: Verifica que los puertos 2221, 2223, 2224, 9002 estén libres
2. **Error de build**: Asegúrate de tener suficiente espacio en disco
3. **Servicio no responde**: Revisa logs con `./docker-deploy.sh logs [servicio]`
4. **Configuración inválida**: Valida el archivo `.env` con `docker-compose config`

### Logs y Debugging

```bash
# Logs completos
docker-compose logs

# Logs de un servicio específico
docker-compose logs lpr-backend

# Logs en tiempo real
docker-compose logs -f lpr-backend

# Verificar configuración
docker-compose config
```



### Solución de error de permisos en base de datos SQLite

Si ves errores como `SqliteError: attempt to write a readonly database`, asegúrate de que la carpeta `DB/` y todos los archivos `.db` tengan permisos de escritura para el usuario que ejecuta los contenedores.

En Linux/macOS, ejecuta:

```bash
chmod -R 777 DB/
```

En Windows, verifica que los archivos no estén marcados como solo lectura y que el usuario de Docker tenga acceso total.

Haz esto antes de desplegar para evitar problemas de escritura en la base de datos.

Si ves errores como `KeyError: 'ContainerConfig'` o problemas al recrear contenedores, sigue estos pasos para limpiar y reconstruir el entorno local:

```bash
docker-compose down -v
docker system prune -af
docker volume prune -f
docker-compose build --no-cache
docker-compose up -d --build
```

Esto elimina contenedores y volúmenes huérfanos, limpia imágenes corruptas y fuerza la reconstrucción completa.

### Recuperación de Errores

```bash
# Reiniciar servicios fallidos
docker-compose restart

# Reconstruir imágenes
docker-compose build --no-cache

# Reset completo
docker-compose down -v
docker-compose up -d --build
```

## 📁 Estructura del Proyecto

```
ExalinkHub/
├── backend/                    # Servicios backend
│   ├── lpr/                   # Backend LPR
│   ├── conteo/               # Backend conteo
│   └── notificaciones/       # Backend notificaciones
├── src/                       # Código fuente frontend
├── public/                    # Archivos estáticos
├── DB/                        # Bases de datos SQLite
├── docker-compose.yml         # Configuración Docker
├── docker-deploy.sh          # Script deployment Linux
├── docker-deploy.bat         # Script deployment Windows
├── .env.example              # Variables de entorno
└── README.md                 # Esta documentación
```

## 🔒 Seguridad

- **Contenedores no-root**: Todos los servicios corren con usuarios no privilegiados
- **Redes aisladas**: Servicios en redes Docker dedicadas
- **Variables seguras**: Credenciales en variables de entorno
- **Health checks**: Monitoreo automático de servicios
- **Actualizaciones**: Mecanismos para updates seguros

## 📞 Soporte

Para soporte técnico o reportar issues:

1. Revisa los logs del sistema
2. Consulta la documentación específica en `context/`
3. Reporta issues en el repositorio GitHub

## 📝 Licencia

Este proyecto es propiedad de Exalink. Todos los derechos reservados.

---

**Versión**: 1.0.0
**Última actualización**: Octubre 2025 (v0.0.22)
**Documentación técnica**: Consulta archivos en `context/` y documentación específica de cada backend.
