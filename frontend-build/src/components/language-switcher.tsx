'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * Componente para cambiar el idioma de la aplicación
 */
export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const current_locale = useLocale();
  const translate = useTranslations('user_menu');

  /**
   * Cambia el idioma de la aplicación
   */
  const change_language = (new_locale: string) => {
    // Guardar preferencia en localStorage
    localStorage.setItem('preferred_locale', new_locale);
    
    // Construir nueva ruta con el nuevo idioma
    const path_segments = pathname.split('/');
    path_segments[1] = new_locale;
    const new_path = path_segments.join('/');
    
    // Navegar a la nueva ruta
    router.push(new_path);
    router.refresh();
  };

  const languages = [
    { code: 'es', label: translate('language_es'), flag: '🇪🇸' },
    { code: 'en', label: translate('language_en'), flag: '🇺🇸' },
    { code: 'pt', label: translate('language_pt'), flag: '🇧🇷' },
  ];

  const current_language = languages.find(lang => lang.code === current_locale);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <Languages className="h-4 w-4" />
          <span className="ml-2">{translate('language')}</span>
          <span className="ml-auto text-xs opacity-60">{current_language?.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => change_language(lang.code)}
            className={current_locale === lang.code ? 'bg-accent' : ''}
          >
            <span className="mr-2">{lang.flag}</span>
            <span>{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
