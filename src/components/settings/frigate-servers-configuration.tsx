/**
 * Componente de gestión de servidores Frigate
 * Permite listar, agregar, editar y eliminar servidores Frigate usando la API /api/frigate/servers
 */

'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, Trash2, Save, PlusCircle, Edit2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface FrigateServer {
  id?: number;
  name: string;
  url: string;
  port: number;
  protocol: 'http' | 'https';
  username?: string;
  password?: string;
  auth_type?: 'basic' | 'bearer';
  jwt_token?: string;
  enabled: boolean;
}

export function FrigateServersConfiguration() {
  const [servers, setServers] = useState<FrigateServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<FrigateServer | null>(null);
  const [form, setForm] = useState<Partial<FrigateServer>>({
    name: '',
    url: '',
    port: 5000,
    protocol: 'http',
    username: '',
    password: '',
    auth_type: 'basic',
    enabled: true
  });

  // Cargar servidores
  const loadServers = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/frigate/servers');
      const data = await response.json();
      setServers(data.servers || []);
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo cargar la lista de servidores', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadServers();
  }, []);

  // Manejar cambios en el formulario
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let fieldValue: any = value;
    if (type === 'checkbox' && 'checked' in e.target) {
      fieldValue = (e.target as HTMLInputElement).checked;
    }
    setForm(prev => ({
      ...prev,
      [name]: fieldValue
    }));
  };

  // Guardar servidor (alta o edición)
  const handleSave = async () => {
    const method = editing ? 'PUT' : 'POST';
    try {
      const response = await fetch('/api/frigate/servers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editing ? { ...form, id: editing.id } : form)
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: 'Servidor guardado', description: 'La configuración fue actualizada correctamente' });
        setForm({ name: '', url: '', port: 5000, protocol: 'http', username: '', password: '', auth_type: 'basic', enabled: true });
        setEditing(null);
        loadServers();
      } else {
        toast({ title: 'Error', description: data.error || 'No se pudo guardar el servidor', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo guardar el servidor', variant: 'destructive' });
    }
  };

  // Eliminar servidor
  const handleDelete = async (id?: number) => {
    if (!id) return;
    try {
      const response = await fetch('/api/frigate/servers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: 'Servidor eliminado', description: 'El servidor fue eliminado correctamente' });
        loadServers();
      } else {
        toast({ title: 'Error', description: data.error || 'No se pudo eliminar el servidor', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'No se pudo eliminar el servidor', variant: 'destructive' });
    }
  };

  // Iniciar edición
  const startEdit = (server: FrigateServer) => {
    setEditing(server);
    setForm(server);
  };

  // Cancelar edición
  const cancelEdit = () => {
    setEditing(null);
    setForm({ name: '', url: '', port: 5000, protocol: 'http', username: '', password: '', auth_type: 'basic', enabled: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Servidores Frigate</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2"><RefreshCw className="animate-spin" />Cargando...</div>
        ) : (
          <>
            {/* Listado de servidores */}
            <div className="mb-6">
              {servers.length === 0 ? (
                <Alert>
                  <AlertDescription>No hay servidores configurados.</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {servers.map(server => (
                    <div key={server.id} className="flex items-center gap-2 border rounded p-2">
                      <div className="flex-1">
                        <strong>{server.name}</strong> <span className="text-xs">({server.protocol}://{server.url}:{server.port})</span>
                        <span className="ml-2 text-xs">{server.enabled ? 'Habilitado' : 'Deshabilitado'}</span>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => startEdit(server)}><Edit2 className="h-4 w-4" /></Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(server.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Formulario alta/edición */}
            <div className="border rounded p-4 mb-2">
              <h4 className="font-semibold mb-2">{editing ? 'Editar servidor' : 'Agregar nuevo servidor'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre</Label>
                  <Input name="name" value={form.name || ''} onChange={handleChange} placeholder="Nombre del servidor" />
                </div>
                <div>
                  <Label>URL/IP</Label>
                  <Input name="url" value={form.url || ''} onChange={handleChange} placeholder="IP o dominio" />
                </div>
                <div>
                  <Label>Puerto</Label>
                  <Input name="port" type="number" value={form.port || 5000} onChange={handleChange} />
                </div>
                <div>
                  <Label>Protocolo</Label>
                  <select name="protocol" value={form.protocol || 'http'} onChange={handleChange} className="w-full border rounded px-2 py-1" title="Protocolo">
                    <option value="http">http</option>
                    <option value="https">https</option>
                  </select>
                </div>
                <div>
                  <Label>Usuario (opcional)</Label>
                  <Input name="username" value={form.username || ''} onChange={handleChange} />
                </div>
                <div>
                  <Label>Contraseña (opcional)</Label>
                  <Input name="password" type="password" value={form.password || ''} onChange={handleChange} />
                </div>
                <div>
                  <Label>Tipo de autenticación</Label>
                  <select name="auth_type" value={form.auth_type || 'basic'} onChange={handleChange} className="w-full border rounded px-2 py-1" title="Tipo de autenticación">
                    <option value="basic">Basic</option>
                    <option value="bearer">Bearer</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Switch name="enabled" checked={form.enabled ?? true} onCheckedChange={checked => setForm(prev => ({ ...prev, enabled: checked }))} />
                  <Label>Habilitado</Label>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleSave} variant="default"><Save className="h-4 w-4 mr-1" />{editing ? 'Guardar cambios' : 'Agregar servidor'}</Button>
                {editing && <Button onClick={cancelEdit} variant="outline"><PlusCircle className="h-4 w-4 mr-1" />Nuevo</Button>}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default FrigateServersConfiguration;
