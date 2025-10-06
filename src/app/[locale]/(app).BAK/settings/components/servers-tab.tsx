'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Plus, Server, TestTube2, Power, PowerOff, Edit, Trash2, Cpu, HardDrive, MemoryStick, Activity } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import type { Server as ServerType } from '@/lib/config-database';

interface ServerWithStatus extends ServerType {
  status: {
    cpu_usage: number;
    gpu_usage: number;
    memory_usage: number;
    disk_usage: number;
    api_status: 'online' | 'offline' | 'error';
    last_check: string;
  };
}

interface TestStep {
  step: string;
  status: 'pending' | 'success' | 'error';
  message: string;
  duration?: number;
  error?: string;
  details?: any;
}

export default function ServersTab() {
  const translate_servers = useTranslations('SettingsPage');
  const [servers, setServers] = useState<ServerWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<ServerWithStatus | null>(null);
  const [testingServer, setTestingServer] = useState<number | null>(null);
  const [testSteps, setTestSteps] = useState<TestStep[]>([]);
  
  const [formData, setFormData] = useState({
    name: '',
    url: '',
    port: '5000',
    protocol: 'http' as 'http' | 'https',
    auth_type: 'basic' as 'basic' | 'jwt' | 'none',
    username: '',
    password: '',
    jwt_token: '',
    jwt_expires_at: '',
    enabled: true
  });

  // Función para extraer métricas del mensaje de respuesta
  const extractMetricFromMessage = (message: string, metric: string): string => {
    const patterns = {
      'CPU': /CPU:\s*(\d+\.?\d*)%/i,
      'RAM': /RAM:\s*(\d+\.?\d*)%/i,
      'Disco': /Disco:\s*(\d+\.?\d*)%/i,
      'GPU': /GPU:\s*(\d+\.?\d*)%/i
    };
    
    const pattern = patterns[metric as keyof typeof patterns];
    if (pattern) {
      const match = message.match(pattern);
      return match ? `${match[1]}%` : 'N/A';
    }
    return 'N/A';
  };

  useEffect(() => {
    loadServers();
    
    // Configurar actualización automática cada 10 segundos
    const interval = setInterval(() => {
      updateServerMetrics();
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const loadServers = async () => {
    try {
      const response = await fetch('/api/config/servers');
      const data = await response.json();
      if (data.servers) {
        setServers(data.servers);
      }
    } catch (error) {
      console.error('Error cargando servidores:', error);
    } finally {
      setLoading(false);
    }
  };

  // Actualizar solo las métricas de los servidores
  const updateServerMetrics = async () => {
    try {
      const response = await fetch('/api/config/servers/metrics');
      const data = await response.json();
      if (data.servers) {
        setServers(prev => prev.map(server => {
          const updated = data.servers.find((s: ServerWithStatus) => s.id === server.id);
          return updated ? { ...server, status: updated.status } : server;
        }));
      }
    } catch (error) {
      console.error('Error actualizando métricas:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      url: '',
      port: '5000',
      protocol: 'http',
      auth_type: 'basic',
      username: '',
      password: '',
      jwt_token: '',
      jwt_expires_at: '',
      enabled: true
    });
    setEditingServer(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Parsear URL completa si se proporciona
      let finalFormData = { ...formData };
      
      // Verificar si la URL incluye protocolo y puerto
      if (formData.url.includes('://')) {
        try {
          const parsedUrl = new URL(formData.url);
          finalFormData.protocol = parsedUrl.protocol.slice(0, -1) as 'http' | 'https'; // Remover el ':'
          finalFormData.url = parsedUrl.hostname;
          finalFormData.port = parsedUrl.port || (parsedUrl.protocol === 'https:' ? '443' : '80');
        } catch (error) {
          alert('URL inválida. Usa formato: https://10.1.1.252:8971 o solo la IP/dominio');
          return;
        }
      }
      
      // Validación automática usando endpoint API  
      let submitData = { ...finalFormData };
      const baseUrl = `${finalFormData.protocol}://${finalFormData.url}:${finalFormData.port}`;
      
      try {
        console.log(`🔍 Validando servidor con autenticación automática: ${baseUrl}`);
        
        // Usar endpoint API para validación desde el servidor
        const response = await fetch('/api/validate-server', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            baseUrl,
            username: finalFormData.username || undefined,
            password: finalFormData.password || undefined
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const validationResult = await response.json();
          
        if (validationResult.success && validationResult.token) {
          // Calcular expiración (24 horas por defecto)
          const expiresAt = new Date(Date.now() + 86400000).toISOString();
          
          submitData = {
            ...finalFormData,
            jwt_token: validationResult.token,
            jwt_expires_at: expiresAt
          };
          console.log('✅ Validación y token JWT obtenidos exitosamente');
        } else if (!validationResult.success) {
          alert(`❌ Error de validación:\n\n${validationResult.error || validationResult.message}\n\nVerifica:\n• Que el servidor Frigate esté funcionando\n• Las credenciales sean correctas\n• El certificado SSL sea válido\n• El endpoint /api/login esté disponible`);
          return;
        }
      } catch (error) {
        console.error('Error en validación del servidor:', error);
        alert(`❌ Error de conexión:\n\n${error instanceof Error ? error.message : 'Error desconocido'}\n\nVerifica la conectividad de red y el estado del servidor.`);
        return;
      }
      
      const url = editingServer 
        ? `/api/config/servers/${editingServer.id}`
        : '/api/config/servers';
      
      const method = editingServer ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });

      if (response.ok) {
        const result = await response.json();
        if (submitData.jwt_token) {
          alert('✅ Servidor guardado con token JWT válido');
        }
        await loadServers();
        setIsAddDialogOpen(false);
        resetForm();
      } else {
        const error = await response.json();
        alert(error.error || 'Error al guardar servidor');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar servidor');
    }
  };

  const handleEdit = (server: ServerWithStatus) => {
    setFormData({
      name: server.name,
      url: server.url,
      port: server.port.toString(),
      protocol: server.protocol,
      auth_type: (server as any).auth_type || 'basic',
      username: server.username || '',
      password: server.password || '',
      jwt_token: (server as any).jwt_token || '',
      jwt_expires_at: (server as any).jwt_expires_at || '',
      enabled: server.enabled
    });
    setEditingServer(server);
    setIsAddDialogOpen(true);
  };

  const handleDelete = async (serverId: number) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este servidor?')) {
      return;
    }

    try {
      const response = await fetch(`/api/config/servers/${serverId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await loadServers();
      } else {
        const error = await response.json();
        alert(error.error || 'Error al eliminar servidor');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al eliminar servidor');
    }
  };

  const handleToggle = async (serverId: number) => {
    try {
      const response = await fetch(`/api/config/servers/${serverId}/toggle`, {
        method: 'POST',
      });

      if (response.ok) {
        await loadServers();
      } else {
        const error = await response.json();
        alert(error.error || 'Error al cambiar estado del servidor');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al cambiar estado del servidor');
    }
  };

  const handleTest = async (serverId: number) => {
    setTestingServer(serverId);
    setTestSteps([]);

    try {
      const response = await fetch(`/api/config/servers/${serverId}/test`, {
        method: 'POST',
      });

      if (response.ok) {
        const data = await response.json();
        setTestSteps(data.steps);
      } else {
        const error = await response.json();
        alert(error.error || 'Error al probar servidor');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al probar servidor');
    } finally {
      setTestingServer(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'online':
        return <Badge variant="default" className="bg-green-500">En línea</Badge>;
      case 'offline':
        return <Badge variant="secondary">Sin conexión</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Desconocido</Badge>;
    }
  };

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'success':
        return '🟢';
      case 'error':
        return '🔴';
      default:
        return '🔵';
    }
  };

  if (loading) {
    return <div>Cargando servidores...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium">Servidores Configurados</h3>
          <p className="text-sm text-muted-foreground">
            {servers.length} servidor{servers.length !== 1 ? 'es' : ''} configurado{servers.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Agregar Servidor
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>
                  {editingServer ? 'Editar Servidor' : 'Agregar Nuevo Servidor'}
                </DialogTitle>
                <DialogDescription>
                  Configura la conexión a tu servidor Frigate con autenticación opcional.
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-6 py-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Nombre del Servidor</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full"
                    placeholder="Ej: Servidor Principal, Cámaras Exteriores, etc."
                    required
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="protocol" className="text-sm font-medium">Protocolo de Conexión</Label>
                    <Select
                      value={formData.protocol}
                      onValueChange={(value: 'http' | 'https') => setFormData({
                        ...formData, 
                        protocol: value,
                        port: value === 'https' ? '8971' : '5000'
                      })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="http">HTTP (Puerto 5000)</SelectItem>
                        <SelectItem value="https">HTTPS (Puerto 8971)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="port" className="text-sm font-medium">Puerto</Label>
                    <Input
                      id="port"
                      type="number"
                      value={formData.port}
                      onChange={(e) => setFormData({...formData, port: e.target.value})}
                      className="w-full"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="url" className="text-sm font-medium">URL del Servidor</Label>
                  <Input
                    id="url"
                    value={formData.url}
                    onChange={(e) => setFormData({...formData, url: e.target.value})}
                    className="w-full"
                    placeholder="https://10.1.1.252:8971 o http://mi-servidor.local:5000"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Puedes ingresar la URL completa con protocolo y puerto, o solo la IP/dominio
                  </p>
                </div>
                
                {formData.protocol === 'https' && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-muted-foreground">Autenticación HTTPS</h4>
                      
                      <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
                        🔒 El sistema intentará primero sin autenticación. Si es necesario, usará JWT con cookies automáticamente.
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="username" className="text-sm font-medium">Usuario (opcional)</Label>
                          <Input
                            id="username"
                            value={formData.username}
                            onChange={(e) => setFormData({...formData, username: e.target.value})}
                            className="w-full"
                            placeholder="admin"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label htmlFor="password" className="text-sm font-medium">Contraseña (opcional)</Label>
                          <Input
                            id="password"
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                            className="w-full"
                            placeholder="••••••••"
                          />
                        </div>
                      </div>
                      
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-xs text-green-700">
                          ✅ <strong>Autenticación Inteligente:</strong> Se detecta automáticamente si se requiere autenticación y usa JWT con cookies
                        </p>
                      </div>
                    </div>
                  </>
                )}
                
                <Separator className="my-4" />
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Estado del Servidor</Label>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="enabled"
                      checked={formData.enabled}
                      onCheckedChange={(checked) => setFormData({...formData, enabled: !!checked})}
                    />
                    <Label htmlFor="enabled" className="text-sm">Servidor activo y disponible para conexiones</Label>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Los servidores inactivos no aparecerán en la lista de cámaras disponibles
                  </p>
                </div>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingServer ? 'Actualizar' : 'Crear'} Servidor
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {servers.map((server) => (
          <Card key={server.id} className={!server.enabled ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Server className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex items-center space-x-3">
                    <div>
                      <CardTitle className="text-lg">{server.name}</CardTitle>
                      <CardDescription>
                        {server.protocol}://{server.url}:{server.port}
                        {server.username && ' (Autenticado)'}
                      </CardDescription>
                    </div>
                    {getStatusBadge(server.status.api_status)}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTest(server.id)}
                    disabled={testingServer === server.id}
                  >
                    <TestTube2 className="h-4 w-4 mr-1" />
                    {testingServer === server.id ? 'Probando...' : 'Test'}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggle(server.id)}
                  >
                    {server.enabled ? (
                      <PowerOff className="h-4 w-4 mr-1" />
                    ) : (
                      <Power className="h-4 w-4 mr-1" />
                    )}
                    {server.enabled ? 'Desactivar' : 'Activar'}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(server)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(server.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {server.status.api_status === 'online' && (
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Cpu className="h-4 w-4 text-blue-500" />
                      <span className="text-sm font-medium">CPU</span>
                    </div>
                    <Progress value={server.status.cpu_usage} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {server.status.cpu_usage.toFixed(1)}%
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <MemoryStick className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">RAM</span>
                    </div>
                    <Progress value={server.status.memory_usage} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {server.status.memory_usage.toFixed(1)}%
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <HardDrive className="h-4 w-4 text-orange-500" />
                      <span className="text-sm font-medium">Disco</span>
                    </div>
                    <Progress value={server.status.disk_usage} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {server.status.disk_usage.toFixed(1)}%
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Activity className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium">GPU</span>
                    </div>
                    <Progress value={server.status.gpu_usage} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {server.status.gpu_usage.toFixed(1)}%
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Activity className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium">Estado</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Última verificación: {new Date(server.status.last_check).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Test Results Modal */}
      {testSteps.length > 0 && (
        <Dialog open={testSteps.length > 0} onOpenChange={() => setTestSteps([])}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <TestTube2 className="h-5 w-5" />
                Diagnóstico de Conexión del Servidor
              </DialogTitle>
              <DialogDescription>
                Pruebas detalladas de conectividad y rendimiento del servidor Frigate.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {testSteps.map((step, index) => {
                const isSystemMetrics = step.step === 'Estado del Sistema';
                const isConnectivity = step.step === 'Conectividad de Red';
                const isAuth = step.step === 'Autenticación';
                
                return (
                  <div key={index} className={`p-4 rounded-lg border-2 transition-all duration-200 ${
                    step.status === 'success' ? 'bg-emerald-50 border-emerald-300 hover:bg-emerald-100' :
                    step.status === 'error' ? 'bg-red-50 border-red-300 hover:bg-red-100' :
                    'bg-blue-50 border-blue-300 animate-pulse'
                  }`}>
                    <div className="flex items-start space-x-3">
                      <span className={`text-xl ${
                        step.status === 'success' ? 'text-emerald-600' :
                        step.status === 'error' ? 'text-red-600' :
                        'text-blue-600'
                      }`}>
                        {getStepIcon(step.status)}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className={`font-semibold text-sm ${
                            step.status === 'success' ? 'text-emerald-800' :
                            step.status === 'error' ? 'text-red-800' :
                            'text-blue-800'
                          }`}>
                            {step.step}
                          </h4>
                          {step.duration && (
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                              step.status === 'success' ? 'bg-emerald-200 text-emerald-700' :
                              step.status === 'error' ? 'bg-red-200 text-red-700' :
                              'bg-blue-200 text-blue-700'
                            }`}>
                              {step.duration}ms
                            </span>
                          )}
                        </div>
                        
                        {/* Mensaje principal */}
                        <p className={`text-sm mb-3 font-medium ${
                          step.status === 'success' ? 'text-emerald-700' :
                          step.status === 'error' ? 'text-red-700' :
                          'text-blue-700'
                        }`}>
                          {step.message}
                        </p>
                        
                        {/* Error detallado */}
                        {step.status === 'error' && step.error && (
                          <div className="bg-red-100 border border-red-200 rounded-md p-3 mb-3">
                            <p className="text-sm text-red-800 font-medium mb-2">📋 Error Detallado:</p>
                            <p className="text-sm text-red-700 font-mono bg-red-50 p-2 rounded border">
                              {step.error}
                            </p>
                            {step.details && (
                              <details className="mt-2">
                                <summary className="text-xs text-red-600 cursor-pointer hover:text-red-800">
                                  📊 Información Técnica
                                </summary>
                                <pre className="text-xs text-red-600 mt-2 bg-red-50 p-2 rounded border overflow-x-auto">
                                  {JSON.stringify(step.details, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                        )}
                        
                        {/* Información adicional para conectividad exitosa */}
                        {isConnectivity && step.status === 'success' && step.details && (
                          <div className="bg-emerald-100 border border-emerald-200 rounded-md p-3 mb-3">
                            <p className="text-sm text-emerald-800 font-medium mb-2">🔍 Información del Servidor:</p>
                            {step.details.version && (
                              <p className="text-sm text-emerald-700">
                                <span className="font-medium">Versión:</span> {step.details.version.version || 'No disponible'}
                              </p>
                            )}
                            <p className="text-sm text-emerald-700">
                              <span className="font-medium">Tiempo de respuesta:</span> {step.details.responseTime}ms
                            </p>
                          </div>
                        )}
                        
                        {/* Métricas del sistema si están disponibles */}
                        {isSystemMetrics && step.status === 'success' && (
                          <div className="space-y-3 mt-4">
                            <h5 className="text-sm font-medium text-gray-700">Recursos del Servidor</h5>
                            <div className="grid grid-cols-2 gap-4">
                              {/* CPU Usage */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Cpu className="h-4 w-4 text-blue-500" />
                                    <span className="text-sm font-medium">CPU</span>
                                  </div>
                                  <span className="text-sm text-muted-foreground">
                                    {extractMetricFromMessage(step.message, 'CPU')}
                                  </span>
                                </div>
                                <Progress 
                                  value={parseFloat(extractMetricFromMessage(step.message, 'CPU')) || 0} 
                                  className="h-2"
                                />
                              </div>
                              
                              {/* Memory Usage */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <MemoryStick className="h-4 w-4 text-green-500" />
                                    <span className="text-sm font-medium">RAM</span>
                                  </div>
                                  <span className="text-sm text-muted-foreground">
                                    {extractMetricFromMessage(step.message, 'RAM')}
                                  </span>
                                </div>
                                <Progress 
                                  value={parseFloat(extractMetricFromMessage(step.message, 'RAM')) || 0} 
                                  className="h-2"
                                />
                              </div>
                              
                              {/* Disk Usage */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <HardDrive className="h-4 w-4 text-orange-500" />
                                    <span className="text-sm font-medium">Disco</span>
                                  </div>
                                  <span className="text-sm text-muted-foreground">
                                    {extractMetricFromMessage(step.message, 'Disco') || 'N/A'}
                                  </span>
                                </div>
                                <Progress 
                                  value={parseFloat(extractMetricFromMessage(step.message, 'Disco')) || 0} 
                                  className="h-2"
                                />
                              </div>
                              
                              {/* GPU Usage */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-red-500" />
                                    <span className="text-sm font-medium">GPU</span>
                                  </div>
                                  <span className="text-sm text-muted-foreground">
                                    {extractMetricFromMessage(step.message, 'GPU') || 'N/A'}
                                  </span>
                                </div>
                                <Progress 
                                  value={parseFloat(extractMetricFromMessage(step.message, 'GPU')) || 0} 
                                  className="h-2"
                                />
                              </div>
                              
                              {/* API Status */}
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Activity className="h-4 w-4 text-purple-500" />
                                    <span className="text-sm font-medium">API</span>
                                  </div>
                                  <Badge variant="outline" className="text-green-600 border-green-600">
                                    {translate_servers('status_online')}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            <DialogFooter>
              <Button onClick={() => setTestSteps([])} className="w-full">
                Cerrar Diagnóstico
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {servers.length === 0 && (
        <Alert>
          <Server className="h-4 w-4" />
          <AlertDescription>
            No hay servidores configurados. Agrega tu primer servidor Frigate para comenzar.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

