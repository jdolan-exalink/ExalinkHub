# Configuración de idioma y tema

Esta implementación expone el endpoint `GET/POST /api/config/settings` para consultar y actualizar las preferencias globales de la aplicación (idioma y tema por defecto).

## Lectura de preferencias

- **Método**: `GET /api/config/settings`
- **Respuesta 200**:

```json
{
  "language": "es",
  "theme": "system"
}
```

No requiere parámetros. Se utiliza para precargar la UI de configuración o aplicar el tema al iniciar la sesión.

## Actualización de preferencias

- **Método**: `POST /api/config/settings`
- **Body (JSON)**:

```json
{
  "language": "en",
  "theme": "dark"
}
```

- **Validaciones**:
  - `language` debe pertenecer a `['es', 'en', 'pt']`
  - `theme` debe pertenecer a `['light', 'dark', 'system']`

- **Respuesta 200**:

```json
{
  "message": "Settings updated successfully"
}
```

- **Errores 400**:
  - Se devuelve `{ "error": "Invalid theme value" }` o `{ "error": "Invalid language value" }` cuando el valor enviado no pertenece a los catálogos admitidos.

La persistencia se realiza en la tabla `app_settings` de `config.db` utilizando `set_application_setting`. La UI de `Settings > Preferencias Generales` usa este endpoint para sincronizar la selección de idioma/tema y aplicar los cambios de forma inmediata con `next-themes` y `next-intl`.
