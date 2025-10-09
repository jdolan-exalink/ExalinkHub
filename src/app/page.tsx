import { redirect } from 'next/navigation';

export default function Home() {
  // Redirige automáticamente a la dashboard en español
  redirect('/es/dashboard');
  return null;
}
