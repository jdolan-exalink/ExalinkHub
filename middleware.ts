import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  // Lista de todos los idiomas soportados
  locales: ['en', 'es', 'pt'],

  // Idioma por defecto si no se encuentra ninguno que coincida
  defaultLocale: 'es'
});

export const config = {
  // No ejecutar el middleware en rutas de API o assets estáticos
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']
};