# 🔐 Configuración JWT en Frigate - Guía Completa

## ¿Qué es JWT y por qué usarlo?

JWT (JSON Web Token) es un estándar de autenticación más seguro que HTTP Basic Auth porque:
- **No envía credenciales** en cada solicitud
- **Tokens tienen expiración** automática  
- **Más seguro** para HTTPS y conexiones remotas
- **Estándar industrial** usado por APIs modernas

---

## 📋 Prerrequisitos

### 1. Frigate debe tener autenticación habilitada
En tu archivo `config.yaml` de Frigate:

```yaml
auth:
  enabled: true
  # Opcional: configurar usuarios específicos
  users:
    - username: admin
      password: tu_password_seguro
    - username: viewer  
      password: otro_password
      roles:
        - view
```

### 2. Acceso HTTPS (Recomendado)
Para máxima seguridad, configura Frigate con HTTPS:

```yaml
# En config.yaml
web_port: 8971
# Usar un proxy reverso como Nginx para HTTPS
```

---

## 🚀 Configuración Paso a Paso

### Paso 1: Verificar que Frigate tiene JWT habilitado

1. **Accede a tu Frigate** en el navegador: `https://10.1.1.252:8971`
2. **Verifica que pide login** - Si no pide credenciales, JWT no está habilitado
3. **Prueba login manual** con tu usuario/contraseña

### Paso 2: Configurar en Exalink Hub

1. **Abrir Configuración** → Pestaña "Servidores"
2. **Agregar Servidor** con estos datos:

```
Nombre del Servidor: Mi Frigate Principal
URL del Servidor: https://10.1.1.252:8971
Protocolo: HTTPS (Puerto 8971) [se detecta automáticamente]
Tipo de Autenticación: JWT Token (Recomendado)
Usuario: admin
Contraseña: tu_password_seguro
```

3. **Guardar Servidor** - El sistema obtendrá automáticamente el token JWT

---

## 🔧 URLs Soportadas

### Formato Completo (Recomendado)
```
https://10.1.1.252:8971
http://mi-servidor.local:5000  
https://frigate.mi-dominio.com:443
```

### Formato Simplificado
```
10.1.1.252          (usa puerto por defecto)
mi-servidor.local   (usa puerto por defecto)
```

---

## ⚙️ Configuraciones Especiales

### Para Certificados Autofirmados
Si tu Frigate usa certificados SSL autofirmados:

1. **El sistema ignora automáticamente** errores SSL en el servidor
2. **En el navegador**: Accede una vez a `https://10.1.1.252:8971` y acepta el certificado
3. **Después configura** normalmente en Exalink Hub

### Para Frigate en Docker
```yaml
# docker-compose.yml
services:
  frigate:
    ports:
      - "8971:8971"  # Puerto personalizado
    environment:
      - AUTH_ENABLED=true
```

### Para Frigate con Nginx
```nginx
server {
    listen 443 ssl;
    server_name frigate.mi-dominio.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🧪 Proceso de Test Automático

Cuando configuras un servidor JWT, el sistema ejecuta:

1. **✅ Validación de URL** (inmediato)  
2. ⏱️ *Pausa 1 segundo*
3. **✅ Conectividad de Red** (timeout 5s)
4. ⏱️ *Pausa 1 segundo*  
5. **✅ Login JWT** (`POST /api/login` → obtiene token)
6. ⏱️ *Pausa 1 segundo*
7. **✅ Test API** (endpoints `/config`, `/stats` con Bearer token)
8. ⏱️ *Pausa 1 segundo*
9. **✅ Métricas del Sistema** (CPU, RAM, Disco, GPU)

---

## 📊 Métricas Automáticas

Una vez configurado, el sistema muestra:

- **🔵 CPU**: Uso del procesador en tiempo real
- **🟢 RAM**: Memoria utilizada vs disponible  
- **🟡 Disco**: Espacio usado en grabaciones
- **🟣 GPU**: Uso de aceleración por hardware
- **⚡ Estado**: Última verificación y conectividad

**Actualización**: Cada 10 segundos automáticamente

---

## 🔍 Solución de Problemas

### Error: "Failed to fetch"
**Causa**: Certificado SSL inválido o puerto incorrecto
**Solución**: 
1. Verifica que puedas acceder a `https://10.1.1.252:8971` en el navegador
2. Acepta el certificado SSL si es autofirmado
3. Verifica que el puerto 8971 esté abierto

### Error: "Credenciales inválidas"  
**Causa**: Usuario/contraseña incorrectos
**Solución**:
1. Verifica credenciales en el login web de Frigate
2. Revisa config.yaml de Frigate para usuarios configurados

### Error: "Token no recibido"
**Causa**: Frigate no tiene JWT habilitado o configurado mal
**Solución**:
1. Habilita `auth: enabled: true` en config.yaml
2. Reinicia Frigate
3. Verifica que `/api/login` existe accediendo a `/api/docs`

### Métricas en 0%
**Causa**: Token expirado o permisos insuficientes  
**Solución**:
1. **Test Servidor** para renovar token automáticamente
2. Verifica permisos del usuario en Frigate

---

## 🛡️ Mejores Prácticas de Seguridad

### 1. Usuarios Dedicados
```yaml
# config.yaml - Crea usuario específico para API
auth:
  users:
    - username: api_user
      password: password_super_seguro_para_api
      roles:
        - view
        - stats
```

### 2. Renovación Automática
- Los tokens se **renuevan automáticamente** cada 24 horas
- **No necesitas intervención manual** para mantener la conexión

### 3. Múltiples Servidores
- Puedes configurar **varios servidores Frigate** con diferentes tipos de auth
- Cada uno mantiene **su propio token JWT** independiente

---

## 📝 Ejemplo de Configuración Completa

```yaml
# config.yaml de Frigate
auth:
  enabled: true
  users:
    - username: admin
      password: Admin123!
    - username: exalink_api  
      password: ExalinkSecure2024!
      roles:
        - view
        - stats

web_port: 8971

# ... resto de configuración de cámaras
```

**En Exalink Hub**:
- URL: `https://10.1.1.252:8971`
- Auth: JWT Token  
- Usuario: `exalink_api`
- Contraseña: `ExalinkSecure2024!`

---

## ✅ Verificación Final

Una configuración correcta muestra:

- **🟢 En línea** junto al nombre del servidor
- **Métricas en tiempo real** (CPU, RAM, Disco, GPU > 0%)
- **Test exitoso** en todos los pasos
- **Actualización automática** cada 10 segundos

¡Con esto tienes un sistema de monitoreo profesional y seguro para tus servidores Frigate! 🎉