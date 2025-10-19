# Configuración SSH para Backend LPR

## Descripción

Este documento explica cómo configurar SSH/SCP para que el backend LPR pueda descargar crops de matrículas directamente desde el servidor Frigate.

## Requisitos Previos

1. **Servidor Frigate**: Debe tener SSH habilitado y accesible
2. **Usuario SSH**: Necesitas un usuario con permisos para acceder al directorio `/media/frigate/clips/lpr/`
3. **Backend LPR**: Ya configurado con credenciales SSH

## Configuración del Usuario SSH

### Opción 1: Servidor Linux/Unix

Ejecuta el script `create-frigate-user.sh` como root en el servidor Frigate:

```bash
# Copiar el script al servidor Frigate
scp create-frigate-user.sh usuario@servidor-frigate:/tmp/

# Ejecutar como root
ssh usuario@servidor-frigate
sudo bash /tmp/create-frigate-user.sh
```

### Opción 2: Servidor Windows

Ejecuta el script `create-frigate-user.ps1` como Administrador en el servidor Frigate:

```powershell
# Copiar el script al servidor Frigate
# Luego ejecutar como Administrador:
.\create-frigate-user.ps1
```

## Configuración en el Backend LPR

### Usando la API REST

```bash
# Configurar SSH vía API
curl -X POST http://localhost:2221/api/preferences \
  -H "Authorization: Basic YWRtaW46YWRtaW4xMjM=" \
  -H "Content-Type: application/json" \
  -d '{
    "ssh": {
      "enabled": true,
      "host": "10.147.18.148",
      "port": 22,
      "username": "frigate",
      "password": "frigate123",
      "remote_lpr_path": "/media/frigate/clips/lpr",
      "local_storage_path": "./data/lpr_crops"
    }
  }'
```

### Usando Variables de Entorno

En `docker-compose.yml`:

```yaml
environment:
  - SSH_ENABLED=true
  - SSH_HOST=10.147.18.148
  - SSH_PORT=22
  - SSH_USERNAME=frigate
  - SSH_PASSWORD=frigate123
  - SSH_REMOTE_LPR_PATH=/media/frigate/clips/lpr
  - SSH_LOCAL_STORAGE_PATH=./data/lpr_crops
```

## Pruebas de Conexión

### Probar Conexión SSH

```bash
# Usando curl
curl -X POST http://localhost:2221/api/ssh/test \
  -H "Authorization: Basic YWRtaW46YWRtaW4xMjM=" \
  -H "Content-Type: application/json" \
  -d "{}"
```

### Listar Archivos Disponibles

```bash
# Ver archivos en el directorio remoto
curl -X GET http://localhost:2221/api/ssh/list-files \
  -H "Authorization: Basic YWRtaW46YWRtaW4xMjM="
```

### Probar Descarga de Archivo

```bash
# Descargar un archivo específico
curl -X POST http://localhost:2221/api/ssh/download-test \
  -H "Authorization: Basic YWRtaW46YWRtaW4xMjM=" \
  -H "Content-Type: application/json" \
  -d '{"filename": "archivo.jpg"}'
```

## Estructura de Directorios

### En el Servidor Frigate

```
/media/frigate/clips/lpr/
├── camera1_2025-10-14_10-30-00_AH110LS.jpg
├── camera2_2025-10-14_11-15-30_BC234CD.jpg
└── ...
```

### En el Backend LPR

```
data/lpr_crops/
├── ssh_camera1_2025-10-14_10-30-00_AH110LS.jpg
├── ssh_camera2_2025-10-14_11-15-30_BC234CD.jpg
└── ...
```

## Funcionamiento

1. **Detección LPR**: El backend recibe eventos MQTT con matrículas detectadas
2. **Búsqueda de Crops**: Si no se puede descargar vía HTTP, busca crops vía SSH
3. **Descarga Automática**: Descarga archivos que coincidan con la matrícula y timestamp
4. **Almacenamiento Local**: Guarda los crops en `data/lpr_crops/` para acceso rápido

## Seguridad

### Recomendaciones de Producción

1. **Usar Claves SSH**: En lugar de contraseñas, usa autenticación por clave privada
2. **Usuario Dedicado**: Crea un usuario específico para LPR sin permisos administrativos
3. **Restricciones de Red**: Limita el acceso SSH solo desde IPs conocidas
4. **Monitoreo**: Registra y monitorea las conexiones SSH
5. **Rotación de Credenciales**: Cambia contraseñas periódicamente

### Configuración con Clave Privada

```bash
# Generar clave SSH
ssh-keygen -t rsa -b 4096 -C "lpr-backend@exalink"

# Copiar clave pública al servidor Frigate
ssh-copy-id frigate@10.147.18.148

# Configurar en el backend
{
  "ssh": {
    "enabled": true,
    "host": "10.147.18.148",
    "port": 22,
    "username": "frigate",
    "key_path": "/app/.ssh/id_rsa",
    "remote_lpr_path": "/media/frigate/clips/lpr",
    "local_storage_path": "./data/lpr_crops"
  }
}
```

## Solución de Problemas

### Error: "SSH no está habilitado"

- Verifica que `ssh.enabled` esté en `true` en la configuración
- Reinicia el contenedor LPR después de cambiar la configuración

### Error: "Conexión SSH fallida"

- Verifica que el servidor SSH esté ejecutándose en el puerto correcto
- Confirma que el usuario y contraseña sean correctos
- Revisa firewalls y configuraciones de red

### Error: "Directorio remoto no existe"

- Crea el directorio `/media/frigate/clips/lpr/` en el servidor Frigate
- Asegúrate de que el usuario SSH tenga permisos de lectura

### Error: "No se encontraron crops"

- Verifica que Frigate esté guardando crops en el directorio esperado
- Revisa los nombres de archivos generados por Frigate
- Ajusta los patrones de búsqueda en el código si es necesario

## Logs de Depuración

Los logs del backend LPR muestran información detallada sobre las operaciones SSH:

```
🔗 Conectado a SSH: 10.147.18.148:22
📁 Encontrados 5 archivos candidatos
📥 Descargando: /media/frigate/clips/lpr/camera1_AH110LS.jpg -> ./data/lpr_crops/ssh_camera1_AH110LS.jpg
✅ Crop descargado vía SSH: ./data/lpr_crops/ssh_camera1_AH110LS.jpg
```