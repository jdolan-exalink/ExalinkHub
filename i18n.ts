import { getRequestConfig } from 'next-intl/server';

export const supported_locales = ['en', 'es', 'pt'] as const;
export const default_locale = 'es';

type SupportedLocale = (typeof supported_locales)[number];

type RequestLocale = {
  locale: SupportedLocale;
  messages: Record<string, unknown>;
};

/**
 * Configura Next-Intl devolviendo siempre un locale v0lido y sus mensajes.
 */
export default getRequestConfig(async ({ locale }): Promise<RequestLocale> => {
  const normalized_locale = (supported_locales.includes(locale as SupportedLocale)
    ? (locale as SupportedLocale)
    : default_locale);

  try {
    const messages = (await import(`./messages/${normalized_locale}.json`)).default;
    return { locale: normalized_locale, messages };
  } catch (error) {
    const fallback_messages = (await import(`./messages/${default_locale}.json`)).default;
    return { locale: default_locale, messages: fallback_messages };
  }
});
