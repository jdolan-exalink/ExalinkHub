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
import { Plus, User, Users, Edit, Trash2, Shield, Eye, Settings, LayoutGrid } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import type { User as UserType, Group as GroupType } from '@/lib/config-database';

export default function UsersTab() {
  const [users, setUsers] = useState<UserType[]>([]);
  const [groups, setGroups] = useState<GroupType[]>([]);
  const [savedViews, setSavedViews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserType | null>(null);
  const [editingGroup, setEditingGroup] = useState<GroupType | null>(null);

    /**
   * Normaliza saved_views para asegurar que sea un array de strings
   * Maneja tanto strings JSON como arrays ya parseados por la API
   */
  const parse_saved_views = (saved_views: string | string[]): string[] => {
    // Si ya es un array, devolverlo directamente (formato esperado desde API)
    if (Array.isArray(saved_views)) {
      return saved_views;
    }
    
    // Si es string vacío, nulo o undefined, devolver array vacío
    if (!saved_views || (typeof saved_views === 'string' && saved_views.trim() === '')) {
      return [];
    }
    
    // Si es string, intentar parsear como JSON (compatibilidad)
    try {
      const parsed = JSON.parse(saved_views);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Error parsing saved_views as JSON:', saved_views, error);
      return [];
    }
  };
  
  const [userFormData, setUserFormData] = useState({
    username: '',
    password: '',
    role: 'viewer' as 'admin' | 'operator' | 'viewer',
    enabled: true,
    assignedGroups: [] as number[]  // IDs de grupos asignados
  });

  const [groupFormData, setGroupFormData] = useState({
    name: '',
    description: '',
    saved_views: [] as string[]
  });

  // Estado para contar vistas por usuario
  const [userViewsCounts, setUserViewsCounts] = useState<{ [userId: number]: number }>({});

  // Componente para mostrar grupos asignados al usuario
  const UserGroupsBadge = ({ userId }: { userId: number }) => {
    const [userGroups, setUserGroups] = useState<GroupType[]>([]);
    
    useEffect(() => {
      const loadUserGroups = async () => {
        try {
          const response = await fetch(`/api/config/users/${userId}/groups`);
          if (response.ok) {
            const data = await response.json();
            // Verificar que la respuesta sea un array
            if (Array.isArray(data)) {
              setUserGroups(data);
            } else if (data && Array.isArray(data.groups)) {
              // Si la respuesta está envuelta en un objeto con propiedad 'groups'
              setUserGroups(data.groups);
            } else {
              console.warn('La respuesta de grupos del usuario no es un array:', data);
              setUserGroups([]);
            }
          }
        } catch (error) {
          console.error('Error cargando grupos del usuario:', error);
          setUserGroups([]);
        }
      };
      
      loadUserGroups();
    }, [userId]);
    
    if (userGroups.length === 0) {
      return <Badge variant="outline" className="text-muted-foreground">Sin grupos</Badge>;
    }
    
    return (
      <Badge variant="outline" className="bg-orange-50 text-orange-700">
        {userGroups.length} grupo{userGroups.length !== 1 ? 's' : ''}
      </Badge>
    );
  };

  // Función para cargar conteos de vistas por usuario
  const loadUserViewsCounts = async () => {
    try {
      const counts: { [userId: number]: number } = {};
      
      await Promise.all(
        users.map(async (user) => {
          try {
            const response = await fetch(`/api/config/users/${user.id}/views`);
            if (response.ok) {
              const data = await response.json();
              counts[user.id] = data.count || 0;
            } else {
              counts[user.id] = 0;
            }
          } catch (error) {
            console.error(`Error cargando vistas para usuario ${user.id}:`, error);
            counts[user.id] = 0;
          }
        })
      );
      
      setUserViewsCounts(counts);
    } catch (error) {
      console.error('Error cargando conteos de vistas:', error);
    }
  };

  useEffect(() => {
    loadUsers();
    loadGroups();
    loadSavedViews();
  }, []);

  // Cargar conteos de vistas cuando los usuarios cambien
  useEffect(() => {
    if (users.length > 0) {
      loadUserViewsCounts();
    }
  }, [users]);

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

  /**
   * Carga las vistas guardadas disponibles
   */
  const loadSavedViews = async () => {
    try {
      const response = await fetch('/api/views');
      if (response.ok) {
        const views = await response.json();
        setSavedViews(Array.isArray(views) ? views : []);
      } else {
        console.error('Error cargando vistas guardadas: Response not ok');
        setSavedViews([]);
      }
    } catch (error) {
      console.error('Error cargando vistas guardadas:', error);
      setSavedViews([]);
    }
  };

  const resetUserForm = () => {
    setUserFormData({
      username: '',
      password: '',
      role: 'viewer',
      enabled: true,
      assignedGroups: []
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

  /**
   * Calcula cuántas vistas tiene disponibles un usuario basado en su rol y grupos asignados
   */
  const get_user_available_views_count = (user: UserType): number => {
    // Usar el conteo cargado desde la API
    return userViewsCounts[user.id] ?? 0;
  };

  /**
   * Maneja la selección/deselección de vistas guardadas para el grupo
   */
  const handle_view_selection = (viewId: string, isSelected: boolean) => {
    setGroupFormData(prev => ({
      ...prev,
      saved_views: isSelected 
        ? [...prev.saved_views, viewId]
        : prev.saved_views.filter(id => id !== viewId)
    }));
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
        const userData = await response.json();
        const userId = userData.id || editingUser?.id;
        
        // Asignar grupos al usuario si no es admin
        if (userFormData.role !== 'admin' && userId) {
          try {
            const groupResponse = await fetch(`/api/config/users/${userId}/groups`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ groupIds: userFormData.assignedGroups }),
            });
            
            if (!groupResponse.ok) {
              console.error('Error al asignar grupos al usuario');
            }
          } catch (groupError) {
            console.error('Error al asignar grupos:', groupError);
          }
        }
        
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
    
    console.log('� === GROUP SUBMIT DEBUG ===');
    console.log('📝 1. Event triggered');
    console.log('📝 2. Current groupFormData state:', JSON.stringify(groupFormData, null, 2));
    console.log('📝 3. EditingGroup:', editingGroup?.name);
    console.log('📝 4. saved_views length:', groupFormData.saved_views.length);
    console.log('📝 5. saved_views content:', groupFormData.saved_views);
    
    try {
      const url = editingGroup 
        ? `/api/config/groups/${editingGroup.id}`
        : '/api/config/groups';
      
      const method = editingGroup ? 'PUT' : 'POST';
      
      const submitData = {
        name: groupFormData.name,
        description: groupFormData.description,
        saved_views: groupFormData.saved_views
      };
      
      console.log('📝 6. Final submit data:', JSON.stringify(submitData, null, 2));
      console.log('📝 7. API URL:', url);
      console.log('📝 8. Method:', method);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      console.log('📝 9. Response status:', response.status);
      console.log('📝 10. Response ok:', response.ok);

      if (response.ok) {
        const responseData = await response.json();
        console.log('📝 11. Response data:', responseData);
        
        await loadGroups();
        setIsGroupDialogOpen(false);
        resetGroupForm();
      } else {
        const error = await response.json();
        console.error('📝 Error response:', error);
        alert(error.error || 'Error al guardar grupo');
      }
    } catch (error) {
      console.error('📝 Fetch error:', error);
      alert('Error al guardar grupo');
    }
  };

  const handleEditUser = async (user: UserType) => {
    try {
      // Cargar grupos asignados al usuario
      const response = await fetch(`/api/config/users/${user.id}/groups`);
      let assignedGroupIds: number[] = [];
      
      if (response.ok) {
        const data = await response.json();
        // Verificar que la respuesta sea un array
        if (Array.isArray(data)) {
          assignedGroupIds = data.map((group: GroupType) => group.id);
        } else if (data && Array.isArray(data.groups)) {
          // Si la respuesta está envuelta en un objeto con propiedad 'groups'
          assignedGroupIds = data.groups.map((group: GroupType) => group.id);
        } else {
          console.warn('La respuesta de grupos del usuario no es un array:', data);
        }
      } else {
        console.error('Error en la respuesta de grupos del usuario:', response.status);
      }
      
      setUserFormData({
        username: user.username,
        password: '', // No mostramos la password actual
        role: user.role,
        enabled: user.enabled,
        assignedGroups: assignedGroupIds
      });
      setEditingUser(user);
      setIsUserDialogOpen(true);
    } catch (error) {
      console.error('Error cargando grupos del usuario:', error);
      setUserFormData({
        username: user.username,
        password: '', // No mostramos la password actual
        role: user.role,
        enabled: user.enabled,
        assignedGroups: []
      });
      setEditingUser(user);
      setIsUserDialogOpen(true);
    }
  };

  const handleEditGroup = (group: GroupType) => {
    console.log('� === EDITING GROUP DEBUG ===');
    console.log('📝 Original group object:', JSON.stringify(group, null, 2));
    console.log('📝 Group saved_views (raw string):', group.saved_views);
    console.log('📝 Type of saved_views:', typeof group.saved_views);
    
    const parsedViews = parse_saved_views(group.saved_views);
    console.log('📝 Parsed views result:', parsedViews);
    console.log('📝 Parsed views length:', parsedViews.length);
    
    const newFormData = {
      name: group.name,
      description: group.description || '',
      saved_views: parsedViews
    };
    
    console.log('📝 Setting form data to:', JSON.stringify(newFormData, null, 2));
    console.log('📝 Available saved views:', savedViews);
    
    setGroupFormData(newFormData);
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

                  {userFormData.role !== 'admin' && (
                    <div className="grid grid-cols-4 items-start gap-4">
                      <Label className="text-right pt-2">Grupos</Label>
                      <div className="col-span-3">
                        <p className="text-sm text-muted-foreground mb-3">
                          Selecciona los grupos que determinan las vistas disponibles para este usuario.
                        </p>
                        
                        {groups.length > 0 ? (
                          <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-3">
                            {groups.map((group) => (
                              <div key={group.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`user-group-${group.id}`}
                                  checked={userFormData.assignedGroups.includes(group.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setUserFormData(prev => ({
                                        ...prev,
                                        assignedGroups: [...prev.assignedGroups, group.id]
                                      }));
                                    } else {
                                      setUserFormData(prev => ({
                                        ...prev,
                                        assignedGroups: prev.assignedGroups.filter(id => id !== group.id)
                                      }));
                                    }
                                  }}
                                />
                                <Label 
                                  htmlFor={`user-group-${group.id}`} 
                                  className="text-sm font-normal cursor-pointer flex-1"
                                >
                                  {group.name}
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({parse_saved_views(group.saved_views).length} vistas)
                                  </span>
                                </Label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/20">
                            No hay grupos disponibles.
                          </div>
                        )}
                        
                        <div className="mt-2">
                          <Badge variant="outline">
                            {userFormData.assignedGroups.length} grupo{userFormData.assignedGroups.length !== 1 ? 's' : ''} seleccionado{userFormData.assignedGroups.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  )}
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
          {users.map((user) => {
            // Colores basados en el rol del usuario
            const getRoleColors = (role: string) => {
              switch (role) {
                case 'admin':
                  return {
                    bg: 'bg-red-100',
                    icon: 'text-red-600',
                    border: 'border-red-200'
                  };
                case 'operator':
                  return {
                    bg: 'bg-blue-100',
                    icon: 'text-blue-600',
                    border: 'border-blue-200'
                  };
                case 'viewer':
                  return {
                    bg: 'bg-green-100',
                    icon: 'text-green-600',
                    border: 'border-green-200'
                  };
                default:
                  return {
                    bg: 'bg-gray-100',
                    icon: 'text-gray-600',
                    border: 'border-gray-200'
                  };
              }
            };
            
            const roleColors = getRoleColors(user.role);
            
            return (
              <Card key={user.id} className={`${!user.enabled ? 'opacity-60' : ''} ${roleColors.border}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${roleColors.bg}`}>
                        <User className={`h-5 w-5 ${roleColors.icon}`} />
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
                      
                      <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                        {get_user_available_views_count(user)} vista{get_user_available_views_count(user) !== 1 ? 's' : ''}
                      </Badge>
                      
                      {user.role !== 'admin' && (
                        <UserGroupsBadge userId={user.id} />
                      )}
                      
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
            );
          })}
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
                      <p className="text-sm text-muted-foreground mb-3">
                        Selecciona las vistas guardadas que estarán disponibles para este grupo.
                      </p>
                      
                      {savedViews.length > 0 ? (
                        <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-3">
                          {savedViews.map((view) => {
                            const isChecked = groupFormData.saved_views.includes(view.id.toString());
                            
                            return (
                              <div key={view.id} className="flex items-center space-x-2">
                                <Checkbox
                                  id={`view-${view.id}`}
                                  checked={isChecked}
                                  onCheckedChange={(checked) => 
                                    handle_view_selection(view.id.toString(), !!checked)
                                  }
                                />
                                <Label 
                                  htmlFor={`view-${view.id}`} 
                                  className="text-sm font-normal cursor-pointer flex-1"
                                >
                                  {view.name}
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({view.layout})
                                  </span>
                                </Label>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground p-3 border rounded-md bg-muted/20">
                          No hay vistas guardadas disponibles. Crea vistas desde el panel de Vivo.
                        </div>
                      )}
                      
                      <div className="mt-2">
                        <Badge variant="outline">
                          {groupFormData.saved_views.length} vista{groupFormData.saved_views.length !== 1 ? 's' : ''} seleccionada{groupFormData.saved_views.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
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
          {groups.map((group) => {
            const predefinedGroups = ['admins', 'usuarios', 'viewers'];
            const isPredefined = predefinedGroups.includes(group.name);
            
            return (
              <Card key={group.id} className={isPredefined ? "border-blue-200" : "border-orange-200"}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg ${
                        isPredefined ? 'bg-blue-100' : 'bg-orange-100'
                      }`}>
                        {isPredefined ? (
                          <Shield className="h-5 w-5 text-blue-600" />
                        ) : (
                          <LayoutGrid className="h-5 w-5 text-orange-600" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                        <CardDescription>
                          {group.description || 'Sin descripción'}
                        </CardDescription>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant="outline"
                        className={isPredefined ? "text-blue-600 border-blue-600" : "text-orange-600 border-orange-600"}
                      >
                        {parse_saved_views(group.saved_views).length} vista{parse_saved_views(group.saved_views).length !== 1 ? 's' : ''}
                      </Badge>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditGroup(group)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      
                      {!isPredefined && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteGroup(group.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
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