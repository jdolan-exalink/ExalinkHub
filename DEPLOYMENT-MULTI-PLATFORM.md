# Despliegue Multi-Plataforma - ExalinkHub

## ✅ Compatibilidad con Docker Compose

Los scripts automáticamente detectan y usan la versión correcta de Docker Compose:

- **Docker Compose v2+** (integrado en Docker): `docker compose`
- **Docker Compose v1** (standalone): `docker-compose`

No necesitas preocuparte por la versión - los scripts lo detectan automáticamente.

## 🚀 Despliegue Rápido

### Linux / macOS
```bash
# Hacer ejecutable el script (solo la primera vez)
chmod +x deploy-linux.sh

# Ejecutar despliegue completo
./deploy-linux.sh
```

### Windows
```batch
# Ejecutar despliegue completo
deploy.bat
```

### Manual (si los scripts fallan)
```bash
# Asegurarse de estar en el directorio raíz del proyecto
cd /ruta/al/proyecto/ExalinkHub

# Construir y levantar servicios
docker compose up -d --build
```

## 🔧 Solución al Error de Paths

Si encuentras el error:
```
ERROR: build path /opt/ExalinkHub/backend/Conteo/services/api either does not exist, is not accessible, or is not a valid URL.
```

**Causa:** El comando `docker compose` se está ejecutando desde dentro de un contenedor Docker o desde un directorio incorrecto.

**Solución:** Usa los scripts de despliegue que automáticamente cambian al directorio correcto:

- **Linux/macOS:** `./deploy-linux.sh`
- **Windows:** `deploy.bat`

Estos scripts:
1. ✅ Verifican que Docker esté corriendo
2. ✅ Cambian al directorio correcto del proyecto
3. ✅ Sincronizan el código fuente (si aplica)
4. ✅ Ejecutan `docker compose up -d --build` con paths correctos

## 📋 Verificación del Despliegue

Después del despliegue, verifica que todo esté funcionando:

```bash
# Ver estado de servicios
docker compose ps

# Ver logs si hay problemas
docker compose logs -f

# Probar APIs
curl http://localhost:9002/api/health
curl http://localhost:2223/api/info
```

## 🌐 Servicios Disponibles

- **Frontend:** http://localhost:9002
- **API LPR:** http://localhost:2221
- **API Conteo:** http://localhost:2223
- **API Notificaciones:** http://localhost:2224

## 🐛 Troubleshooting

### Error de paths en Linux
Si el error persiste en Linux, ejecuta:
```bash
# Verificar directorio actual
pwd

# Cambiar manualmente al directorio del proyecto
cd /ruta/correcta/al/proyecto/ExalinkHub

# Verificar que docker-compose.yml existe
ls -la docker-compose.yml

# Ejecutar con path absoluto
docker compose -f $(pwd)/docker-compose.yml up -d --build
```

### Servicios no inician
```bash
# Ver logs detallados
docker compose logs

# Reiniciar servicios específicos
docker compose restart conteo-backend

# Reconstruir imagen específica
docker compose build --no-cache conteo-backend
```