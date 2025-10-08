'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { Permission } from '@/lib/config-database';

interface AuthUser {
  id: number;
  username: string;
  role: 'admin' | 'operator' | 'viewer';
  enabled: boolean;
  accessible_modules: string[];
  permissions: Permission[];
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  check_permission: (module: string, action: string) => boolean;
  has_module_access: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Provider de autenticación que maneja el estado del usuario y sesión
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, set_user] = useState<AuthUser | null>(null);
  const [loading, set_loading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  /**
   * Verifica la sesión actual al cargar la aplicación
   */
  const check_session = async () => {
    try {
      // No verificar sesión si estamos en la página de login
      if (pathname?.includes('/login')) {
        set_loading(false);
        return;
      }

      const response = await fetch('/api/auth/session');
      const data = await response.json();

      if (data.authenticated && data.user) {
        set_user(data.user);
      } else {
        set_user(null);
        // Redirigir al login si no está en la página de login
        const locale = pathname?.split('/')[1] || 'es';
        router.push(`/${locale}/login`);
      }
    } catch (error) {
      console.error('Error verificando sesión:', error);
      set_user(null);
      // Redirigir al login en caso de error
      if (!pathname?.includes('/login')) {
        const locale = pathname?.split('/')[1] || 'es';
        router.push(`/${locale}/login`);
      }
    } finally {
      set_loading(false);
    }
  };

  useEffect(() => {
    check_session();
  }, []);

  /**
   * Inicia sesión con usuario y contraseña
   */
  const login = async (username: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        set_user(data.user);
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Error al iniciar sesión' };
      }
    } catch (error) {
      console.error('Error en login:', error);
      return { success: false, error: 'Error de conexión' };
    }
  };

  /**
   * Cierra la sesión actual
   */
  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      set_user(null);
      const locale = pathname?.split('/')[1] || 'es';
      router.push(`/${locale}/login`);
    } catch (error) {
      console.error('Error en logout:', error);
    }
  };

  /**
   * Verifica si el usuario tiene un permiso específico
   */
  const check_permission = (module: string, action: string): boolean => {
    if (!user) return false;

    const permission = user.permissions.find(
      (p: Permission) => p.module === module && p.action === action
    );

    return permission?.allowed || false;
  };

  /**
   * Verifica si el usuario tiene acceso a un módulo
   */
  const has_module_access = (module: string): boolean => {
    if (!user) return false;
    return user.accessible_modules.includes(module);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        check_permission,
        has_module_access
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook para usar el contexto de autenticación
 */
export function use_auth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('use_auth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
