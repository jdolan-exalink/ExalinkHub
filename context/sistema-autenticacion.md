# Sistema de Autenticación - ExalinkHub

## Descripción General

Sistema de autenticación completo con login, gestión de sesiones y control de acceso basado en roles. Implementa JWT para sesiones seguras y protección de rutas según permisos de usuario.

## Arquitectura

### Componentes Principales

1. **APIs de Autenticación** (`/src/app/api/auth/`)
   - `login/route.ts`: Maneja inicio de sesión
   - `logout/route.ts`: Cierra sesión del usuario
   - `session/route.ts`: Verifica sesión activa

2. **Context de Autenticación** (`/src/contexts/auth-context.tsx`)
   - Maneja estado global del usuario
   - Provee funciones de login/logout
   - Verifica permisos y acceso a módulos

3. **Componentes de UI**
   - `/src/app/[locale]/login/page.tsx`: Página de login
   - `/src/components/auth/protected-route.tsx`: Wrapper para proteger rutas
   - Header actualizado con menú de usuario

## Flujo de Autenticación

### 1. Inicio de Sesión

```typescript
POST /api/auth/login
Body: {
  username: string,
  password: string
}

Response: {
  success: true,
  user: {
    id: number,
    username: string,
    role: 'admin' | 'operator' | 'viewer',
    accessible_modules: string[],
    permissions: Permission[]
  }
}
```

**Proceso:**
1. Valida credenciales contra la base de datos
2. Verifica que el usuario esté habilitado
3. Genera token JWT con información del usuario
4. Establece cookie httpOnly con el token
5. Retorna información del usuario y permisos

### 2. Verificación de Sesión

```typescript
GET /api/auth/session

Response: {
  authenticated: true,
  user: {
    id: number,
    username: string,
    role: string,
    accessible_modules: string[],
    permissions: Permission[]
  }
}
```

**Proceso:**
1. Lee token JWT de la cookie
2. Verifica validez del token
3. Obtiene usuario actualizado de la base de datos
4. Retorna información del usuario si está autenticado

### 3. Cierre de Sesión

```typescript
POST /api/auth/logout

Response: {
  success: true,
  message: 'Sesión cerrada correctamente'
}
```

**Proceso:**
1. Elimina cookie de autenticación
2. Retorna confirmación

## Sistema de Permisos

### Roles y Acceso a Módulos

#### 🔴 Admin
- **Módulos accesibles**: Todos
  - `live` - Vista en vivo
  - `events` - Eventos
  - `recordings` - Grabaciones
  - `settings` - Configuración
  - `users` - Gestión de usuarios
  - `servers` - Gestión de servidores
  - `statistics` - Estadísticas

#### 🔵 Operator (Usuario)
- **Módulos accesibles**:
  - `live` - Vista en vivo
  - `events` - Eventos
  - `recordings` - Grabaciones
  - `statistics` - Estadísticas
- **Módulos bloqueados**:
  - `settings` - Configuración
  - `users` - Gestión de usuarios
  - `servers` - Gestión de servidores

#### 🟡 Viewer (Visualizador)
- **Módulos accesibles**:
  - `live` - Vista en vivo únicamente
- **Módulos bloqueados**: Todos los demás

### Verificación de Permisos en el Frontend

```typescript
import { use_auth } from '@/contexts/auth-context';

function MyComponent() {
  const { user, check_permission, has_module_access } = use_auth();

  // Verificar acceso a módulo
  if (!has_module_access('settings')) {
    return <div>No tienes acceso a esta sección</div>;
  }

  // Verificar permiso específico
  const can_edit = check_permission('settings', 'edit');

  return (
    <div>
      {can_edit && <button>Editar</button>}
    </div>
  );
}
```

## Protección de Rutas

### Uso del Componente ProtectedRoute

```typescript
import { ProtectedRoute } from '@/components/auth/protected-route';

export default function SettingsPage() {
  return (
    <ProtectedRoute required_module="settings" required_action="view">
      <div>Contenido de configuración</div>
    </ProtectedRoute>
  );
}
```

**Comportamiento:**
- Si no hay sesión activa → Redirige a `/login`
- Si no tiene permisos → Redirige a `/live`
- Si tiene permisos → Muestra el contenido

### Protección Automática en Layout

El layout principal `(app)/layout.tsx` está envuelto en `ProtectedRoute`, lo que protege automáticamente todas las rutas de la aplicación.

## Seguridad

### JWT (JSON Web Tokens)

**Configuración:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'exalinkhub-secret-key-change-in-production';
```

**Contenido del Token:**
```json
{
  "user_id": 1,
  "username": "admin",
  "role": "admin",
  "accessible_modules": ["live", "events", "recordings", "settings", "users", "servers", "statistics"],
  "iat": 1234567890,
  "exp": 1234654290
}
```

**Características:**
- Expiración: 24 horas
- Almacenamiento: Cookie httpOnly
- Algoritmo: HS256

### Cookies

**Configuración de Cookie:**
```typescript
response.cookies.set('auth_token', token, {
  httpOnly: true,  // No accesible desde JavaScript
  secure: process.env.NODE_ENV === 'production',  // Solo HTTPS en producción
  sameSite: 'lax',  // Protección CSRF
  maxAge: 60 * 60 * 24  // 24 horas
});
```

### Hash de Contraseñas

**Actual (Desarrollo):**
```typescript
const password_hash = Buffer.from(password).toString('base64');
```

**Recomendado (Producción):**
```typescript
import bcrypt from 'bcrypt';

const password_hash = await bcrypt.hash(password, 10);
const is_valid = await bcrypt.compare(password, password_hash);
```

## Interfaz de Usuario

### Página de Login

**Ubicación:** `/src/app/[locale]/login/page.tsx`

**Características:**
- Diseño moderno con gradiente
- Validación de formulario
- Mensajes de error claros
- Redirección automática si ya está autenticado
- Muestra credenciales por defecto (desarrollo)

### Header con Menú de Usuario

**Características:**
- Muestra nombre de usuario
- Badge de rol con colores distintivos
- Dropdown menu con opción de logout
- Navegación filtrada según permisos
- Responsive design

**Badges de Rol:**
- Admin: Rojo
- Usuario: Azul
- Viewer: Verde

## Flujo de Usuario

### Primera Visita
1. Usuario accede a cualquier ruta de la app
2. `AuthProvider` verifica sesión
3. No hay sesión → Redirige a `/login`
4. Usuario ingresa credenciales
5. Login exitoso → Redirige a `/live`

### Sesión Activa
1. Usuario accede a la app
2. `AuthProvider` verifica sesión
3. Sesión válida → Carga información del usuario
4. Usuario navega libremente por módulos permitidos
5. Intento de acceso a módulo no permitido → Redirige a `/live`

### Cierre de Sesión
1. Usuario hace clic en "Cerrar Sesión"
2. Se llama a `/api/auth/logout`
3. Cookie de sesión se elimina
4. Usuario es redirigido a `/login`

## Configuración de Desarrollo

### Variables de Entorno

Crear archivo `.env.local`:
```env
JWT_SECRET=tu-secreto-super-seguro-aqui
NODE_ENV=development
```

### Usuario por Defecto

**Credenciales:**
- Usuario: `admin`
- Contraseña: `admin123`
- Rol: `admin`

## Integración con Módulos Existentes

### Mapeo de Rutas a Módulos

```typescript
const module_map: Record<string, string> = {
  'live': 'live',
  'recordings': 'recordings',
  'events': 'events',
  'plates-lpr': 'events',  // LPR requiere acceso a eventos
  'counting': 'statistics',
  'settings': 'settings'
};
```

### Navegación Dinámica

El Header filtra automáticamente las opciones de navegación según los permisos del usuario:

```typescript
const accessible_navigation = navigation_item_definitions.filter(({ slug }) => {
  const required_module = module_map[slug];
  return required_module ? has_module_access(required_module) : true;
});
```

## Mejoras Futuras

### Seguridad
1. Implementar bcrypt para hash de contraseñas
2. Agregar rate limiting en login
3. Implementar refresh tokens
4. Agregar 2FA (autenticación de dos factores)
5. Logging de intentos de acceso

### Funcionalidad
1. Recordar sesión ("Remember me")
2. Recuperación de contraseña
3. Cambio de contraseña desde el perfil
4. Historial de sesiones
5. Permisos granulares por usuario

### UX
1. Indicador de tiempo de sesión
2. Renovación automática de token
3. Notificación antes de expiración
4. Modo offline con caché

## Troubleshooting

### Error: "No hay sesión activa"
- Verificar que la cookie `auth_token` esté presente
- Verificar que el token no haya expirado
- Revisar configuración de `JWT_SECRET`

### Error: "Usuario no válido"
- Usuario fue deshabilitado en la base de datos
- Usuario fue eliminado
- Verificar estado del usuario en `/api/config/users`

### Redirección infinita
- Verificar que `/login` no esté protegido por `ProtectedRoute`
- Revisar lógica de redirección en `auth-context.tsx`
- Verificar que el pathname se esté leyendo correctamente

## Documentación de APIs

Ver también:
- [Sistema de Usuarios y Grupos](./sistema-usuarios-grupos-api.md)
- [Configuración JWT Frigate](./configuracion-jwt-frigate.md)

## Estructura de Archivos

```
src/
├── app/
│   ├── api/
│   │   └── auth/
│   │       ├── login/route.ts
│   │       ├── logout/route.ts
│   │       └── session/route.ts
│   └── [locale]/
│       ├── login/page.tsx
│       └── (app)/
│           └── layout.tsx (protegido)
├── components/
│   ├── auth/
│   │   └── protected-route.tsx
│   └── layout/
│       └── header.tsx (con menú de usuario)
└── contexts/
    └── auth-context.tsx
```

## Notas de Implementación

1. **snake_case**: Todas las variables y funciones usan snake_case según las reglas del proyecto
2. **JSDoc**: Todas las funciones incluyen documentación JSDoc
3. **TypeScript**: Tipado estricto en todos los componentes
4. **Responsive**: UI adaptable a diferentes tamaños de pantalla
5. **Internacionalización**: Compatible con sistema i18n existente
