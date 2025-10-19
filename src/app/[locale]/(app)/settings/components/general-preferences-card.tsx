"use client";

import { useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

const theme_choices = ['light', 'dark', 'system'] as const;
const language_choices = ['es', 'en', 'pt'] as const;
const timezone_choices = [
  'America/Argentina/Buenos_Aires',
  'America/Sao_Paulo',
  'America/Santiago',
  'America/Lima',
  'America/Bogota',
  'America/Mexico_City',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
  'Europe/London',
  'UTC'
] as const;

type ApplicationSettingsState = {
  theme: string;
  language: string;
  timezone: string;
};

/**
 * Tarjeta de preferencias generales para idioma y tema predeterminado.
 */
export default function general_preferences_card() {
  const { theme, setTheme } = useTheme();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const translate_settings = useTranslations('SettingsPage');

  const [selected_theme, set_selected_theme] = useState<string>(theme ?? 'system');
  const [selected_language, set_selected_language] = useState<string>(locale);
  const [selected_timezone, set_selected_timezone] = useState<string>('America/Argentina/Buenos_Aires');
  const [initial_settings, set_initial_settings] = useState<ApplicationSettingsState>({
    theme: theme ?? 'system',
    language: locale,
    timezone: 'America/Argentina/Buenos_Aires',
  });
  const [is_loading, set_is_loading] = useState<boolean>(true);
  const [is_saving, set_is_saving] = useState<boolean>(false);

  const locale_prefix = useMemo(() => `/${locale}`, [locale]);

  useEffect(() => {
    const load_settings = async () => {
      try {
        const response = await fetch('/api/config/settings', { cache: 'no-cache' });
        if (!response.ok) {
          throw new Error('Failed to fetch settings');
        }
        const data = (await response.json()) as Record<string, string>;
        const persisted_theme = data.theme ?? 'system';
        const persisted_language = data.language ?? locale;
        const persisted_timezone = data.timezone ?? 'America/Argentina/Buenos_Aires';
        set_selected_theme(persisted_theme);
        set_selected_language(persisted_language);
        set_selected_timezone(persisted_timezone);
        set_initial_settings({ theme: persisted_theme, language: persisted_language, timezone: persisted_timezone });
        if (persisted_theme !== (theme ?? 'system')) {
          setTheme(persisted_theme);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        toast({
          title: translate_settings('error_title'),
          description: translate_settings('error_description'),
          variant: 'destructive',
        });
      } finally {
        set_is_loading(false);
      }
    };

    load_settings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (theme) {
      set_selected_theme(theme);
    }
  }, [theme]);

  const is_dirty =
    selected_theme !== initial_settings.theme || 
    selected_language !== initial_settings.language || 
    selected_timezone !== initial_settings.timezone;

  const handle_save = async () => {
    try {
      set_is_saving(true);
      const response = await fetch('/api/config/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          theme: selected_theme,
          language: selected_language,
          timezone: selected_timezone,
        }),
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      setTheme(selected_theme);
      set_initial_settings({ theme: selected_theme, language: selected_language, timezone: selected_timezone });

      toast({
        title: translate_settings('success_message'),
      });

      if (selected_language !== locale) {
        const normalized_path = pathname.startsWith(locale_prefix)
          ? pathname.slice(locale_prefix.length)
          : pathname;
        router.replace(`/${selected_language}${normalized_path || ''}`);
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      toast({
        title: translate_settings('error_title'),
        description: translate_settings('error_description'),
        variant: 'destructive',
      });
    } finally {
      set_is_saving(false);
    }
  };

  const disable_actions = is_loading || is_saving || !is_dirty;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{translate_settings('appearance')}</CardTitle>
        <CardDescription>{translate_settings('appearance_desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium">{translate_settings('language')}</label>
          <p className="text-sm text-muted-foreground">{translate_settings('language_desc')}</p>
          <Select
            value={selected_language}
            onValueChange={set_selected_language}
            disabled={is_loading || is_saving}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder={translate_settings('language')} />
            </SelectTrigger>
            <SelectContent>
              {language_choices.map((language) => (
                <SelectItem key={language} value={language}>
                  {translate_settings(`language_label_${language}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{translate_settings('theme')}</label>
          <p className="text-sm text-muted-foreground">{translate_settings('theme_desc')}</p>
          <Select
            value={selected_theme}
            onValueChange={set_selected_theme}
            disabled={is_loading || is_saving}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder={translate_settings('theme')} />
            </SelectTrigger>
            <SelectContent>
              {theme_choices.map((theme_option) => (
                <SelectItem key={theme_option} value={theme_option}>
                  {translate_settings(theme_option)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Zona Horaria</label>
          <p className="text-sm text-muted-foreground">Selecciona tu zona horaria para mostrar fechas y horas correctamente</p>
          <Select
            value={selected_timezone}
            onValueChange={set_selected_timezone}
            disabled={is_loading || is_saving}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Zona Horaria" />
            </SelectTrigger>
            <SelectContent>
              {timezone_choices.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handle_save} disabled={disable_actions}>
          {is_saving ? translate_settings('saving_label') : translate_settings('save_button')}
        </Button>
      </CardContent>
    </Card>
  );
}
