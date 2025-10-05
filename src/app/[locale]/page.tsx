
import { redirect } from 'next/navigation';

type locale_page_props = {
  params: { locale: string };
};

/**
 * Redirige a la vista "Vivo" por defecto al cargar la web.
 */
export default function locale_root_page({ params }: locale_page_props) {
  const { locale } = params;
  redirect(`/${locale}/liveX`);
}

