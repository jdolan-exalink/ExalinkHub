import { redirect } from 'next/navigation';

type LocalePageProps = {
  params: { locale: string };
};

/**
 * Redirige a la p??gina principal seg??n el idioma seleccionado.
 */
export default function locale_root_page({ params }: LocalePageProps) {
  const { locale } = params;
  redirect(`/${locale}/events`);
}

