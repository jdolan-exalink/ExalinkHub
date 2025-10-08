# Backend de Notificaciones - ExalinkHub

Sistema de notificaciones por email para el ecosistema ExalinkHub.

## Características

- Envío de notificaciones por email SMTP
- Configuración flexible de plantillas
- Historial de notificaciones enviadas
- Integración con sistemas LPR y conteo
- API REST completa

## Configuración

El sistema se configura a través de archivos JSON en el directorio `config/`:

- `notifications_config.json`: Configuración principal (SMTP, tipos de notificación)
- `notifications_preferences.json`: Preferencias de usuario

## Endpoints API

- `GET /health`: Verificación de estado
- `GET /config`: Obtener configuración actual
- `POST /config`: Actualizar configuración
- `POST /send-email`: Enviar email de notificación
- `GET /history`: Obtener historial de notificaciones
- `GET /status`: Estado completo del sistema

## Variables de Entorno

- Puerto: 8022 (configurable)
- Configuración SMTP requerida para funcionamiento

## Deployment

Se despliega automáticamente con Docker Compose como parte del stack completo de ExalinkHub.