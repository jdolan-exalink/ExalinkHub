# Sistema de Temas e Idiomas - ExalinkHub

## Descripción General

Sistema completo de personalización de interfaz que permite a cada usuario cambiar entre temas (claro/oscuro/sistema) y seleccionar su idioma preferido (español/inglés/portugués). Las preferencias son persistentes y se guardan en localStorage.

## Componentes Principales

### 1. ThemeToggle (`src/components/theme-toggle.tsx`)

Componente que permite cambiar entre tres modos de tema:
- **Claro**: Interfaz con fondo blanco y texto oscuro
- **Oscuro**: Interfaz con fondo oscuro y texto claro
- **Sistema**: Sigue la preferencia del sistema operativo

**Características:**
- Usa `next-themes` para gestión de temas
- Persistencia automática en localStorage
- Transiciones suaves entre temas
- Iconos animados (sol/luna)

**Uso:**
```tsx
import { ThemeToggle } from '@/components/theme-toggle';

<ThemeToggle />
```

### 2. LanguageSwitcher (`src/components/language-switcher.tsx`)

Componente para cambiar el idioma de la aplicación entre:
- **Español** (es) 🇪🇸
- **English** (en) 🇺🇸
- **Português** (pt) 🇧🇷

**Características:**
- Guarda preferencia en localStorage con clave `preferred_locale`
- Actualiza la URL con el nuevo idioma
- Recarga las traducciones automáticamente
- Muestra bandera del idioma actual

**Uso:**
```tsx
import { LanguageSwitcher } from '@/components/language-switcher';

<LanguageSwitcher />
```

### 3. ThemeProvider (`src/components/theme-provider.tsx`)

Wrapper de `next-themes` que provee el contexto de tema a toda la aplicación.

**Configuración en layout:**
```tsx
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  {children}
</ThemeProvider>
```

## Integración en el Header

Los selectores están integrados en el menú de usuario del Header:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger>
    <User /> {username}
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    {/* Información del usuario */}
    
    {/* Selector de tema */}
    <ThemeToggle />
    
    {/* Selector de idioma */}
    <LanguageSwitcher />
    
    {/* Cerrar sesión */}
    <DropdownMenuItem onClick={logout}>
      Cerrar Sesión
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

## Sistema de Traducciones

### Estructura de Archivos

```
messages/
├── es.json  # Español
├── en.json  # English
└── pt.json  # Português
```

### Traducciones del Menú de Usuario

Cada archivo de idioma incluye las siguientes claves en `user_menu`:

```json
{
  "user_menu": {
    "theme": "Tema",
    "theme_light": "Claro",
    "theme_dark": "Oscuro",
    "theme_system": "Sistema",
    "language": "Idioma",
    "language_es": "Español",
    "language_en": "English",
    "language_pt": "Português",
    "logout": "Cerrar sesión",
    "profile": "Perfil"
  }
}
```

### Uso de Traducciones

```tsx
import { useTranslations } from 'next-intl';

const translate = useTranslations('user_menu');

<span>{translate('theme')}</span>
<span>{translate('logout')}</span>
```

## Variables CSS de Tema

### Tema Claro (`:root`)

```css
:root {
  --background: 0 0% 96.1%;
  --foreground: 240 10% 3.9%;
  --card: 0 0% 100%;
  --primary: 231 48% 48%;
  /* ... más variables */
}
```

### Tema Oscuro (`.dark`)

```css
.dark {
  --background: 240 10% 3.9%;
  --foreground: 0 0% 98%;
  --card: 240 10% 3.9%;
  --primary: 231 48% 48%;
  /* ... más variables */
}
```

### Transiciones Suaves

```css
body {
  transition: background-color 0.3s ease, color 0.3s ease;
}
```

## Persistencia de Preferencias

### Tema
- **Método**: Automático por `next-themes`
- **Storage**: `localStorage` con clave `theme`
- **Valores**: `"light"`, `"dark"`, `"system"`

### Idioma
- **Método**: Manual con `localStorage.setItem()`
- **Storage**: `localStorage` con clave `preferred_locale`
- **Valores**: `"es"`, `"en"`, `"pt"`

### Código de Persistencia

```typescript
// Guardar idioma
const change_language = (new_locale: string) => {
  localStorage.setItem('preferred_locale', new_locale);
  router.push(`/${new_locale}${pathname}`);
};

// Leer idioma guardado (en layout o middleware)
const saved_locale = localStorage.getItem('preferred_locale');
```

## Flujo de Funcionamiento

### Cambio de Tema

1. Usuario hace clic en el selector de tema
2. `next-themes` actualiza el tema en localStorage
3. Se aplica/remueve la clase `.dark` en el `<html>`
4. CSS variables cambian automáticamente
5. Transición suave de 0.3s

### Cambio de Idioma

1. Usuario selecciona un idioma
2. Se guarda en `localStorage` con clave `preferred_locale`
3. Se construye nueva URL con el idioma seleccionado
4. `router.push()` navega a la nueva URL
5. Next.js recarga las traducciones del nuevo idioma
6. `router.refresh()` actualiza el contenido

## Mejores Prácticas

### Para Desarrolladores

1. **Siempre usar variables CSS de tema**
   ```css
   /* ✅ Correcto */
   background-color: hsl(var(--background));
   
   /* ❌ Incorrecto */
   background-color: #ffffff;
   ```

2. **Usar traducciones para todo texto visible**
   ```tsx
   /* ✅ Correcto */
   <span>{translate('logout')}</span>
   
   /* ❌ Incorrecto */
   <span>Cerrar Sesión</span>
   ```

3. **Agregar nuevas traducciones en los 3 idiomas**
   - Siempre actualizar `es.json`, `en.json` y `pt.json`
   - Mantener la misma estructura de claves

4. **Probar en ambos temas**
   - Verificar contraste en modo oscuro
   - Asegurar legibilidad en ambos modos

### Para Usuarios

1. **Cambiar tema**: Menú de usuario → Tema → Seleccionar
2. **Cambiar idioma**: Menú de usuario → Idioma → Seleccionar
3. **Las preferencias se guardan automáticamente**
4. **Modo Sistema**: Sigue la configuración del SO

## Agregar Nuevos Idiomas

### Paso 1: Crear archivo de traducciones

```bash
# Crear nuevo archivo
messages/fr.json  # Para francés
```

### Paso 2: Copiar estructura de es.json

```json
{
  "navigation": { ... },
  "user_menu": { ... },
  "SettingsPage": { ... }
}
```

### Paso 3: Actualizar configuración i18n

```typescript
// src/i18n.ts
export const supported_locales = ['es', 'en', 'pt', 'fr'];
```

### Paso 4: Agregar al LanguageSwitcher

```typescript
const languages = [
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];
```

## Solución de Problemas

### El tema no cambia

1. Verificar que `ThemeProvider` esté en el layout raíz
2. Comprobar que el atributo `class` esté en `<html>`
3. Limpiar localStorage: `localStorage.removeItem('theme')`

### Las traducciones no aparecen

1. Verificar que el archivo JSON existe en `messages/`
2. Comprobar que la clave existe en el archivo
3. Verificar que `NextIntlClientProvider` esté configurado
4. Revisar la consola por errores de sintaxis JSON

### El idioma no persiste

1. Verificar que localStorage esté habilitado
2. Comprobar que se guarda: `localStorage.getItem('preferred_locale')`
3. Verificar que la URL incluye el locale correcto

## Ejemplo Completo de Uso

```tsx
'use client';

import { useTheme } from 'next-themes';
import { useTranslations } from 'next-intl';
import { ThemeToggle } from '@/components/theme-toggle';
import { LanguageSwitcher } from '@/components/language-switcher';

export function UserPreferences() {
  const { theme } = useTheme();
  const translate = useTranslations('user_menu');

  return (
    <div className="space-y-4">
      <h2>{translate('profile')}</h2>
      
      {/* Selector de tema */}
      <div>
        <label>{translate('theme')}</label>
        <ThemeToggle />
        <p className="text-sm text-muted-foreground">
          Tema actual: {theme}
        </p>
      </div>
      
      {/* Selector de idioma */}
      <div>
        <label>{translate('language')}</label>
        <LanguageSwitcher />
      </div>
    </div>
  );
}
```

## Referencias

- **next-themes**: https://github.com/pacocoursey/next-themes
- **next-intl**: https://next-intl-docs.vercel.app/
- **Tailwind CSS Dark Mode**: https://tailwindcss.com/docs/dark-mode
- **shadcn/ui Theming**: https://ui.shadcn.com/docs/theming
