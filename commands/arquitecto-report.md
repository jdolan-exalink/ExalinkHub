# Informe Arquitectonico del proyecto

## Alcance del analisis
- No se encontro la carpeta `task-manager` en el repositorio; se reviso la estructura real disponible en `src`, `scripts`, `DB`, `data` y `context`.
- La aplicacion es una plataforma Next.js enfocada en integraciones con Frigate, manejo de vistas de camaras y herramientas de IA con Genkit.

## Tecnologias clave
- Next.js 15.3.3 (React 18.3.1) con App Router y componentes de servidor/cliente.
- TypeScript 5 y configuracion estricta con `tsconfig.json` y `next.config.ts`.
- Tailwind CSS + utilidades (`tailwind-merge`, `tailwindcss-animate`) y componentes Radix UI (`@radix-ui/*`).
- Librerias de UI adicionales: `lucide-react`, `@tabler/icons-react`, `embla-carousel-react`, `@dnd-kit/*`.
- Gestion de formularios y validacion: `react-hook-form`, `@hookform/resolvers`, `zod`.
- Integracion multimedia: `hls.js`, `mse-player`, `recharts`, utilidades de grabaciones.
- Backend local con SQLite (`better-sqlite3`) para persistir configuraciones y vistas; scripts (`scripts/create-predefined-views.js`) para sembrado.
- Integracion con Frigate mediante cliente dedicado (`src/lib/frigate-api.ts`, `frigate-data.ts`) y APIs Next.
- Flujo de IA con Genkit (`src/ai/*`) y soporte para Google GenAI.

## Estructura principal
- `src/app`
  - `layout.tsx`, `globals.css`, `not-found.tsx`: layout y estilos globales.
  - `page.tsx`: pagina raiz.
  - `(app)/`: area autenticada con vistas funcionales (`counting`, `events`, `live`, `plates`, `plates-lpr`, `recordings`, `settings`).
    - Cada subcarpeta define paginas y componentes especificos (`components/event-dashboard.tsx`, `components/camera-feed.tsx`, etc.).
  - `api/`: rutas serverless que exponen servicios REST para configuracion, servidores, Frigate, LPR, conteo, vistas, etc.
    - `config/`: alta de servidores, servicios y grupos.
    - `frigate/`: proxy para camaras, eventos, recordings, stats, debug.
    - `lpr/`: acceso a archivos, lecturas y estadisticas de reconocimiento de placas.
    - `views/`: CRUD de vistas guardadas respaldadas en SQLite.
- `src/components`
  - `layout/`: encabezado, barra lateral y gestion de layout.
  - `ui/`: biblioteca reutilizable (inputs, tablas, modales, reproductores, controles de eventos, etc.).
- `src/lib`
  - Acceso a datos (`database.ts`, `config-database.ts`, `lpr-database.ts`, `data.ts`).
  - Clientes y helpers para Frigate (`frigate-api.ts`, `frigate-auth.ts`, `frigate-servers.ts`).
  - Utilidades (`secure-fetch.ts`, `types.ts`, `utils.ts`, `mjpeg-pool.ts`, `placeholder-images.*`).
- `src/hooks`: hooks personalizados (`use-toast.ts`, `use-mobile.tsx`).
- `src/ai`: flows de Genkit (`flows/*.ts`), configuracion de entorno (`dev.ts`, `genkit.ts`).
- `scripts/create-predefined-views.js`: script Node para generar vistas base en la DB SQLite.
- `DB/`: bases de datos `config.db` y `views.db` usadas por las rutas API.
- `data/`: base de datos `lpr-readings.db` y archivos WAL/SHM para lectura de LPR.
- `context/`: documentacion y ejemplos para integraciones (incluye guias de API Frigate).

## Flujo general de la arquitectura
1. Capas de UI en `src/app/(app)` renderizan vistas modulares apoyadas en `src/components/ui` para controles y visualizaciones.
2. Las interacciones cliente-servidor se canalizan via rutas Next API (`src/app/api/**`) que encapsulan logica de negocio y accesos externos.
3. Las rutas API reutilizan servicios de `src/lib` para conversar con Frigate, gestionar bases SQLite locales y abstraer integraciones.
4. Persistencia local: `better-sqlite3` opera sobre `DB/*` y `data/*`; los servicios `config-database.ts`, `database.ts`, `lpr-database.ts` proveen capas DAO.
5. Integracion externa: `FrigateAPI` maneja autenticacion, streaming, eventos y exportaciones; hooks UI y componentes (p.ej. `frigate-debug-panel.tsx`) consumen estos endpoints.
6. IA asistida: Flujos Genkit procesan eventos (resumen, categorizacion) y pueden exponerse via endpoints o scripts dev (`genkit:dev`).

## Diagrama Mermaid
```mermaid
graph TD
    ui[Next.js UI pages (src/app/(app))] --> components[Componentes reutilizables (src/components)]
    components -->|invoca servicios| api[Next.js API routes (src/app/api)]
    api -->|opera sobre| libs[Servicios y utilidades (src/lib)]
    libs --> db[SQLite local (DB/, data/)]
    libs --> frigate[Frigate Server API]
    libs --> ai[Genkit flows (src/ai)]
    scripts[Scripts utilitarios (scripts/)] --> db
    context_docs[Documentacion (context/)] -.-> ui
```

## Observaciones adicionales
- El repositorio aun no contiene una carpeta `task-manager`; si se agrega en el futuro conviene extender este informe con su estructura.
- Las rutas API tienen abundante logica de integracion con Frigate; cualquier nueva implementacion deberia documentarse en `context/` siguiendo las guias existentes.
