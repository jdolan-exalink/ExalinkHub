'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, User, Users, Edit, Trash2, Shield, Eye, Settings } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import type { User as UserType, Group as GroupType } from '@/lib/config-database';

export default function UsersTab() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [groups, setGroups] = useState<GroupType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [editingGroup, setEditingGroup] = useState<GroupType | null>(null);
  
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    role: 'viewer' as 'admin' | 'operator' | 'viewer',
    enabled: true
  });

  const [groupFormData, setGroupFormData] = useState({
    name: '',
    description: '',
    saved_views: [] as string[]
  });

  useEffect(() => {
    loadUsers();
    loadGroups();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/config/users');
      const data = await response.json();
      if (data.users) {
        setUsers(data.users);
      }
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await fetch('/api/config/groups');
      const data = await response.json();
      if (data.groups) {
        setGroups(data.groups);
      }
    } catch (error) {
      console.error('Error cargando grupos:', error);
    }
  };

  const resetUserForm = () => {
    setUserFormData({
      username: '',
      password: '',
      role: 'viewer',
      enabled: true
    });
    setEditingUser(null);
  };

  const resetGroupForm = () => {
    setGroupFormData({
      name: '',
      description: '',
      saved_views: []
    });
    setEditingGroup(null);
  };

  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingUser 
        ? `/api/config/users/${editingUser.id}`
        : '/api/config/users';
      
      const method = editingUser ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userFormData),
      });

      if (response.ok) {
        await loadUsers();
        setIsUserDialogOpen(false);
        resetUserForm();
      } else {
        const error = await response.json();
        alert(error.error || 'Error al guardar usuario');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar usuario');
    }
  };

  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const url = editingGroup 
        ? `/api/config/groups/${editingGroup.id}`
        : '/api/config/groups';
      
      const method = editingGroup ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(groupFormData),
      });

      if (response.ok) {
        await loadGroups();
        setIsGroupDialogOpen(false);
        resetGroupForm();
      } else {
        const error = await response.json();
        alert(error.error || 'Error al guardar grupo');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar grupo');
    }
  };

  const handleEditUser = (user: UserType) => {
    setUserFormData({
      username: user.username,
      password: '', // No mostramos la password actual
      role: user.role,
      enabled: user.enabled
    });
    setEditingUser(user);
    setIsUserDialogOpen(true);
  };

  const handleEditGroup = (group: GroupType) => {
    setGroupFormData({
      name: group.name,
      description: group.description || '',
      saved_views: JSON.parse(group.saved_views)
    });
    setEditingGroup(group);
    setIsGroupDialogOpen(true);
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      return;
    }

    try {
      const response = await fetch(`/api/config/users/${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadUsers();
      } else {
        const error = await response.json();
        alert(error.error || 'Error al eliminar usuario');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar usuario');
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este grupo?')) {
      return;
    }

    try {
      const response = await fetch(`/api/config/groups/${groupId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadGroups();
      } else {
        const error = await response.json();
        alert(error.error || 'Error al eliminar grupo');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar grupo');
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge variant="default" className="bg-red-500"><Shield className="h-3 w-3 mr-1" />Admin</Badge>;
      case 'operator':
        return <Badge variant="default" className="bg-blue-500"><Settings className="h-3 w-3 mr-1" />Operador</Badge>;
      case 'viewer':
        return <Badge variant="secondary"><Eye className="h-3 w-3 mr-1" />Visualizador</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  if (loading) {
    return <div>Cargando usuarios y grupos...</div>;
  }

  return (
    <Tabs defaultValue="users" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="users" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Usuarios
        </TabsTrigger>
        <TabsTrigger value="groups" className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Grupos
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="users" className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium">Usuarios del Sistema</h3>
            <p className="text-sm text-muted-foreground">
              {users.length} usuario{users.length !== 1 ? 's' : ''} registrado{users.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <Dialog open={isUserDialogOpen} onOpenChange={(open) => {
            setIsUserDialogOpen(open);
            if (!open) resetUserForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Usuario
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <form onSubmit={handleUserSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingUser ? 'Editar Usuario' : 'Agregar Nuevo Usuario'}
                  </DialogTitle>
                  <DialogDescription>
                    Configura las credenciales y permisos del usuario.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="username" className="text-right">Usuario</Label>
                    <Input
                      id="username"
                      value={userFormData.username}
                      onChange={(e) => setUserFormData({...userFormData, username: e.target.value})}
                      className="col-span-3"
                      placeholder="admin"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="password" className="text-right">Contraseña</Label>
                    <Input
                      id="password"
                      type="password"
                      value={userFormData.password}
                      onChange={(e) => setUserFormData({...userFormData, password: e.target.value})}
                      className="col-span-3"
                      placeholder={editingUser ? "Dejar vacío para mantener actual" : "Contraseña"}
                      required={!editingUser}
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="role" className="text-right">Rol</Label>
                    <Select
                      value={userFormData.role}
                      onValueChange={(value: 'admin' | 'operator' | 'viewer') => setUserFormData({...userFormData, role: value})}
                    >
                      <SelectTrigger className="col-span-3">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador (Control total)</SelectItem>
                        <SelectItem value="operator">Operador (Gestión limitada)</SelectItem>
                        <SelectItem value="viewer">Visualizador (Solo lectura)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Estado</Label>
                    <div className="col-span-3 flex items-center space-x-2">
                      <Checkbox
                        id="enabled"
                        checked={userFormData.enabled}
                        onCheckedChange={(checked) => setUserFormData({...userFormData, enabled: !!checked})}
                      />
                      <Label htmlFor="enabled">Usuario activo</Label>
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsUserDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingUser ? 'Actualizar' : 'Crear'} Usuario
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {users.map((user) => (
            <Card key={user.id} className={!user.enabled ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{user.username}</CardTitle>
                      <CardDescription>
                        Creado: {new Date(user.created_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {getRoleBadge(user.role)}
                    {!user.enabled && <Badge variant="outline">Inactivo</Badge>}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditUser(user)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    {user.username !== 'admin' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {users.length === 0 && (
          <Alert>
            <User className="h-4 w-4" />
            <AlertDescription>
              No hay usuarios configurados. El usuario admin se crea automáticamente.
            </AlertDescription>
          </Alert>
        )}
      </TabsContent>
      
      <TabsContent value="groups" className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium">Grupos de Usuarios</h3>
            <p className="text-sm text-muted-foreground">
              {groups.length} grupo{groups.length !== 1 ? 's' : ''} configurado{groups.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <Dialog open={isGroupDialogOpen} onOpenChange={(open) => {
            setIsGroupDialogOpen(open);
            if (!open) resetGroupForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Crear Grupo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <form onSubmit={handleGroupSubmit}>
                <DialogHeader>
                  <DialogTitle>
                    {editingGroup ? 'Editar Grupo' : 'Crear Nuevo Grupo'}
                  </DialogTitle>
                  <DialogDescription>
                    Organiza usuarios y asigna vistas guardadas al grupo.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="groupName" className="text-right">Nombre</Label>
                    <Input
                      id="groupName"
                      value={groupFormData.name}
                      onChange={(e) => setGroupFormData({...groupFormData, name: e.target.value})}
                      className="col-span-3"
                      placeholder="Operadores de Noche"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label htmlFor="groupDescription" className="text-right pt-2">Descripción</Label>
                    <Textarea
                      id="groupDescription"
                      value={groupFormData.description}
                      onChange={(e) => setGroupFormData({...groupFormData, description: e.target.value})}
                      className="col-span-3"
                      placeholder="Descripción opcional del grupo..."
                      rows={3}
                    />
                  </div>
                  
                  <div className="grid grid-cols-4 items-start gap-4">
                    <Label className="text-right pt-2">Vistas</Label>
                    <div className="col-span-3">
                      <p className="text-sm text-muted-foreground mb-2">
                        Las vistas guardadas se asignarán desde el panel de Vivo.
                      </p>
                      <Badge variant="outline">
                        {groupFormData.saved_views.length} vista{groupFormData.saved_views.length !== 1 ? 's' : ''} asignada{groupFormData.saved_views.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsGroupDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit">
                    {editingGroup ? 'Actualizar' : 'Crear'} Grupo
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {groups.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      <CardDescription>
                        {group.description || 'Sin descripción'}
                      </CardDescription>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline">
                      {JSON.parse(group.saved_views).length} vista{JSON.parse(group.saved_views).length !== 1 ? 's' : ''}
                    </Badge>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditGroup(group)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteGroup(group.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>

        {groups.length === 0 && (
          <Alert>
            <Users className="h-4 w-4" />
            <AlertDescription>
              No hay grupos configurados. Crea grupos para organizar el acceso a las vistas guardadas.
            </AlertDescription>
          </Alert>
        )}
      </TabsContent>
    </Tabs>
  );
}