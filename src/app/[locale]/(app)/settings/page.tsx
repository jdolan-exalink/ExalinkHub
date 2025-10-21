'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Users, Settings2, Palette, Scan } from 'lucide-react';
import { useTranslations } from 'next-intl';
import ServersTab from './components/servers-tab';
import UsersTab from './components/users-tab';
import BackendTab from './components/backend-tab';
import GeneralPreferencesCard from './components/general-preferences-card';
import PanelsConfiguration from '@/components/settings/panels-configuration';
import LPRServersConfiguration from '@/components/settings/lpr-servers-configuration';

export default function SettingsPage() {
  const translate_settings = useTranslations('SettingsPage');
  return (
    <div className="h-full overflow-y-auto">
      <div className="container mx-auto p-6 space-y-6 pb-10">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">{translate_settings('heading')}</h1>
          <p className="text-muted-foreground">{translate_settings('heading_description')}</p>
        </div>

        <Tabs defaultValue="servers" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="servers" className="flex items-center gap-2">
              <Server className="h-4 w-4" />
              {translate_settings('tab_servers')}
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {translate_settings('tab_users')}
            </TabsTrigger>
            <TabsTrigger value="backend" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              {translate_settings('tab_backend')}
            </TabsTrigger>
            <TabsTrigger value="panels" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              {translate_settings('tab_panels')}
            </TabsTrigger>
            <TabsTrigger value="lpr" className="flex items-center gap-2">
              <Scan className="h-4 w-4" />
              LPR
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              {translate_settings('tab_appearance')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="servers" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  {translate_settings('servers_card_title')}
                </CardTitle>
                <CardDescription>
                  {translate_settings('servers_card_description')}
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
                  {translate_settings('users_card_title')}
                </CardTitle>
                <CardDescription>
                  {translate_settings('users_card_description')}
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
                  <Settings2 className="h-5 w-5" />
                  {translate_settings('backend_card_title')}
                </CardTitle>
                <CardDescription>
                  {translate_settings('backend_card_description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BackendTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="panels" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings2 className="h-5 w-5" />
                  {translate_settings('panels_card_title')}
                </CardTitle>
                <CardDescription>
                  {translate_settings('panels_card_description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PanelsConfiguration />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lpr" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scan className="h-5 w-5" />
                  Configuración LPR (Matrículas)
                </CardTitle>
                <CardDescription>
                  Gestión de servidores LPR y configuración de reconocimiento de matrículas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <LPRServersConfiguration />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4">
            <GeneralPreferencesCard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
