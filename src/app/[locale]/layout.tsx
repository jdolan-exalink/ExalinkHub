import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';

import { supported_locales } from '@/i18n';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import '../globals.css';

type LocaleLayoutProps = {
  children: ReactNode;
  params: { locale: string };
};

/**
 * Provee parametros estaticos para las rutas locales disponibles.
 */
export function generateStaticParams() {
  return supported_locales.map((locale) => ({ locale }));
}

/**
 * Envuelve la aplicacion con los providers de internacionalizacion y tema.
 */
export default async function locale_layout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
        <Toaster />
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}
