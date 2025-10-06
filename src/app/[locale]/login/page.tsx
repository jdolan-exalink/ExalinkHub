'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { use_auth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2 } from 'lucide-react';

/**
 * Página de inicio de sesión
 */
export default function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const [username, set_username] = useState('');
  const [password, set_password] = useState('');
  const [error, set_error] = useState('');
  const [is_loading, set_is_loading] = useState(false);
  
  const { login, user, loading: auth_loading } = use_auth();
  const router = useRouter();
  const { locale } = use(params);

  // Si ya está autenticado, redirigir a /live
  useEffect(() => {
    if (!auth_loading && user) {
      router.push(`/${locale}/live`);
    }
  }, [user, auth_loading, router, locale]);

  /**
   * Maneja el envío del formulario de login
   */
  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault();
    set_error('');
    set_is_loading(true);

    const result = await login(username, password);

    if (result.success) {
      // Redirigir a /live después del login exitoso
      router.push(`/${locale}/live`);
    } else {
      set_error(result.error || 'Error al iniciar sesión');
      set_is_loading(false);
    }
  };

  // Mostrar loading mientras verifica la sesión
  if (auth_loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <Card className="w-full max-w-md border-slate-700 bg-slate-800/50 backdrop-blur">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-500/10 rounded-full">
              <Shield className="w-12 h-12 text-blue-500" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-white">ExalinkHub</CardTitle>
          <CardDescription className="text-slate-400">
            Ingresa tus credenciales para acceder al sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handle_submit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-red-500/10 border-red-500/50">
                <AlertDescription className="text-red-400">{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-300">Usuario</Label>
              <Input
                id="username"
                type="text"
                placeholder="Ingresa tu usuario"
                value={username}
                onChange={(e) => set_username(e.target.value)}
                required
                disabled={is_loading}
                className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-300">Contraseña</Label>
              <Input
                id="password"
                type="password"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={(e) => set_password(e.target.value)}
                required
                disabled={is_loading}
                className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={is_loading}
            >
              {is_loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Iniciando sesión...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-400">
            <p>Usuario por defecto: <span className="text-blue-400 font-mono">admin</span></p>
            <p>Contraseña: <span className="text-blue-400 font-mono">admin123</span></p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
