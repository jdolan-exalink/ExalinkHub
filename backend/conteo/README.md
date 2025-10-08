# Backend de Conteo

Este directorio contiene los assets mínimos para desplegar un backend de conteo (placeholder) que expone endpoints simples para métricas y prueba de integración con el panel de Servicios Backend.

## Endpoints
- `GET /health` -> chequeo de vida
- `GET /metrics` -> retorna uptime, processed, active_cameras, active_objects
- `POST /increment` -> incrementa contador simulado

## Construir e iniciar (ejemplo)

```bash
# Usando docker compose principal + override
docker compose -f docker-compose.yml -f backend/conteo/docker-compose.override.conteo.yml up -d --build conteo-backend
```

## Notas
- Este servicio es un stub. Sustituir lógica por integración real de conteo.
- El panel frontend leerá métricas desde SQLite (cuando se implemente) y estado docker.
