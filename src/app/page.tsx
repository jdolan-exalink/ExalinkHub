import { redirect } from 'next/navigation';

/**
 * Redirige la raíz '/' al locale por defecto 'es' y a la vista "Vivo".
 */
export default function root_redirect_page() {
  redirect('/es/liveX');
  return null;
}
