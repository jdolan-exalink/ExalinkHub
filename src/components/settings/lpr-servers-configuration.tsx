/**
 * Componente de gestión de servidores LPR
 * Permite listar, agregar, editar y eliminar servidores LPR usando el archivo matriculas.conf
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Trash2, Save, PlusCircle, Edit2, Settings } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { LPRServer, LPRGeneralConfig } from '@/lib/lpr-servers';

interface LPRServerForm extends Omit<LPRServer, 'id'> {
  name: string;
}

export function LPRServersConfiguration() {
  const [servers, setServers] = useState<LPRServer[]>([]);
  const [generalConfig, setGeneralConfig] = useState<LPRGeneralConfig>({ http_port: 2221, retention_days: 30 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<LPRServer | null>(null);
  const [form, setForm] = useState<Partial<LPRServerForm>>({
    name: '',
    mqtt_broker: '127.0.0.1',
    mqtt_port: 1883,
    mqtt_user: '',
    mqtt_pass: '',
    frigate_url: '',
    frigate_token: '',
    frigate_auth: 'bearer',
    frigate_user: '',
    frigate_pass: '',
    frigate_header_name: '',
    frigate_header_value: '',
    mqtt_topic: 'frigate/events',
    sftp_host: '',
    sftp_port: 22,
    sftp_user: 'frigate',
    sftp_pass: 'frigate123',
    sftp_plate_root: '/mnt/cctv/clips/lpr',
    sftp_plate_path_template: '{root}/{camera}/{event_id}.jpg',
    sftp_clip_mode: 'api',
    sftp_clip_root: '/mnt/cctv/clips/lpr',
    sftp_clip_path_template: '{root}/{camera}/',
    enabled: true
  });

  // Cargar servidores y configuración
  const loadData = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/lpr/servers');
      const data = await response.json();
      setServers(data.servers || []);
      setGeneralConfig(data.general || { http_port: 2221, retention_days: 30 });
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo cargar la configuración LPR', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Manejar cambios en el formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    let fieldValue: any = value;
    if (type === 'checkbox' && 'checked' in e.target) {
      fieldValue = (e.target as HTMLInputElement).checked;
    } else if (type === 'number') {
      fieldValue = parseInt(value) || 0;
    }
    setForm(prev => ({
      ...prev,
      [name]: fieldValue
    }));
  };

  // Guardar servidor (alta o edición)
  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast({ title: 'Error', description: 'El nombre del servidor es obligatorio', variant: 'destructive' });
      return;
    }

    const method = editing ? 'PUT' : 'POST';
    try {
      const response = await fetch('/api/lpr/servers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { ...form, id: editing.id } : form)
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: 'Servidor guardado', description: 'La configuración LPR fue actualizada correctamente' });
        setForm({
          name: '',
          mqtt_broker: '127.0.0.1',
          mqtt_port: 1883,
          mqtt_user: '',
          mqtt_pass: '',
          frigate_url: '',
          frigate_token: '',
          frigate_auth: 'bearer',
          frigate_user: '',
          frigate_pass: '',
          frigate_header_name: '',
          frigate_header_value: '',
          mqtt_topic: 'frigate/events',
          sftp_host: '',
          sftp_port: 22,
          sftp_user: 'frigate',
          sftp_pass: 'frigate123',
          sftp_plate_root: '/mnt/cctv/clips/lpr',
          sftp_plate_path_template: '{root}/{camera}/{event_id}.jpg',
          sftp_clip_mode: 'api',
          sftp_clip_root: '/mnt/cctv/clips/lpr',
          sftp_clip_path_template: '{root}/{camera}/',
          enabled: true
        });
        setEditing(null);
        loadData();
      } else {
        toast({ title: 'Error', description: data.error || 'No se pudo guardar el servidor', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo guardar el servidor', variant: 'destructive' });
    }
  };

  // Eliminar servidor
  const handleDelete = async (server: LPRServer) => {
    try {
      const response = await fetch('/api/lpr/servers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: server.id })
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: 'Servidor eliminado', description: 'El servidor LPR fue eliminado correctamente' });
        loadData();
      } else {
        toast({ title: 'Error', description: data.error || 'No se pudo eliminar el servidor', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el servidor', variant: 'destructive' });
    }
  };

  // Iniciar edición
  const startEdit = (server: LPRServer) => {
    setEditing(server);
    setForm(server);
  };

  // Cancelar edición
  const cancelEdit = () => {
    setEditing(null);
    setForm({
      name: '',
      mqtt_broker: '127.0.0.1',
      mqtt_port: 1883,
      mqtt_user: '',
      mqtt_pass: '',
      frigate_url: '',
      frigate_token: '',
      frigate_auth: 'bearer',
      frigate_user: '',
      frigate_pass: '',
      frigate_header_name: '',
      frigate_header_value: '',
      mqtt_topic: 'frigate/events',
      sftp_host: '',
      sftp_port: 22,
      sftp_user: 'frigate',
      sftp_pass: 'frigate123',
      sftp_plate_root: '/mnt/cctv/clips/lpr',
      sftp_plate_path_template: '{root}/{camera}/{event_id}.jpg',
      sftp_clip_mode: 'api',
      sftp_clip_root: '/mnt/cctv/clips/lpr',
      sftp_clip_path_template: '{root}/{camera}/',
      enabled: true
    });
  };

  // Actualizar configuración general
  const updateGeneralConfig = async () => {
    try {
      const response = await fetch('/api/lpr/servers/general', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(generalConfig)
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: 'Configuración actualizada', description: 'La configuración general fue guardada correctamente' });
      } else {
        toast({ title: 'Error', description: data.error || 'No se pudo actualizar la configuración', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar la configuración', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuración General */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración General LPR
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Puerto HTTP del servicio</Label>
              <Input
                type="number"
                value={generalConfig.http_port}
                onChange={(e) => setGeneralConfig(prev => ({ ...prev, http_port: parseInt(e.target.value) || 2221 }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Por defecto 2221</p>
            </div>
            <div>
              <Label>Días de retención</Label>
              <Input
                type="number"
                value={generalConfig.retention_days}
                onChange={(e) => setGeneralConfig(prev => ({ ...prev, retention_days: parseInt(e.target.value) || 30 }))}
              />
              <p className="text-xs text-muted-foreground mt-1">Días para mantener medios (por defecto 30)</p>
            </div>
          </div>
          <Button onClick={updateGeneralConfig} className="mt-4">
            <Save className="h-4 w-4 mr-1" />
            Guardar Configuración General
          </Button>
        </CardContent>
      </Card>

      {/* Servidores LPR */}
      <Card>
        <CardHeader>
          <CardTitle>Servidores LPR</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2"><RefreshCw className="animate-spin" />Cargando configuración...</div>
          ) : (
            <>
              {/* Listado de servidores */}
              <div className="mb-6">
                {servers.length === 0 ? (
                  <Alert>
                    <AlertDescription>No hay servidores LPR configurados.</AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    {servers.map(server => (
                      <div key={server.id} className="flex items-center gap-2 border rounded p-3">
                        <div className="flex-1">
                          <strong>{server.name}</strong>
                          <div className="text-sm text-muted-foreground">
                            MQTT: {server.mqtt_broker}:{server.mqtt_port} |
                            Frigate: {server.frigate_url || 'No configurado'} |
                            SFTP: {server.sftp_host || 'No configurado'}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => startEdit(server)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(server)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Formulario alta/edición */}
              <div className="border rounded p-4 mb-2">
                <h4 className="font-semibold mb-4">{editing ? 'Editar servidor' : 'Agregar nuevo servidor'}</h4>

                {/* Nombre del servidor */}
                <div className="grid grid-cols-1 gap-4 mb-4">
                  <div>
                    <Label>Nombre del servidor *</Label>
                    <Input name="name" value={form.name || ''} onChange={handleChange} placeholder="ej: helvecia, principal" />
                  </div>
                </div>

                {/* MQTT Configuration */}
                <div className="mb-4">
                  <h5 className="font-medium mb-2">Configuración MQTT</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Broker MQTT</Label>
                      <Input name="mqtt_broker" value={form.mqtt_broker || ''} onChange={handleChange} placeholder="IP del broker" />
                    </div>
                    <div>
                      <Label>Puerto MQTT</Label>
                      <Input name="mqtt_port" type="number" value={form.mqtt_port || 1883} onChange={handleChange} />
                    </div>
                    <div>
                      <Label>Usuario MQTT</Label>
                      <Input name="mqtt_user" value={form.mqtt_user || ''} onChange={handleChange} />
                    </div>
                    <div>
                      <Label>Contraseña MQTT</Label>
                      <Input name="mqtt_pass" type="password" value={form.mqtt_pass || ''} onChange={handleChange} />
                    </div>
                  </div>
                </div>

                {/* Frigate Configuration */}
                <div className="mb-4">
                  <h5 className="font-medium mb-2">Configuración Frigate</h5>
                  <div className="grid grid-cols-1 gap-4 mb-2">
                    <div>
                      <Label>URL de Frigate</Label>
                      <Input name="frigate_url" value={form.frigate_url || ''} onChange={handleChange} placeholder="http://10.1.1.252:5000" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-2">
                    <div>
                      <Label>Tipo de autenticación</Label>
                      <select name="frigate_auth" value={form.frigate_auth || 'bearer'} onChange={handleChange} className="w-full border rounded px-2 py-1" title="Tipo de autenticación para Frigate">
                        <option value="bearer">Bearer Token</option>
                        <option value="basic">Basic Auth</option>
                        <option value="header">Custom Header</option>
                      </select>
                    </div>
                    <div>
                      <Label>Topic MQTT</Label>
                      <Input name="mqtt_topic" value={form.mqtt_topic || ''} onChange={handleChange} placeholder="frigate/events" />
                    </div>
                  </div>

                  {form.frigate_auth === 'bearer' && (
                    <div className="mb-2">
                      <Label>Token Bearer</Label>
                      <Input name="frigate_token" value={form.frigate_token || ''} onChange={handleChange} />
                    </div>
                  )}

                  {form.frigate_auth === 'basic' && (
                    <div className="grid grid-cols-2 gap-4 mb-2">
                      <div>
                        <Label>Usuario Frigate</Label>
                        <Input name="frigate_user" value={form.frigate_user || ''} onChange={handleChange} />
                      </div>
                      <div>
                        <Label>Contraseña Frigate</Label>
                        <Input name="frigate_pass" type="password" value={form.frigate_pass || ''} onChange={handleChange} />
                      </div>
                    </div>
                  )}

                  {form.frigate_auth === 'header' && (
                    <div className="grid grid-cols-2 gap-4 mb-2">
                      <div>
                        <Label>Nombre del header</Label>
                        <Input name="frigate_header_name" value={form.frigate_header_name || ''} onChange={handleChange} />
                      </div>
                      <div>
                        <Label>Valor del header</Label>
                        <Input name="frigate_header_value" value={form.frigate_header_value || ''} onChange={handleChange} />
                      </div>
                    </div>
                  )}
                </div>

                {/* SFTP Configuration */}
                <div className="mb-4">
                  <h5 className="font-medium mb-2">Configuración SFTP</h5>
                  <div className="grid grid-cols-2 gap-4 mb-2">
                    <div>
                      <Label>Host SFTP</Label>
                      <Input name="sftp_host" value={form.sftp_host || ''} onChange={handleChange} placeholder="IP del servidor SFTP" />
                    </div>
                    <div>
                      <Label>Puerto SFTP</Label>
                      <Input name="sftp_port" type="number" value={form.sftp_port || 22} onChange={handleChange} />
                    </div>
                    <div>
                      <Label>Usuario SFTP</Label>
                      <Input name="sftp_user" value={form.sftp_user || ''} onChange={handleChange} />
                    </div>
                    <div>
                      <Label>Contraseña SFTP</Label>
                      <Input name="sftp_pass" type="password" value={form.sftp_pass || ''} onChange={handleChange} />
                    </div>
                  </div>

                  <div className="mb-2">
                    <Label>Raíz SFTP para matrículas</Label>
                    <Input name="sftp_plate_root" value={form.sftp_plate_root || ''} onChange={handleChange} placeholder="/mnt/cctv/clips/lpr" />
                  </div>

                  <div className="mb-2">
                    <Label>Template ruta matrículas</Label>
                    <Input name="sftp_plate_path_template" value={form.sftp_plate_path_template || ''} onChange={handleChange} placeholder="{root}/{camera}/{event_id}.jpg" />
                    <p className="text-xs text-muted-foreground mt-1">Variables: {'{event_id}'}, {'{camera}'}, {'{root}'}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-2">
                    <div>
                      <Label>Modo clips</Label>
                      <select name="sftp_clip_mode" value={form.sftp_clip_mode || 'api'} onChange={handleChange} className="w-full border rounded px-2 py-1" title="Modo de descarga de clips">
                        <option value="api">API</option>
                        <option value="sftp">SFTP</option>
                      </select>
                    </div>
                    <div>
                      <Label>Raíz SFTP para clips</Label>
                      <Input name="sftp_clip_root" value={form.sftp_clip_root || ''} onChange={handleChange} placeholder="/mnt/cctv/clips/lpr" />
                    </div>
                  </div>

                  <div className="mb-2">
                    <Label>Template ruta clips</Label>
                    <Input name="sftp_clip_path_template" value={form.sftp_clip_path_template || ''} onChange={handleChange} placeholder="{root}/{camera}/" />
                    <p className="text-xs text-muted-foreground mt-1">Variables: {'{event_id}'}, {'{camera}'}, {'{root}'}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleSave} variant="default">
                    <Save className="h-4 w-4 mr-1" />
                    {editing ? 'Guardar cambios' : 'Agregar servidor'}
                  </Button>
                  {editing && (
                    <Button onClick={cancelEdit} variant="outline">
                      <PlusCircle className="h-4 w-4 mr-1" />
                      Nuevo
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default LPRServersConfiguration;