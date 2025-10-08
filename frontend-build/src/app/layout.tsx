import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { getLocale } from 'next-intl/server';

import './globals.css';

export const metadata: Metadata = {
  title: 'Exalink Hub',
  description: 'Centralized NVR for Exalink servers',
};

/**
 * Layout raoz encargado de configurar las etiquetas HTML base.
 */
export default async function root_layout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased m-0 p-0 h-screen overflow-hidden">
        {children}
      </body>
    </html>
  );
}
