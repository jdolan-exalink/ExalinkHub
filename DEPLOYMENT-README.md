# 🚀 Despliegue del Sistema Exalink

## 📋 Requisitos Previos

- **Docker Desktop** instalado y corriendo
- **Docker Compose** V2
- **Git** (opcional, para clonar el repositorio)

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   LPR Backend   │
│   (Next.js)     │◄──►│   (Python)      │
│   Puerto: 9002  │    │   Puerto: 2221  │
└─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌─────────────────┐
│ Conteo Backend  │    │     Redis       │
│   (Python)      │    │   Puerto: 6379  │
│   Puerto: 2223  │    └─────────────────┘
└─────────────────┘
         │
         ▼
┌─────────────────┐
│Notificaciones   │
│   Backend       │
│   (Python)      │
│   Puerto: 2224  │
└─────────────────┘
```

## 🚀 Despliegue Rápido

### Opción 1: Script Automático (Recomendado)

**Windows:**
```bash
# Ejecutar el script de despliegue
deploy.bat
```

**Linux/Mac:**
```bash
# Dar permisos de ejecución al script
chmod +x deploy.sh

# Ejecutar el script
./deploy.sh
```

### Opción 2: Despliegue Manual

```bash
# 1. Clonar o navegar al repositorio
cd ExalinkHub

# 2. Construir y desplegar todos los servicios
docker compose up --build -d

# 3. Verificar estado
docker compose ps
```

## 🔧 Configuración

### Variables de Entorno

El sistema utiliza las siguientes variables de entorno (configuradas en `.env`):

```bash
# Frontend
FRONTEND_PORT=9002

# Servicios Backend
LPR_PORT=2221
CONTEO_PORT=2223
NOTIFICACIONES_PORT=2224

# Base de datos
DATABASE_URL=sqlite:///./DB/matriculas.db

# MQTT (para comunicación con Frigate)
MQTT_HOST=10.1.1.250
MQTT_PORT=1883
MQTT_USERNAME=juan
MQTT_PASSWORD=daytona1309

# Frigate
FRIGATE_HOST=10.1.1.252
FRIGATE_PORT=5000
```

### Personalización

1. **Editar configuración:**
   ```bash
   # Copiar archivo de ejemplo
   cp .env.example .env

   # Editar variables según tu entorno
   nano .env
   ```

2. **Configuración de servicios:**
   - Los servicios backend se configuran desde la interfaz web
   - Las configuraciones se guardan en la base de datos SQLite

## 🌐 Acceso al Sistema

Una vez desplegado, accede a:

- **Interfaz Principal:** http://localhost:9002
- **API LPR:** http://localhost:2221
- **API Conteo:** http://localhost:2223
- **API Notificaciones:** http://localhost:2224

## 📊 Monitoreo y Logs

### Ver Estado de Servicios
```bash
docker compose ps
```

### Ver Logs en Tiempo Real
```bash
# Todos los servicios
docker compose logs -f

# Servicio específico
docker compose logs -f frontend
docker compose logs -f lpr-backend
```

### Ver Recursos de Contenedores
```bash
docker stats
```

## 🛠️ Comandos Útiles

```bash
# Detener todos los servicios
docker compose down

# Reiniciar un servicio específico
docker compose restart frontend

# Reconstruir una imagen específica
docker compose build --no-cache frontend

# Limpiar contenedores e imágenes no utilizadas
docker system prune -a

# Ver uso de disco
docker system df
```

## 🔍 Solución de Problemas

### Servicio No Inicia
```bash
# Ver logs detallados
docker compose logs [service-name]

# Reiniciar servicio
docker compose restart [service-name]
```

### Puerto Ya en Uso
```bash
# Cambiar puerto en .env
FRONTEND_PORT=9003

# Reiniciar servicios
docker compose down && docker compose up -d
```

### Problemas de Conexión
```bash
# Verificar conectividad de red
docker network ls
docker network inspect exalinkhub_lpr-network
```

### Base de Datos
```bash
# Acceder a la base de datos
docker exec -it exalink-frontend sqlite3 /app/DB/config.db

# Ver tablas
.schema
```

## 📁 Estructura de Archivos

```
ExalinkHub/
├── docker-compose.yml          # Configuración principal
├── Dockerfile.frontend         # Dockerfile del frontend
├── nginx.conf                  # Configuración del proxy
├── .env                        # Variables de entorno
├── .env.example               # Ejemplo de configuración
├── deploy.bat                  # Script Windows
├── deploy.sh                   # Script Linux/Mac
├── DB/                         # Bases de datos
├── backend/                    # Servicios backend
│   ├── lpr/
│   ├── conteo/
│   └── notificaciones/
└── src/                        # Código fuente frontend
```

## 🔒 Seguridad

- **No usar en producción** sin configuración SSL adicional
- Cambiar contraseñas por defecto en `.env`
- Configurar firewall para puertos expuestos
- Usar secrets de Docker para credenciales sensibles

## 📞 Soporte

Para problemas o preguntas:
1. Revisar logs: `docker compose logs`
2. Verificar estado: `docker compose ps`
3. Consultar documentación en `context/`
4. Revisar issues en el repositorio

---

**Estado del Sistema:** ✅ Totalmente funcional con métricas reales de Docker