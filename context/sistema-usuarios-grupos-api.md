# Sistema de Usuarios y Grupos - ExalinkHub

## Descripción General

El sistema de usuarios y grupos de ExalinkHub proporciona un control de acceso basado en roles para gestionar permisos de usuarios en diferentes módulos del sistema. Los datos se almacenan en una base de datos SQLite en la carpeta `DB/config.db`.

## Estructura de Base de Datos

### Tabla `users`
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'operator', 'viewer')),
  enabled BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Tabla `groups`
```sql
CREATE TABLE groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  saved_views TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Configuración por Defecto

Al inicializar el sistema se crean automáticamente:

### Usuario Administrador
- **Usuario**: `admin`
- **Contraseña**: `admin123`
- **Rol**: `admin`
- **Estado**: Activo

### Grupos por Defecto
1. **admins**: Administradores con acceso completo a todas las funciones del sistema
2. **usuarios**: Usuarios con acceso a todas las funciones excepto configuración
3. **viewers**: Visualizadores con acceso únicamente a las vistas en vivo

## Sistema de Permisos

### Roles y Permisos

#### 🔴 Admin
- **Acceso completo** a todos los módulos
- Puede gestionar usuarios y configuración
- Puede ver, crear, editar y eliminar en todos los módulos

#### 🔵 Operator (Usuario)
- Acceso a **eventos, grabaciones y estadísticas**
- **NO** tiene acceso a configuración ni gestión de usuarios
- Puede ver y gestionar contenido operativo

#### 🟡 Viewer (Visualizador)
- Acceso **únicamente a vistas en vivo**
- **NO** puede acceder a eventos, grabaciones o configuración
- Solo puede visualizar las cámaras en tiempo real

### Módulos del Sistema

1. **live**: Vista en vivo de cámaras
2. **events**: Gestión de eventos detectados
3. **recordings**: Gestión de grabaciones
4. **settings**: Configuración del sistema
5. **users**: Gestión de usuarios
6. **servers**: Gestión de servidores
7. **statistics**: Estadísticas del sistema

## API Reference

### Usuarios

#### GET /api/config/users
Obtiene todos los usuarios registrados (sin contraseñas).

**Respuesta:**
```json
{
  "users": [
    {
      "id": 1,
      "username": "admin",
      "role": "admin",
      "enabled": true,
      "created_at": "2025-01-06T12:00:00.000Z",
      "updated_at": "2025-01-06T12:00:00.000Z"
    }
  ]
}
```

#### POST /api/config/users
Crea un nuevo usuario.

**Parámetros:**
```json
{
  "username": "string",
  "password": "string",
  "role": "admin | operator | viewer",
  "enabled": true
}
```

#### PUT /api/config/users/[id]
Actualiza un usuario existente.

**Parámetros:** Mismos que POST, pero el password es opcional.

#### DELETE /api/config/users/[id]
Elimina un usuario. No permite eliminar el último administrador.

### Grupos

#### GET /api/config/groups
Obtiene todos los grupos registrados.

#### POST /api/config/groups
Crea un nuevo grupo.

**Parámetros:**
```json
{
  "name": "string",
  "description": "string",
  "saved_views": ["view_id1", "view_id2"]
}
```

#### PUT /api/config/groups/[id]
Actualiza un grupo existente.

#### DELETE /api/config/groups/[id]
Elimina un grupo.

### Permisos

#### GET /api/config/permissions
Obtiene permisos de un usuario o rol.

**Query Parameters:**
- `user_id`: ID del usuario
- `username`: Nombre de usuario
- `role`: Rol específico (admin, operator, viewer)

**Respuesta:**
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "enabled": true
  },
  "permissions": [
    {
      "module": "live",
      "action": "view",
      "allowed": true
    }
  ],
  "accessible_modules": ["live", "events", "recordings", "settings", "users", "servers", "statistics"]
}
```

#### POST /api/config/permissions/check
Verifica si un usuario tiene un permiso específico.

**Parámetros:**
```json
{
  "user_id": 1,
  "username": "admin",
  "module": "settings",
  "action": "view"
}
```

**Respuesta:**
```json
{
  "user_id": 1,
  "username": "admin",
  "module": "settings",
  "action": "view",
  "has_permission": true
}
```

## Métodos de Base de Datos

### Usuarios
```typescript
// Obtener todos los usuarios
getAllUsers(): User[]

// Obtener usuario por ID
getUserById(id: number): User | undefined

// Obtener usuario por nombre
getUserByUsername(username: string): User | undefined

// Crear usuario
createUser(data: Omit<User, 'id' | 'created_at' | 'updated_at'>): number

// Actualizar usuario
updateUser(id: number, data: Partial<User>): boolean

// Eliminar usuario
deleteUser(id: number): boolean
```

### Grupos
```typescript
// Obtener todos los grupos
getAllGroups(): Group[]

// Obtener grupo por ID
getGroupById(id: number): Group | undefined

// Crear grupo
createGroup(data: Omit<Group, 'id' | 'created_at' | 'updated_at'>): number

// Actualizar grupo
updateGroup(id: number, data: Partial<Group>): boolean

// Eliminar grupo
deleteGroup(id: number): boolean
```

### Permisos
```typescript
// Obtener permisos de un rol
get_role_permissions(role: 'admin' | 'operator' | 'viewer'): RolePermissions

// Verificar permiso de usuario por ID
check_user_permission(user_id: number, module: string, action: string): boolean

// Verificar permiso de usuario por nombre
check_user_permission_by_username(username: string, module: string, action: string): boolean

// Obtener módulos accesibles para un usuario
get_user_accessible_modules(user_id: number): string[]
```

## Seguridad

### Hash de Contraseñas
Actualmente se utiliza encoding Base64 para las contraseñas. **En producción se recomienda usar bcrypt**.

```typescript
// Ejemplo de mejora para producción
import bcrypt from 'bcrypt';

const hashPassword = (password: string): string => {
  return bcrypt.hashSync(password, 10);
};

const verifyPassword = (password: string, hash: string): boolean => {
  return bcrypt.compareSync(password, hash);
};
```

### Validación de Roles
Los roles están restringidos a: `admin`, `operator`, `viewer`.

### Protección del Usuario Admin
- No se puede eliminar el último usuario administrador
- El usuario `admin` por defecto no puede ser eliminado

## Interfaz de Usuario

El componente `UsersTab` en `/src/app/[locale]/(app)/settings/components/users-tab.tsx` proporciona:

- Lista de usuarios con roles y estados
- Formularios para crear/editar usuarios
- Gestión de grupos
- Validación de formularios
- Confirmaciones para eliminación

## Uso en el Frontend

```typescript
// Verificar permisos en componentes
const checkPermission = async (module: string, action: string) => {
  const response = await fetch('/api/config/permissions/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: currentUser.username,
      module,
      action
    })
  });
  
  const data = await response.json();
  return data.has_permission;
};

// Ejemplo de uso
const canAccessSettings = await checkPermission('settings', 'view');
if (!canAccessSettings) {
  // Redirigir o mostrar mensaje de error
}
```

## Migración y Actualización

Al actualizar el sistema:
1. La base de datos se actualiza automáticamente
2. Se preservan usuarios existentes
3. Se actualizan contraseñas si es necesario
4. Se crean grupos por defecto si no existen

## Consideraciones de Desarrollo

1. **Variables snake_case**: Todas las variables y funciones usan snake_case
2. **Comentarios JSDoc**: Todas las funciones incluyen documentación JSDoc
3. **Validación**: APIs incluyen validación de datos de entrada
4. **Manejo de errores**: Respuestas estructuradas con códigos HTTP apropiados
5. **Consistencia**: Estructura uniforme en todas las APIs