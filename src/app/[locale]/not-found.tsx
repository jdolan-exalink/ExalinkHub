import { redirect } from 'next/navigation';

/**
 * Redirige cualquier ruta no encontrada a la vista "Vivo".
 * Se asume que la ruta de "Vivo" es /liveX.
 */
export default function NotFound() {
  redirect('/liveX');
  return null;
}
