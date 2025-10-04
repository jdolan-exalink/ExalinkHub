# Guía de Configuración y Debug JWT para Frigate

## Configuración de Autenticación JWT en Frigate

### 1. Configuración del Servidor Frigate

Para habilitar autenticación JWT en Frigate, debes agregar la siguiente configuración en tu archivo `config.yml`:

```yaml
auth:
  enabled: true
  secret_key: "tu_clave_secreta_muy_larga_y_segura_de_al_menos_32_caracteres"
  users:
    - username: "admin"
      password: "tu_contraseña_segura"
    - username: "operador"
      password: "otra_contraseña_segura"
```

### 2. Configuración en el Sistema de Monitoreo

#### Datos de Conexión Requeridos:

- **Nombre del Servidor**: Un nombre descriptivo (ej: "Frigate Principal")
- **URL del Servidor**: Puede ser IP completa o solo el host
  - Formato completo: `https://10.1.1.252:8971`
  - Solo IP/dominio: `10.1.1.252`
- **Protocolo**: Seleccionar HTTPS para conexiones seguras
- **Puerto**: 8971 (puerto HTTPS de Frigate) o el puerto que tengas configurado
- **Tipo de Autenticación**: JWT Token (Recomendado)
- **Usuario**: El usuario configurado en Frigate
- **Contraseña**: La contraseña del usuario

### 3. Proceso de Autenticación JWT

El sistema sigue este flujo:

1. **Login Inicial**: Se envía una solicitud POST a `/api/login` con credenciales
2. **Obtención del Token**: Frigate devuelve un `access_token` válido por 24 horas
3. **Uso del Token**: El token se incluye en todas las solicitudes como `Authorization: Bearer TOKEN`
4. **Renovación Automática**: El sistema renueva el token automáticamente cuando es necesario

### 4. Endpoints de API Utilizados

El sistema verifica los siguientes endpoints según la documentación oficial:

```bash
# 1. Login para obtener token
POST https://tu-servidor-frigate/api/login
Content-Type: application/x-www-form-urlencoded
Body: username=admin&password=tu_contraseña

# 2. Verificación de estado del sistema
GET https://tu-servidor-frigate/api/stats
Authorization: Bearer tu_token_jwt

# 3. Configuración del servidor
GET https://tu-servidor-frigate/api/config
Authorization: Bearer tu_token_jwt

# 4. Versión de Frigate
GET https://tu-servidor-frigate/api/version
Authorization: Bearer tu_token_jwt
```

## Debugging y Resolución de Problemas

### Errores Comunes y Soluciones

#### 1. "Error obteniendo token JWT: Failed to fetch"
**Causa**: Problema de conectividad de red o URL incorrecta
**Solución**:
- Verifica que la URL sea accesible desde tu navegador
- Confirma que el puerto esté abierto
- Verifica el protocolo (HTTP vs HTTPS)

#### 2. "Credenciales inválidas - Usuario o contraseña incorrectos"
**Causa**: Las credenciales no coinciden con la configuración de Frigate
**Solución**:
- Verifica el archivo `config.yml` de Frigate
- Confirma que el usuario existe en la sección `auth.users`
- Verifica que la contraseña sea correcta

#### 3. "Endpoint /api/login no encontrado"
**Causa**: Versión de Frigate que no soporta JWT o autenticación deshabilitada
**Solución**:
- Actualiza Frigate a la versión 0.13+ 
- Verifica que `auth.enabled: true` esté en config.yml
- Reinicia el servicio de Frigate después de cambios

#### 4. "Error HTTP 422: Datos de login inválidos"
**Causa**: Formato incorrecto de los datos de login
**Solución**:
- El sistema envía automáticamente en formato `application/x-www-form-urlencoded`
- No requiere acción manual

### Herramientas de Debug

#### 1. Consola del Navegador
Abre las herramientas de desarrollo (F12) y revisa:
- **Console**: Logs detallados del proceso de autenticación
- **Network**: Solicitudes HTTP y respuestas del servidor

#### 2. Logs del Sistema
El sistema muestra logs detallados:
```
🔐 Intentando login JWT en: https://10.1.1.252:8971/api/login
📡 Respuesta login: 200 OK
📄 Datos de respuesta JWT: { hasToken: true, tokenType: "bearer", expiresIn: 86400 }
✅ Conexión exitosa, métricas obtenidas
```

#### 3. Test de Conectividad Manual

Puedes probar manualmente con curl:

```bash
# Test de login
curl -X POST 'https://tu-servidor:8971/api/login' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'username=admin&password=tu_contraseña' \
  -k

# Test con token obtenido
curl -X GET 'https://tu-servidor:8971/api/stats' \
  -H 'Authorization: Bearer tu_token_aqui' \
  -k
```

### Certificados SSL

#### Problema con Certificados Auto-firmados
Si tu Frigate usa certificados auto-firmados, el sistema automáticamente:
- Ignora errores de certificados SSL en el servidor
- Muestra advertencias pero continúa la conexión
- Utiliza la bandera `-k` equivalente en curl

#### Solución Recomendada
1. **Desarrollo**: Acepta el certificado en tu navegador visitando directamente la URL de Frigate
2. **Producción**: Usa certificados válidos (Let's Encrypt, etc.)

## Métricas del Sistema

Una vez configurado correctamente, el sistema muestra:

- **CPU**: Porcentaje de uso del procesador
- **RAM**: Porcentaje de uso de memoria
- **Disco**: Porcentaje de almacenamiento utilizado
- **GPU**: Porcentaje de uso de GPU (si disponible)
- **Estado**: Indicador visual en tiempo real

### Actualización de Métricas
- Las métricas se actualizan automáticamente cada 10 segundos
- Se obtienen desde el endpoint `/api/stats` de Frigate
- Se almacenan localmente para referencia histórica

## Configuración Avanzada

### Variables de Entorno Frigate

Para mayor seguridad, puedes usar variables de entorno en lugar de hardcodear credenciales:

```yaml
auth:
  enabled: true
  secret_key: ${FRIGATE_SECRET_KEY}
  users:
    - username: ${FRIGATE_ADMIN_USER}
      password: ${FRIGATE_ADMIN_PASS}
```

### Múltiples Usuarios
```yaml
auth:
  users:
    - username: "admin"
      password: "admin_password"
    - username: "viewer"
      password: "viewer_password"  
    - username: "operator"
      password: "operator_password"
```

### Tiempo de Expiración del Token
Por defecto, los tokens JWT expiran en 24 horas. Frigate maneja esto automáticamente, pero puedes verificar la expiración en la base de datos local.

## Soporte y Troubleshooting

Si continúas teniendo problemas:

1. **Verifica los logs de Frigate**: `docker logs frigate`
2. **Confirma la versión**: Debe ser 0.13.0 o superior
3. **Testa conectividad**: Ping y telnet al puerto
4. **Verifica firewall**: Puertos abiertos en ambos extremos
5. **Consulta documentación oficial**: https://docs.frigate.video

### Información de Contacto Técnico
- Logs del sistema disponibles en la consola del navegador
- Test automático disponible en la interfaz de configuración
- Métricas en tiempo real para verificar funcionamiento

---

*Esta guía está basada en la documentación oficial de Frigate v0.13+ y las mejores prácticas de seguridad para sistemas de videovigilancia.*