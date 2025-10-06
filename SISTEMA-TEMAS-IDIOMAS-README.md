# 🎨 Sistema de Temas e Idiomas - Guía de Usuario

## 📋 Descripción

Sistema completo de personalización que permite a cada usuario:
- ✅ Cambiar entre tema **Claro**, **Oscuro** o **Sistema**
- ✅ Seleccionar idioma: **Español**, **English** o **Português**
- ✅ **Persistencia automática** de preferencias
- ✅ Cambios en **tiempo real** sin recargar la página

---

## 🚀 Cómo Usar

### 1️⃣ Acceder al Menú de Usuario

1. Inicia sesión en la aplicación
2. En la esquina superior derecha, haz clic en tu **nombre de usuario**
3. Se abrirá un menú desplegable con tus opciones

### 2️⃣ Cambiar el Tema

Dentro del menú de usuario:

1. Haz clic en **"Tema"** (o "Theme" / "Tema" según tu idioma)
2. Selecciona una opción:
   - **☀️ Claro**: Fondo blanco, ideal para ambientes iluminados
   - **🌙 Oscuro**: Fondo oscuro, reduce fatiga visual
   - **💻 Sistema**: Sigue la configuración de tu sistema operativo

**El cambio es instantáneo** y se guarda automáticamente.

### 3️⃣ Cambiar el Idioma

Dentro del menú de usuario:

1. Haz clic en **"Idioma"** (o "Language" / "Idioma")
2. Selecciona tu idioma preferido:
   - 🇪🇸 **Español**
   - 🇺🇸 **English**
   - 🇧🇷 **Português**

**La página se recargará** con el nuevo idioma y todas las traducciones se actualizarán.

---

## 🔧 Características Técnicas

### Persistencia de Preferencias

- **Tema**: Se guarda en `localStorage` con la clave `theme`
- **Idioma**: Se guarda en `localStorage` con la clave `preferred_locale`
- **Las preferencias se mantienen** incluso después de cerrar sesión o el navegador

### Modo Sistema

El modo **Sistema** detecta automáticamente:
- Si tu sistema operativo está en modo oscuro → Aplica tema oscuro
- Si tu sistema operativo está en modo claro → Aplica tema claro
- **Se actualiza automáticamente** si cambias la configuración del sistema

### Transiciones Suaves

- Cambios de tema con **animación de 0.3 segundos**
- Iconos animados (sol/luna) en el selector
- Sin parpadeos ni saltos visuales

---

## 📱 Compatibilidad

### Navegadores Soportados

- ✅ Chrome/Edge (v90+)
- ✅ Firefox (v88+)
- ✅ Safari (v14+)
- ✅ Opera (v76+)

### Dispositivos

- ✅ Desktop (Windows, macOS, Linux)
- ✅ Tablet (iPad, Android)
- ✅ Móvil (iOS, Android)

---

## 🎯 Casos de Uso

### Para Operadores de Seguridad

**Escenario**: Trabajo en sala de control con poca luz

1. Selecciona **Tema Oscuro** para reducir fatiga visual
2. Mantén el idioma en **Español** (o tu preferencia)
3. Las cámaras y eventos se verán con mejor contraste

### Para Administradores

**Escenario**: Configuración durante el día

1. Usa **Tema Claro** para mejor visibilidad con luz natural
2. Cambia a **English** si trabajas con equipo internacional
3. Todas las configuraciones se mantienen al volver

### Para Usuarios Móviles

**Escenario**: Revisión desde smartphone

1. Selecciona **Modo Sistema** para adaptarse automáticamente
2. El tema cambiará según la hora del día en tu dispositivo
3. Interfaz optimizada para pantallas pequeñas

---

## 🐛 Solución de Problemas

### El tema no cambia

**Problema**: Selecciono un tema pero no se aplica

**Solución**:
1. Refresca la página (F5)
2. Limpia la caché del navegador
3. Verifica que JavaScript esté habilitado
4. Prueba en modo incógnito

### El idioma no persiste

**Problema**: Al recargar vuelve al idioma anterior

**Solución**:
1. Verifica que las cookies estén habilitadas
2. Comprueba que localStorage funcione:
   - Abre DevTools (F12)
   - Ve a "Application" → "Local Storage"
   - Busca la clave `preferred_locale`
3. Si no existe, el navegador puede estar bloqueando localStorage

### Las traducciones no aparecen

**Problema**: Veo claves en lugar de texto traducido

**Solución**:
1. Refresca la página completamente (Ctrl+Shift+R)
2. Verifica tu conexión a internet
3. Reporta el problema al administrador

---

## 📊 Estadísticas de Uso

### Idiomas Disponibles

| Idioma | Código | Cobertura | Bandera |
|--------|--------|-----------|---------|
| Español | `es` | 100% | 🇪🇸 |
| English | `en` | 100% | 🇺🇸 |
| Português | `pt` | 100% | 🇧🇷 |

### Temas Disponibles

| Tema | Descripción | Uso Recomendado |
|------|-------------|-----------------|
| Claro | Fondo blanco | Ambientes iluminados |
| Oscuro | Fondo oscuro | Salas de control, noche |
| Sistema | Automático | Uso general, adaptativo |

---

## 🎨 Paleta de Colores

### Tema Claro

- **Fondo**: `#F5F5F5` (Gris muy claro)
- **Texto**: `#0A0A0A` (Negro casi puro)
- **Primario**: `#3B5998` (Azul corporativo)
- **Acento**: `#9333EA` (Púrpura)

### Tema Oscuro

- **Fondo**: `#0A0A0A` (Negro casi puro)
- **Texto**: `#FAFAFA` (Blanco casi puro)
- **Primario**: `#3B5998` (Azul corporativo)
- **Acento**: `#9333EA` (Púrpura)

---

## 📚 Recursos Adicionales

### Documentación Técnica

Para desarrolladores, consulta:
- `context/sistema-temas-idiomas.md` - Documentación técnica completa
- `src/components/theme-toggle.tsx` - Componente de selector de tema
- `src/components/language-switcher.tsx` - Componente de selector de idioma

### Archivos de Traducción

Las traducciones se encuentran en:
```
messages/
├── es.json  # Español
├── en.json  # English
└── pt.json  # Português
```

---

## 🔐 Privacidad

### Datos Almacenados Localmente

El sistema guarda en tu navegador:
- **Preferencia de tema**: `"light"`, `"dark"` o `"system"`
- **Preferencia de idioma**: `"es"`, `"en"` o `"pt"`

**Estos datos**:
- ✅ Solo se guardan en tu dispositivo
- ✅ No se envían a ningún servidor
- ✅ Puedes eliminarlos limpiando la caché del navegador
- ✅ No contienen información personal

---

## 💡 Tips y Trucos

### Atajos de Teclado (Futuros)

Próximamente podrás usar:
- `Ctrl + Shift + T` - Cambiar tema
- `Ctrl + Shift + L` - Cambiar idioma

### Sincronización entre Pestañas

- Los cambios de tema se sincronizan automáticamente entre pestañas abiertas
- Los cambios de idioma requieren refrescar otras pestañas

### Modo Presentación

Para presentaciones o demostraciones:
1. Usa **Tema Claro** para mejor visibilidad en proyectores
2. Aumenta el zoom del navegador (Ctrl + +)
3. Oculta la barra lateral si es necesario

---

## 📞 Soporte

### Reportar Problemas

Si encuentras algún problema:
1. Anota el navegador y versión que usas
2. Describe los pasos para reproducir el problema
3. Incluye capturas de pantalla si es posible
4. Contacta al administrador del sistema

### Solicitar Nuevos Idiomas

¿Necesitas otro idioma?
1. Contacta al equipo de desarrollo
2. Proporciona las traducciones necesarias
3. El nuevo idioma se agregará en la próxima actualización

---

## 🎉 ¡Disfruta de tu Experiencia Personalizada!

Ahora puedes usar ExalinkHub con el tema e idioma que prefieras. Las preferencias se guardarán automáticamente para tu próxima sesión.

**¿Preguntas?** Consulta la documentación técnica o contacta al administrador.

---

**Versión**: 0.0.15  
**Última actualización**: Octubre 2025  
**Desarrollado por**: Exalink Team
