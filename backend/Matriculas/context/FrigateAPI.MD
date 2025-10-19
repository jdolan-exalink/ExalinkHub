text
# Guía de Integración Frigate HTTP API

Este documento resume los endpoints clave para integrar aplicaciones con Frigate mediante su API HTTP, con ejemplos prácticos en Python usando `requests`, troubleshooting, autenticación avanzada y manejo de errores.

---

## Índice

- [1. Autenticación](#1-autenticación)
- [2. Usuarios](#2-usuarios)
- [3. Rostros, Eventos y Revisión](#3-rostros-eventos-y-revisión)
- [4. Estado y Estadísticas](#4-estado-y-estadísticas)
- [5. Logs](#5-logs)
- [6. Streams y Previsualizaciones](#6-streams-y-previsualizaciones)
- [7. Notificaciones](#7-notificaciones)
- [8. Exportación](#8-exportación)
- [9. Medios](#9-medios)
- [10. Configuración y Schemas](#10-configuración-y-schemas)
- [11. Troubleshooting](#11-troubleshooting)
- [12. Autenticación Avanzada](#12-autenticación-avanzada)
- [13. Códigos de Error y Respuestas](#13-códigos-de-error-y-respuestas)
- [14. Referencias](#14-referencias)

---

## 1. Autenticación

Verifica autenticación del API:

import requests

url = "https://tu_frigate/api/auth"
headers = {'Accept': 'application/json'}
response = requests.get(url, headers=headers)
print(response.status_code, response.text)

text

---

## 2. Usuarios

### Crear usuario

import requests

url = "https://tu_frigate/api/users"
payload = {
"username": "usuario",
"password": "contraseña",
"role": "viewer"
}
headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
response = requests.post(url, json=payload, headers=headers)
print(response.status_code, response.text)

text

### Eliminar usuario

import requests

url = "https://tu_frigate/api/users/nombre_usuario"
headers = {'Accept': 'application/json'}
response = requests.delete(url, headers=headers)
print(response.status_code, response.text)

text

### Actualizar contraseña

import requests

url = "https://tu_frigate/api/users/nombre_usuario/password"
payload = {"password": "nueva_contraseña"}
headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
response = requests.put(url, json=payload, headers=headers)
print(response.status_code, response.text)

text

---

## 3. Rostros, Eventos y Revisión

### Obtener rostros detectados

import requests

url = "https://tu_frigate/api/faces"
headers = {'Accept': 'application/json'}
response = requests.get(url, headers=headers)
print(response.status_code, response.text)

text

### Reprocesar rostro detectado

import requests

url = "https://tu_frigate/api/faces/reprocess"
payload = {} # Completar según datos
headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
response = requests.post(url, json=payload, headers=headers)
print(response.status_code, response.text)

text

---

## 4. Estado y Estadísticas

### Chequear estado del sistema

import requests

url = "https://tu_frigate/api/"
headers = {'Accept': 'text/plain'}
response = requests.get(url, headers=headers)
print(response.status_code, response.text)

text

### Obtener estadísticas

import requests

url = "https://tu_frigate/api/stats"
headers = {'Accept': 'application/json'}
response = requests.get(url, headers=headers)
print(response.status_code, response.text)

text

---

## 5. Logs

Obtener logs de servicio (frigate, nginx, go2rtc):

import requests

url = "https://tu_frigate/api/logs/frigate"
headers = {'Accept': 'application/json'}
response = requests.get(url, headers=headers)
print(response.status_code, response.text)

text

---

## 6. Streams y Previsualizaciones

Preview TS stream de cámara:

import requests

url = "https://tu_frigate/api/preview/ts/camara/start/fecha_inicio/end/fecha_fin"
headers = {'Accept': 'application/json'}
response = requests.get(url, headers=headers)
print(response.status_code, response.text)

text

---

## 7. Notificaciones

Obtener clave pública VAPID para webpush:

import requests

url = "https://tu_frigate/api/notifications/pubkey"
headers = {'Accept': 'application/json'}
response = requests.get(url, headers=headers)
print(response.status_code, response.text)

text

Registrar notificación:

import requests

url = "https://tu_frigate/api/notifications/register"
payload = {} # Completar según datos de registro
headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
response = requests.post(url, json=payload, headers=headers)
print(response.status_code, response.text)

text

---

## 8. Exportación

Listar exportaciones:

import requests

url = "https://tu_frigate/api/exports"
headers = {'Accept': 'application/json'}
response = requests.get(url, headers=headers)
print(response.status_code, response.text)

text

Exportar grabación específica:

import requests

url = "https://tu_frigate/api/export/camara/start/fecha_inicio/end/fecha_fin"
payload = {
"playback": "realtime",
"source": "recordings",
"name": "Fragmento",
"image_path": "/path/to/image"
}
headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
response = requests.post(url, json=payload, headers=headers)
print(response.status_code, response.text)

text

---

## 9. Medios

Obtener MJPEG feed de una cámara:

import requests

url = "https://tu_frigate/api/camara"
headers = {'Accept': 'application/json'}
response = requests.get(url, headers=headers)
print(response.status_code, response.text)

text

### Descargar clip por rango start/end

Frigate permite descargar directamente un segmento de grabación sin pasar por el sistema de exports usando la ruta:

```
/api/<CAMARA>/start/<TIMESTAMP_INICIO>/end/<TIMESTAMP_FIN>/clip.mp4
```

Ejemplo con `curl` (descarga 60 segundos de la cámara Portones):

```bash
curl -o portones-00AM.mp4 "http://10.1.1.252:5000/api/Portones/start/1760324400/end/1760324460/clip.mp4"
```

Notas importantes:
- Los timestamps deben expresarse en segundos (no milisegundos) y en la zona horaria local configurada en Frigate.
- La duración recomendada es ≤ 60 s. Para rangos más largos se debe fragmentar en varias descargas.
- El endpoint respeta los mecanismos de autenticación configurados (Basic, Bearer, API Key). Incluye las cabeceras necesarias en la petición.

Desde el backend (TypeScript) ahora se utiliza este flujo directo:

```ts
const url = `${base_url}/api/${encodeURIComponent(camera)}/start/${start_seconds}/end/${end_seconds}/clip.mp4`;
const response = await fetch(url, { headers: auth_headers });
if (!response.ok) throw new Error(`Frigate devolvió ${response.status}`);
const blob = await response.blob();
```

--- 

## 10. Configuración y Schemas

Obtener esquema de configuración:

import requests

url = "https://tu_frigate/api/config/schema.json"
headers = {'Accept': 'application/json'}
response = requests.get(url, headers=headers)
print(response.status_code, response.text)

text

---

## 11. Troubleshooting

### Problemas frecuentes:
- **401/403 Unauthorized:** Verifica la autenticación, token o usuario/contraseña.
- **404 Not Found:** Revisa endpoint, nombres de usuario/cámara o parámetros.
- **422 Unprocessable Entity:** Revisa formato de JSON, campos requeridos y datos enviados.
- **Conexión rechazada:** El contenedor Frigate no está corriendo, la IP/DNS no resuelve, o el puerto no es correcto.
- **CORS:** Si llamas desde navegador y no backend, habilita CORS (Front y API).

### Diagnóstico
- Usar `response.status_code` y `response.text` en los ejemplos para obtener detalles de error.
- Habilitar logs detallados en Frigate para debugging de backend.
- Validar schemas con `/api/config/schema.json`.

---

## 12. Autenticación Avanzada

Algunas implementaciones requieren **token JWT** u otro tipo de sesión. Ejemplo con tokens (adaptar según endpoint y tus necesidades):

import requests

url = "https://tu_frigate/api/algun_endpoint"
token = "jwt_abcdef12345"
headers = {
'Authorization': f'Bearer {token}',
'Accept': 'application/json'
}
response = requests.get(url, headers=headers)
print(response.status_code, response.text)

text

- **Obtención de token:** Puede requerir login (`/api/login`) y almacenar el token retornado.
- **Persistencia:** Guarda los tokens en variables de sesión y refresca si vencen.

---

## 13. Códigos de Error y Respuestas

- **200 OK:** Éxito
- **201 Created:** Recurso creado/registrado correctamente
- **204 No Content:** Operación exitosa sin datos en respuesta
- **400 Bad Request:** Error en datos/parámetros enviados
- **401 Unauthorized:** Falta autenticación válida
- **403 Forbidden:** No tienes permisos suficientes
- **404 Not Found:** Recurso/endpoint no encontrado
- **422 Unprocessable Entity:** JSON inválido/formato incorrecto/campo faltante
- **500 Internal Server Error:** Fallo en el backend

En todos los casos, verifica `response.text` para el detalle específico del error retornado por Frigate API.

---

## 14. Referencias

- Documentación oficial actualizada: https://docs.frigate.video/integrations/api/frigate-http-api

**Reemplaza las URLs base por la IP, dominio o localhost según tu entorno. Actualiza variables y tokens según tu flujo de autenticación.**

---
