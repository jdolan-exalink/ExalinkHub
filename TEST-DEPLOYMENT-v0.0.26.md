# Guía de Prueba - Versión 0.0.26

## 🚀 Novedades de la v0.0.26

### **Correcciones Principales:**
- ✅ **Sincronización Docker:** Corregida completamente la sincronización de versión entre código fuente y contenedores
- ✅ **Warnings npm:** Solucionados todos los warnings de paquetes deprecados durante la construcción
- ✅ **Consistencia:** Asegurada consistencia entre package.json raíz y frontend-build
- ✅ **Dockerfile optimizado:** Mejorado para garantizar copia correcta de archivos de versión

## 📋 Pasos para Prueba Limpia

### 1. Descarga y Verificación

```bash
# Clonar el repositorio
git clone https://github.com/jdolan-exalink/ExalinkHub.git test-v0.0.26
cd test-v0.0.26

# Usar la versión específica
git checkout v0.0.26

# Verificar versión en archivos fuente
cat package.json | grep version  # Debe mostrar "0.0.26"
cat changelog.json | grep "currentVersion"  # Debe mostrar "0.0.26"
cat frontend-build/package.json | grep version  # Debe mostrar "0.0.26"
```

### 2. Construcción sin Warnings

```bash
# Configurar variables de entorno
cp .env.example .env
# Editar .env con configuración básica si es necesario

# Construir imágenes (debería mostrar menos warnings)
docker-compose build --no-cache

# Verificar que la construcción complete sin errores críticos
# Los warnings de npm deprecados deberían estar reducidos
```

### 3. Verificación de Contenedores

```bash
# Levantar servicios
docker-compose up -d

# Verificar estado
docker-compose ps

# Verificar versión en contenedor (AHORA DEBE FUNCIONAR)
docker exec exalink-frontend cat /app/package.json | grep version
# Debe mostrar: "version": "0.0.26"
```

### 4. Pruebas Funcionales

1. **Acceso Web:**
   - URL: `http://localhost:9002`
   - Usuario: `admin`
   - Contraseña: `admin123`

2. **Verificar Mejoras:**
   - ✅ Menú muestra "Funciones" (no "Paneles")
   - ✅ Icono de matrículas es tarjeta de crédito
   - ✅ Todos los paneles visibles
   - ✅ Versión correcta en contenedor

3. **Verificar API:**
   ```bash
   curl http://localhost:9002/api/config/backend/status
   curl http://localhost:9002/api/health
   ```

## ✅ Criterios de Éxito v0.0.26

La prueba es exitosa si:

1. **✅ Descarga correcta:** Código se descarga sin errores
2. **✅ Versión correcta:** package.json muestra "0.0.26" en todos los lugares
3. **✅ Construcción mejorada:** Menos warnings de npm durante build
4. **✅ Contenedor sincronizado:** Docker exec muestra "0.0.26"
5. **✅ Servicios corriendo:** Todos los contenedores "Up (healthy)"
6. **✅ Interfaz funcional:** Aplicación responde correctamente
7. **✅ Mejoras visibles:** Todos los cambios de UI presentes

## 🐛 Troubleshooting Específico v0.0.26

### Si la versión sigue siendo incorrecta:

```bash
# Limpiar completamente
docker-compose down
docker system prune -f --volumes

# Reconstruir sin caché
docker-compose build --no-cache --pull

# Verificar archivos fuente antes de construir
cat package.json | grep version
cat frontend-build/package.json | grep version
```

### Si hay warnings de npm:

Los siguientes warnings son conocidos y aceptables en v0.0.26:
- `rimraf@3.0.2` - Dependencia transitiva, no crítico
- `npmlog@6.0.2` - Dependencia transitiva, no crítico
- `glob@7.2.3` - Dependencia transitiva, no crítico

Los warnings que deberían estar reducidos:
- Mensajes sobre `--omit=dev` (ahora usa sintaxis correcta)
- Warnings de construcción de imágenes

## 📊 Reporte de Prueba v0.0.26

Una vez completada la prueba, reportar:

- [ ] Versión descargada: v0.0.26 ✅
- [ ] package.json raíz: "0.0.26" ✅
- [ ] package.json frontend-build: "0.0.26" ✅
- [ ] Docker build: Exitoso con menos warnings ✅
- [ ] Contenedor versión: "0.0.26" ✅
- [ ] Contenedores: Todos healthy ✅
- [ ] Interfaz web: Funcional ✅
- [ ] Mejoras UI: Visibles ✅
- [ ] Warnings npm: Reducidos ✅
- [ ] Tiempo total de instalación: ___ minutos

## 🔄 Limpieza

```bash
# Detener y limpiar
docker-compose down
docker system prune -f
cd ..
rm -rf test-v0.0.26
```

---

**Nota:** Esta versión 0.0.26 está específicamente diseñada para resolver los problemas de sincronización de versión y optimizar el proceso de construcción. Todos los cambios anteriores de las v0.0.24 y v0.0.25 están incluidos.