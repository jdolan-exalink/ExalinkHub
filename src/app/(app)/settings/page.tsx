'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Users, Cog, Settings2 } from 'lucide-react';
import ServersTab from './components/servers-tab';
import UsersTab from './components/users-tab';
import BackendTab from './components/backend-tab';

export default function SettingsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">Configuración del Sistema</h1>
        <p className="text-muted-foreground">Gestiona servidores, usuarios y servicios de backend.</p>
      </div>
      
      <Tabs defaultValue="servers" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="servers" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            Servidores
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Usuarios y Grupos
          </TabsTrigger>
          <TabsTrigger value="backend" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Servicios Backend
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="servers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Gestión de Servidores Frigate
              </CardTitle>
              <CardDescription>
                Configura y administra las conexiones a tus servidores Frigate. 
                Soporta HTTP/HTTPS con autenticación opcional.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ServersTab />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Usuarios y Grupos
              </CardTitle>
              <CardDescription>
                Administra usuarios del sistema y organiza el acceso mediante grupos.
                Asigna roles y permisos según las necesidades de tu equipo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <UsersTab />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="backend" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cog className="h-5 w-5" />
                Servicios de Backend
              </CardTitle>
              <CardDescription>
                Configura servicios automatizados como procesamiento de matrículas,
                conteo de personas y notificaciones en tiempo real.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BackendTab />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
