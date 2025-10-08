'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { use_auth } from '@/contexts/auth-context';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  required_module?: string;
  required_action?: string;
}

/**
 * Componente que protege rutas requiriendo autenticación y permisos específicos
 */
export function ProtectedRoute({ 
  children, 
  required_module, 
  required_action = 'view' 
}: ProtectedRouteProps) {
  const { user, loading, check_permission, has_module_access } = use_auth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // Si no hay usuario, redirigir al login
    if (!user) {
      const locale = pathname?.split('/')[1] || 'es';
      router.push(`/${locale}/login`);
      return;
    }

    // Si se requiere un módulo específico, verificar acceso
    if (required_module) {
      const has_access = has_module_access(required_module);
      const has_permission = check_permission(required_module, required_action);

      if (!has_access || !has_permission) {
        // Redirigir a la página de inicio si no tiene permisos
        const locale = pathname?.split('/')[1] || 'es';
        router.push(`/${locale}/live`);
      }
    }
  }, [user, loading, required_module, required_action, router, pathname, check_permission, has_module_access]);

  // Mostrar loading mientras verifica
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // Si no hay usuario, no mostrar nada (se está redirigiendo)
  if (!user) {
    return null;
  }

  // Si se requiere módulo y no tiene acceso, no mostrar nada (se está redirigiendo)
  if (required_module && (!has_module_access(required_module) || !check_permission(required_module, required_action))) {
    return null;
  }

  return <>{children}</>;
}
