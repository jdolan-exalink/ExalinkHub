import { redirect } from 'next/navigation';

type LocalePageProps = {
  params: Promise<{ locale: string }>;
};

/**
 * Redirige al dashboard principal según el idioma seleccionado.
 */
export default async function locale_root_page({ params }: LocalePageProps) {
  const { locale } = await params;
  redirect(`/${locale}/dashboard`);
}

