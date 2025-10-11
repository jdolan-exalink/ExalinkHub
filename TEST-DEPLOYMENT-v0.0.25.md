# Guía de Prueba - Despliegue v0.0.25

## 🚀 Prueba de Descarga e Instalación

Esta guía está diseñada para probar que la versión v0.0.25 se puede descargar e instalar correctamente en un servidor nuevo.

## 📋 Pasos para Probar

### 1. Descarga Directa desde GitHub

```bash
# Opción A: Clonar el repositorio
git clone https://github.com/jdolan-exalink/ExalinkHub.git test-deployment
cd test-deployment

# Opción B: Descargar versión específica
wget https://github.com/jdolan-exalink/ExalinkHub/archive/refs/tags/v0.0.25.tar.gz
tar -xzf v0.0.25.tar.gz
cd ExalinkHub-0.0.25

# Verificar que estamos en la versión correcta
git checkout v0.0.25
git tag  # Debería mostrar v0.0.25

# Verificar versión en package.json
cat package.json | grep version  # Debería mostrar "0.0.25"

# Verificar changelog
cat changelog.json | grep "currentVersion"  # Debería mostrar "0.0.25"
```

### 2. Configuración Rápida

```bash
# Copiar variables de entorno
cp .env.example .env

# Editar configuración básica
nano .env
```

**Configuración mínima para prueba:**
```env
FRONTEND_PORT=9002
LPR_PORT=2221
CONTEO_PORT=2223
NOTIFICACIONES_PORT=2224
REDIS_PASSWORD=test123
```

### 3. Construcción y Despliegue

```bash
# Construir imágenes
docker-compose build

# Levantar servicios
docker-compose up -d

# Verificar estado
docker-compose ps
```

### 4. Verificación de Versión

```bash
# Verificar versión en el contenedor
docker exec exalink-frontend cat /app/package.json | grep version
# Debería mostrar: "version": "0.0.25"

# Verificar que los servicios estén healthy
docker-compose ps
# Todos deberían mostrar "Up (healthy)"

# Verificar logs
docker-compose logs -f frontend | head -20
```

### 5. Pruebas Funcionales

1. **Acceso Web:**
   - URL: `http://localhost:9002`
   - Usuario: `admin`
   - Contraseña: `admin123`

2. **Verificar en la interfaz:**
   - El menú debe mostrar "Funciones" (no "Paneles")
   - El icono de matrículas debe ser una tarjeta de crédito
   - Todos los paneles deben ser visibles

3. **Verificar API:**
   ```bash
   curl http://localhost:9002/api/config/backend/status
   curl http://localhost:9002/api/health
   ```

## ✅ Criterios de Éxito

La prueba es exitosa si:

1. **✅ Descarga correcta:** El código se descarga sin errores
2. **✅ Versión correcta:** package.json muestra "0.0.25"
3. **✅ Construcción exitosa:** Docker build completa sin errores
4. **✅ Servicios corriendo:** Todos los contenedores están "Up (healthy)"
5. **✅ Interfaz funcional:** La aplicación responde en http://localhost:9002
6. **✅ Mejoras visibles:** Se ven los cambios de la v0.0.24/0.0.25

## 🐛 Troubleshooting

### Si la versión no es la correcta:

```bash
# Limpiar completamente
docker-compose down
docker system prune -f

# Reconstruir sin caché
docker-compose build --no-cache

# Verificar código fuente
cat package.json | grep version
```

### Si los contenedores no inician:

```bash
# Verificar logs
docker-compose logs frontend
docker-compose logs lpr-backend

# Verificar puertos disponibles
netstat -tulpn | grep :9002
```

### Si la interfaz no carga:

```bash
# Verificar que el frontend esté corriendo
docker ps | grep frontend

# Reiniciar solo el frontend
docker-compose restart frontend
```

## 📊 Reporte de Prueba

Una vez completada la prueba, reportar:

- [ ] Versión descargada: v0.0.25 ✅
- [ ] package.json muestra: "0.0.25" ✅
- [ ] Docker build: Exitoso ✅
- [ ] Contenedores: Todos healthy ✅
- [ ] Interfaz web: Funcional ✅
- [ ] Mejoras visibles: Sí ✅
- [ ] Tiempo total de instalación: ___ minutos

## 🔄 Limpieza

```bash
# Detener y limpiar
docker-compose down
docker system prune -f
cd ..
rm -rf test-deployment
```

---

**Nota:** Esta prueba valida que el flujo completo de descarga e instalación funciona correctamente para nuevos usuarios.