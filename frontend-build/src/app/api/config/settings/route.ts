import { NextResponse } from 'next/server';

import { getConfigDatabase } from '@/lib/config-database';
import { supported_locales } from '@/i18n';

const allowed_themes = new Set(['light', 'dark', 'system']);

type AppSettingsPayload = {
  theme?: string;
  language?: string;
};

/**
 * Devuelve la configuración persistida de idioma y tema de la aplicación.
 */
export async function GET() {
  try {
    const config_database = getConfigDatabase();
    const app_settings = config_database.get_application_settings();
    return NextResponse.json(app_settings);
  } catch (error) {
    console.error('Error getting app settings:', error);
    return NextResponse.json({ error: 'Error getting app settings' }, { status: 500 });
  }
}

/**
 * Actualiza los valores predeterminados de idioma y tema.
 */
export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as AppSettingsPayload;
    const config_database = getConfigDatabase();

    if (payload.theme) {
      if (!allowed_themes.has(payload.theme)) {
        return NextResponse.json({ error: 'Invalid theme value' }, { status: 400 });
      }
      config_database.set_application_setting('theme', payload.theme);
    }

    if (payload.language) {
      if (!supported_locales.includes(payload.language as (typeof supported_locales)[number])) {
        return NextResponse.json({ error: 'Invalid language value' }, { status: 400 });
      }
      config_database.set_application_setting('language', payload.language);
    }

    return NextResponse.json({ message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Error updating app settings:', error);
    return NextResponse.json({ error: 'Error updating app settings' }, { status: 500 });
  }
}
