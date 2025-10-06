# Sistema de Autenticación - Guía de Inicio Rápido

## ✅ Implementación Completada

Se ha implementado un sistema completo de autenticación con las siguientes características:

### 🔐 Funcionalidades Implementadas

1. **Login con validación de credenciales**
   - Página de login moderna y responsive
   - Validación contra base de datos de usuarios
   - Mensajes de error claros

2. **Gestión de sesiones con JWT**
   - Tokens seguros con expiración de 24 horas
   - Almacenamiento en cookies httpOnly
   - Verificación automática de sesión

3. **Control de acceso basado en roles**
   - **Admin**: Acceso completo a todos los módulos
   - **Operator (Usuario)**: Acceso a live, events, recordings, statistics
   - **Viewer**: Solo acceso a live

4. **Protección de rutas**
   - Redirección automática a login si no está autenticado
   - Redirección a /live si intenta acceder a módulo sin permisos
   - Navegación filtrada según permisos del usuario

5. **UI actualizada**
   - Header con menú de usuario
   - Badge de rol con colores distintivos
   - Botón de logout
   - Navegación dinámica según permisos

## 🚀 Cómo Probar

### 1. Iniciar el servidor de desarrollo

```bash
npm run dev
```

### 2. Acceder a la aplicación

Abre tu navegador en: `http://localhost:3000`

### 3. Probar el login

La aplicación te redirigirá automáticamente a la página de login.

**Credenciales por defecto:**
- **Usuario:** `admin`
- **Contraseña:** `admin123`
- **Rol:** Admin (acceso completo)

### 4. Verificar funcionalidades

#### Como Admin:
1. Después de login, serás redirigido a `/live`
2. Verifica que puedes acceder a todos los módulos en el header:
   - Live (Vivo)
   - Recordings (Grabaciones)
   - Events (Eventos)
   - Plates LPR
   - Counting (Conteo)
   - Settings (Configuración)
3. En el header, verás tu nombre de usuario y un badge "Admin" en rojo
4. Haz clic en tu nombre de usuario para ver el menú desplegable
5. Prueba el botón "Cerrar Sesión"

#### Crear usuarios de prueba:
1. Ve a Settings → Users
2. Crea un usuario con rol "operator":
   - Usuario: `usuario1`
   - Contraseña: `password123`
   - Rol: Operator
3. Crea un usuario con rol "viewer":
   - Usuario: `viewer1`
   - Contraseña: `password123`
   - Rol: Viewer
4. Cierra sesión y prueba con estos usuarios

#### Como Operator:
- Verás solo: Live, Recordings, Events, Counting
- NO verás: Settings

#### Como Viewer:
- Verás solo: Live
- NO verás: Recordings, Events, Settings, etc.

## 📁 Archivos Creados/Modificados

### Nuevos Archivos

```
src/
├── app/
│   ├── api/auth/
│   │   ├── login/route.ts          # API de login
│   │   ├── logout/route.ts         # API de logout
│   │   └── session/route.ts        # API de verificación de sesión
│   └── [locale]/
│       └── login/page.tsx          # Página de login
├── components/
│   └── auth/
│       └── protected-route.tsx     # Componente de protección de rutas
└── contexts/
    └── auth-context.tsx            # Context de autenticación

context/
└── sistema-autenticacion.md        # Documentación completa
```

### Archivos Modificados

```
src/
├── app/
│   └── [locale]/
│       ├── layout.tsx              # Agregado AuthProvider
│       ├── page.tsx                # Redirige a /live en vez de /events
│       └── (app)/
│           └── layout.tsx          # Agregado ProtectedRoute
└── components/
    └── layout/
        └── header.tsx              # Agregado menú de usuario y filtrado de navegación
```

## 🔧 Configuración

### Variables de Entorno (Opcional)

Crea un archivo `.env.local` en la raíz del proyecto:

```env
JWT_SECRET=tu-secreto-super-seguro-cambiar-en-produccion
NODE_ENV=development
```

Si no se configura, se usará un secreto por defecto (solo para desarrollo).

## 🎯 Flujo de Usuario

### Primera Visita
```
1. Usuario accede a http://localhost:3000
2. No hay sesión → Redirige a /es/login
3. Usuario ingresa credenciales
4. Login exitoso → Redirige a /es/live
5. Usuario puede navegar por módulos permitidos
```

### Sesión Activa
```
1. Usuario accede a la app
2. Sesión válida → Carga directamente
3. Navegación libre por módulos permitidos
4. Intento de acceso no permitido → Redirige a /live
```

### Cierre de Sesión
```
1. Usuario hace clic en "Cerrar Sesión"
2. Cookie eliminada
3. Redirige a /login
```

## 🛡️ Seguridad

### Implementado
- ✅ JWT con expiración de 24 horas
- ✅ Cookies httpOnly (no accesibles desde JavaScript)
- ✅ Verificación de sesión en cada request
- ✅ Protección de rutas en el frontend
- ✅ Validación de permisos por rol

### Para Producción (Pendiente)
- ⚠️ Cambiar hash de contraseñas a bcrypt
- ⚠️ Configurar JWT_SECRET seguro
- ⚠️ Habilitar HTTPS
- ⚠️ Implementar rate limiting en login
- ⚠️ Agregar refresh tokens

## 📊 Permisos por Rol

| Módulo | Admin | Operator | Viewer |
|--------|-------|----------|--------|
| Live | ✅ | ✅ | ✅ |
| Events | ✅ | ✅ | ❌ |
| Recordings | ✅ | ✅ | ❌ |
| Statistics | ✅ | ✅ | ❌ |
| Settings | ✅ | ❌ | ❌ |
| Users | ✅ | ❌ | ❌ |
| Servers | ✅ | ❌ | ❌ |

## 🐛 Troubleshooting

### El login no funciona
1. Verifica que la base de datos `DB/config.db` exista
2. Verifica las credenciales: `admin` / `admin123`
3. Revisa la consola del navegador para errores
4. Revisa la consola del servidor para errores

### Redirección infinita
1. Verifica que `/login` no esté protegido
2. Limpia las cookies del navegador
3. Reinicia el servidor de desarrollo

### No se muestran algunos módulos
1. Verifica el rol del usuario en Settings → Users
2. Verifica que el usuario esté habilitado
3. Cierra sesión y vuelve a iniciar

### Error "Cannot find module 'jose'"
```bash
npm install jose
```

## 📚 Documentación Adicional

Ver documentación completa en:
- `context/sistema-autenticacion.md` - Documentación técnica completa
- `context/sistema-usuarios-grupos-api.md` - API de usuarios y grupos

## 🎉 Próximos Pasos

1. **Probar el sistema** con diferentes roles
2. **Crear usuarios adicionales** desde Settings
3. **Personalizar permisos** si es necesario
4. **Configurar JWT_SECRET** para producción
5. **Implementar bcrypt** para hash de contraseñas

## ✨ Características Destacadas

- 🔐 Autenticación segura con JWT
- 👥 Control de acceso basado en roles
- 🎨 UI moderna y responsive
- 🚀 Redirección inteligente
- 🛡️ Protección automática de rutas
- 📱 Compatible con internacionalización
- 🎯 Navegación dinámica según permisos
- 💾 Sesiones persistentes con cookies

---

**¡El sistema está listo para usar!** 🚀

Inicia sesión con `admin` / `admin123` y explora todas las funcionalidades.
