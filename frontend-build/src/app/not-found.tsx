import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Frown } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

/**
 * Pagina de error generica para recursos no encontrados.
 */
export default async function not_found_page() {
  const locale = await getLocale();
  const translate_not_found = await getTranslations('notFound');
  const dashboard_path = `/${locale}/events`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-center">
      <Frown className="h-24 w-24 text-muted-foreground" />
      <h1 className="font-headline text-5xl font-bold">{translate_not_found('title')}</h1>
      <p className="text-lg text-muted-foreground">{translate_not_found('description')}</p>
      <Button asChild>
        <Link href={dashboard_path}>{translate_not_found('cta')}</Link>
      </Button>
    </div>
  );
}
