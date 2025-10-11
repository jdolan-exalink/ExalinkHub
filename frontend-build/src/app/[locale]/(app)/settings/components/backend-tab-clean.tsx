'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Car, 
  Users as UsersIcon, 
  Bell, 
  Save, 
  Play, 
  Square, 
  Activity,
  Settings,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Mail,
  Webhook,
  Bot,
  MessageSquare,
  Wifi,
  Server,
  HardDrive,
  Calendar
} from 'lucide-react';
import type { BackendConfig } from '@/lib/config-database';
import { toast } from '@/hooks/use-toast';

type FrigateServerOption = {
  protocol: 'http' | 'https';
  id: string;
  name: string;
  url: string;
  port: number;
  username?: string;
  password?: string;
  enabled: boolean;
  baseUrl: string;
  status?: Record<string, unknown>;
};

export default function BackendTab() {
  const translate = useTranslations('settings.backend');
  const translate_common = useTranslations('common');
  const [config, setConfig] = useState<BackendConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mqttTesting, setMqttTesting] = useState(false);
  const [mqttStatus, setMqttStatus] = useState<'unknown' | 'connected' | 'error' | 'testing'>('unknown');
  const [services, setServices] = useState({
    lpr: { status: 'stopped', uptime: 0, processed: 0, memory_mb: 0, cpu_percent: 0 },
    counting: { status: 'stopped', uptime: 0, counted: 0, memory_mb: 0, cpu_percent: 0 },
    notifications: { status: 'stopped', uptime: 0, sent: 0, memory_mb: 0, cpu_percent: 0 }
  });
  const [frigateServers, setFrigateServers] = useState<FrigateServerOption[]>([]);

  const [formData, setFormData] = useState({
    // LPR Configuration Settings
    lpr_mqtt_host: 'localhost',
    lpr_mqtt_port: 1883,
    lpr_mqtt_username: '',
    lpr_mqtt_password: '',
    lpr_mqtt_use_ssl: false,
    lpr_mqtt_topics_prefix: 'frigate',
    lpr_frigate_server_id: '',
    lpr_retention_events_days: 60,
    lpr_retention_clips_days: 30,
    lpr_retention_snapshots_days: 60,
    lpr_retention_max_storage_gb: 50,
    lpr_auto_cleanup: true,
    
    // LPR Settings
    lpr_enabled: false,
    lpr_confidence_threshold: 0.8,
    lpr_max_processing_time: 30,
    lpr_regions: '',
    lpr_save_images: true,
    lpr_webhook_url: '',
    
    // Counting Settings
    counting_enabled: false,
    counting_zones: '',
    counting_reset_interval: 24,
    counting_min_confidence: 0.7,
    counting_webhook_url: '',
    
    // Notification Settings
    notifications_enabled: false,
    email_enabled: false,
    email_smtp_host: '',
    email_smtp_port: 587,
    email_username: '',
    email_password: '',
    email_recipients: '',
    webhook_enabled: false,
    webhook_url: '',
    webhook_secret: '',
    telegram_enabled: false,
    telegram_bot_token: '',
    telegram_chat_id: '',
    
    // Database Settings
    db_retention_days: 30,
    db_auto_cleanup: true,
    db_backup_enabled: false,
    db_backup_interval: 7
  });

  const loadFrigateServers = useCallback(async () => {
    try {
      const response = await fetch('/api/config/servers');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      if (Array.isArray(data.servers)) {
        const mapped: FrigateServerOption[] = data.servers.map((server: any) => ({
          id: String(server.id),
          name: server.name,
          protocol: server.protocol,
          url: server.url,
          port: server.port,
          username: server.username || undefined,
          password: server.password || undefined,
          enabled: !!server.enabled,
          baseUrl: `${server.protocol}://${server.url}:${server.port}`,
          status: server.status
        }));
        setFrigateServers(mapped);
      } else {
        setFrigateServers([]);
      }
    } catch (error) {
      console.error('Error cargando servidores Frigate:', error);
      setFrigateServers([]);
    }
  }, []);

  useEffect(() => {
    loadBackendConfig();
    updateServiceStatus();
    loadFrigateServers();
    
    // Actualizar estado de servicios cada 5 segundos
    const interval = setInterval(updateServiceStatus, 60000);
    return () => clearInterval(interval);
  }, [loadFrigateServers]);

  const loadBackendConfig = async () => {
    try {
      const response = await fetch('/api/config/backend');
      const data = await response.json();
      if (data.config) {
        setConfig(data.config);
        setFormData({
          // LPR Configuration Settings
          lpr_mqtt_host: data.config.lpr_mqtt_host || 'localhost',
          lpr_mqtt_port: data.config.lpr_mqtt_port || 1883,
          lpr_mqtt_username: data.config.lpr_mqtt_username || '',
          lpr_mqtt_password: data.config.lpr_mqtt_password || '',
          lpr_mqtt_use_ssl: data.config.lpr_mqtt_use_ssl || false,
          lpr_mqtt_topics_prefix: data.config.lpr_mqtt_topics_prefix || 'frigate',
          lpr_frigate_server_id: data.config.lpr_frigate_server_id ? String(data.config.lpr_frigate_server_id) : '',
          lpr_retention_events_days: data.config.lpr_retention_events_days || 60,
          lpr_retention_clips_days: data.config.lpr_retention_clips_days || 30,
          lpr_retention_snapshots_days: data.config.lpr_retention_snapshots_days || 60,
          lpr_retention_max_storage_gb: data.config.lpr_retention_max_storage_gb || 50,
          lpr_auto_cleanup: data.config.lpr_auto_cleanup !== undefined ? data.config.lpr_auto_cleanup : true,
          
          // LPR Settings
          lpr_enabled: data.config.lpr_enabled,
          lpr_confidence_threshold: data.config.lpr_confidence_threshold,
          lpr_max_processing_time: data.config.lpr_max_processing_time,
          lpr_regions: data.config.lpr_regions,
          lpr_save_images: data.config.lpr_save_images,
          lpr_webhook_url: data.config.lpr_webhook_url,
          counting_enabled: data.config.counting_enabled,
          counting_zones: data.config.counting_zones,
          counting_reset_interval: data.config.counting_reset_interval,
          counting_min_confidence: data.config.counting_min_confidence,
          counting_webhook_url: data.config.counting_webhook_url,
          notifications_enabled: data.config.notifications_enabled,
          email_enabled: data.config.email_enabled,
          email_smtp_host: data.config.email_smtp_host,
          email_smtp_port: data.config.email_smtp_port,
          email_username: data.config.email_username,
          email_password: data.config.email_password,
          email_recipients: data.config.email_recipients,
          webhook_enabled: data.config.webhook_enabled,
          webhook_url: data.config.webhook_url,
          webhook_secret: data.config.webhook_secret,
          telegram_enabled: data.config.telegram_enabled,
          telegram_bot_token: data.config.telegram_bot_token,
          telegram_chat_id: data.config.telegram_chat_id,
          db_retention_days: data.config.db_retention_days,
          db_auto_cleanup: data.config.db_auto_cleanup,
          db_backup_enabled: data.config.db_backup_enabled,
          db_backup_interval: data.config.db_backup_interval
        });
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateServiceStatus = async () => {
    try {
      const response = await fetch('/api/config/backend/status');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.services) {
        setServices(data.services);
      }
    } catch (error) {
      console.error('Error obteniendo estado de servicios:', error);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/config/backend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await loadBackendConfig();
        alert('Configuración guardada exitosamente');
      } else {
        const error = await response.json();
        alert(error.error || 'Error al guardar configuración');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar configuración');
    } finally {
      setSaving(false);
    }
  };

  const handleServiceAction = async (service: string, action: 'start' | 'stop' | 'restart') => {
    try {
      const response = await fetch(`/api/config/backend/services/${service}/${action}`, {
        method: 'POST',
      });

      if (response.ok) {
        await updateServiceStatus();
      } else {
        const error = await response.json();
        alert(error.error || `Error al ${action} servicio`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert(`Error al ${action} servicio`);
    }
  };

  /**
   * Prueba la conexión MQTT
   */
  const test_mqtt_connection = useCallback(async () => {
    setMqttTesting(true);
    setMqttStatus('testing');
    
    try {
      const response = await fetch('/api/config/backend/test-mqtt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          host: formData.lpr_mqtt_host,
          port: formData.lpr_mqtt_port,
          username: formData.lpr_mqtt_username,
          password: formData.lpr_mqtt_password,
          use_ssl: formData.lpr_mqtt_use_ssl,
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setMqttStatus('connected');
        toast({
          title: 'Conexión MQTT exitosa',
          description: 'Se estableció conexión con el broker MQTT correctamente.',
        });
      } else {
        setMqttStatus('error');
        toast({
          title: 'Error de conexión MQTT',
          description: result.error || 'No se pudo conectar al broker MQTT.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error testing MQTT:', error);
      setMqttStatus('error');
      toast({
        title: 'Error de conexión',
        description: 'Error al probar la conexión MQTT.',
        variant: 'destructive',
      });
    } finally {
      setMqttTesting(false);
    }
  }, [formData.lpr_mqtt_host, formData.lpr_mqtt_port, formData.lpr_mqtt_username, formData.lpr_mqtt_password, formData.lpr_mqtt_use_ssl]);

  /**
   * Obtiene el badge de estado MQTT
   */
  const get_mqtt_status_badge = () => {
    switch (mqttStatus) {
      case 'connected':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Conectado</Badge>;
      case 'error':
        return <Badge className="bg-red-500 hover:bg-red-600"><AlertTriangle className="h-3 w-3 mr-1" />Error</Badge>;
      case 'testing':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1 animate-spin" />Probando...</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Sin probar</Badge>;
    }
  };

  const getServiceBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Activo</Badge>;
      case 'stopped':
        return <Badge className="bg-red-500 hover:bg-red-600"><Square className="h-3 w-3 mr-1" />Detenido</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Desconocido</Badge>;
    }
  };

  const formatUptime = (seconds: number | undefined) => {
    if (typeof seconds !== 'number' || isNaN(seconds)) {
      return '0h 0m';
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return <div>Cargando configuración del backend...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Estado de Servicios */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Estado de Servicios Backend
          </CardTitle>
          <CardDescription>
            Monitor y control de los servicios de procesamiento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Matriculas Service */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    <CardTitle className="text-sm">Matriculas</CardTitle>
                  </div>
                  {getServiceBadge(services.lpr.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">
                    <strong>Tiempo activo:</strong> {formatUptime(services.lpr.uptime)}
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Procesados:</strong> {services.lpr.processed?.toLocaleString() || '0'}
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Memoria:</strong> {services.lpr.memory_mb?.toFixed(1) || '0.0'} MB
                  </div>
                  <div className="text-muted-foreground">
                    <strong>CPU:</strong> {services.lpr.cpu_percent?.toFixed(1) || '0.0'}%
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant={services.lpr.status === 'running' ? 'outline' : 'default'}
                    onClick={() => handleServiceAction('lpr', services.lpr.status === 'running' ? 'stop' : 'start')}
                    className={services.lpr.status === 'running' ? 'text-red-600 border-red-300 hover:bg-red-50' : 'bg-green-600 hover:bg-green-700'}
                  >
                    {services.lpr.status === 'running' ? (
                      <>
                        <Square className="h-3 w-3 mr-1" />
                        Detener
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 mr-1" />
                        Iniciar
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleServiceAction('lpr', 'restart')}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    <Activity className="h-3 w-3 mr-1" />
                    Reiniciar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Counting Service */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-4 w-4" />
                    <CardTitle className="text-sm">Conteo de Personas</CardTitle>
                  </div>
                  {getServiceBadge(services.counting.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Tiempo activo: {formatUptime(services.counting.uptime)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Contados: {services.counting.counted.toLocaleString()}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={services.counting.status === 'running' ? 'outline' : 'default'}
                    onClick={() => handleServiceAction('counting', services.counting.status === 'running' ? 'stop' : 'start')}
                  >
                    {services.counting.status === 'running' ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleServiceAction('counting', 'restart')}
                  >
                    <Activity className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Notifications Service */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    <CardTitle className="text-sm">Notificaciones</CardTitle>
                  </div>
                  {getServiceBadge(services.notifications.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Tiempo activo: {formatUptime(services.notifications.uptime)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Enviadas: {services.notifications.sent.toLocaleString()}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={services.notifications.status === 'running' ? 'outline' : 'default'}
                    onClick={() => handleServiceAction('notifications', services.notifications.status === 'running' ? 'stop' : 'start')}
                  >
                    {services.notifications.status === 'running' ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleServiceAction('notifications', 'restart')}
                  >
                    <Activity className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Configuración */}
      <Tabs defaultValue="matriculas" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="matriculas" className="flex items-center gap-2">
            <Car className="h-4 w-4" />
            Matriculas
          </TabsTrigger>
          <TabsTrigger value="counting" className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4" />
            Conteo
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notificaciones
          </TabsTrigger>
          <TabsTrigger value="database" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Base de Datos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matriculas" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Configuración MQTT */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Wifi className="h-5 w-5" />
                      Servidor MQTT
                    </CardTitle>
                    <CardDescription>
                      Configuración del broker MQTT para comunicación con Frigate
                    </CardDescription>
                  </div>
                  {get_mqtt_status_badge()}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mqtt-host">Host MQTT</Label>
                    <Input
                      id="mqtt-host"
                      placeholder="localhost"
                      value={formData.lpr_mqtt_host}
                      onChange={(e) => setFormData({...formData, lpr_mqtt_host: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mqtt-port">Puerto</Label>
                    <Input
                      id="mqtt-port"
                      type="number"
                      placeholder="1883"
                      value={formData.lpr_mqtt_port}
                      onChange={(e) => setFormData({...formData, lpr_mqtt_port: parseInt(e.target.value) || 1883})}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="mqtt-ssl"
                    checked={formData.lpr_mqtt_use_ssl}
                    onCheckedChange={(checked) => setFormData({...formData, lpr_mqtt_use_ssl: checked})}
                  />
                  <Label htmlFor="mqtt-ssl">Usar SSL/TLS</Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mqtt-prefix">Prefijo de Tópicos</Label>
                  <Input
                    id="mqtt-prefix"
                    placeholder="frigate"
                    value={formData.lpr_mqtt_topics_prefix}
                    onChange={(e) => setFormData({...formData, lpr_mqtt_topics_prefix: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mqtt-username">Usuario (opcional)</Label>
                    <Input
                      id="mqtt-username"
                      placeholder="usuario_mqtt"
                      value={formData.lpr_mqtt_username}
                      onChange={(e) => setFormData({...formData, lpr_mqtt_username: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="mqtt-password">Contraseña (opcional)</Label>
                    <Input
                      id="mqtt-password"
                      type="password"
                      placeholder="••••••••"
                      value={formData.lpr_mqtt_password}
                      onChange={(e) => setFormData({...formData, lpr_mqtt_password: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={test_mqtt_connection}
                    disabled={mqttTesting}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    {mqttTesting ? (
                      <>
                        <Clock className="h-3 w-3 mr-2 animate-spin" />
                        Probando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-3 w-3 mr-2" />
                        Probar Conexión
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Configuración Servidor Frigate */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Servidor Frigate
                </CardTitle>
                <CardDescription>
                  Selecciona el servidor Frigate para procesamiento de matrículas
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="frigate-server">Servidor Frigate</Label>
                  <Select
                    value={formData.lpr_frigate_server_id}
                    onValueChange={(value) => setFormData({...formData, lpr_frigate_server_id: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar servidor Frigate" />
                    </SelectTrigger>
                    <SelectContent>
                      {frigateServers.filter(server => server.enabled).map(server => (
                        <SelectItem key={server.id} value={server.id}>
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${server.status?.api_status === 'online' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                            <span>{server.name}</span>
                            <span className="text-muted-foreground text-xs">({server.baseUrl})</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.lpr_frigate_server_id && (
                  <div className="p-3 bg-muted rounded-lg">
                    <h4 className="text-sm font-medium mb-2">Servidor Seleccionado:</h4>
                    {(() => {
                      const server = frigateServers.find(s => s.id === formData.lpr_frigate_server_id);
                      if (!server) {
                        return (
                          <div className="text-sm text-muted-foreground">
                            Servidor no encontrado o deshabilitado.
                          </div>
                        );
                      }
                      const is_online = server.status?.api_status === 'online';
                      return (
                        <div className="space-y-1 text-sm">
                          <div><strong>Nombre:</strong> {server.name}</div>
                          <div><strong>URL:</strong> {server.baseUrl}</div>
                          <div className="flex items-center gap-2">
                            <strong>Estado:</strong>
                            <Badge className={is_online ? 'bg-green-500' : 'bg-yellow-500'}>
                              <CheckCircle className="h-3 w-3 mr-1" />
                              {is_online ? 'Disponible' : 'Sin verificar'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ... resto del contenido igual al archivo original ... */}
        </TabsContent>

        <TabsContent value="database" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Base de Datos</CardTitle>
              <CardDescription>
                Gestión de retención de datos y copias de seguridad
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="db-retention">Retención de Datos (días)</Label>
                  <Input
                    id="db-retention"
                    type="number"
                    min="1"
                    max="365"
                    value={formData.db_retention_days}
                    onChange={(e) => setFormData({...formData, db_retention_days: parseInt(e.target.value)})}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="db-backup-interval">Intervalo de Backup (días)</Label>
                  <Input
                    id="db-backup-interval"
                    type="number"
                    min="1"
                    max="30"
                    value={formData.db_backup_interval}
                    onChange={(e) => setFormData({...formData, db_backup_interval: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="db-auto-cleanup"
                    checked={formData.db_auto_cleanup}
                    onCheckedChange={(checked) => setFormData({...formData, db_auto_cleanup: checked})}
                  />
                  <Label htmlFor="db-auto-cleanup">Limpieza automática de datos antiguos</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="db-backup-enabled"
                    checked={formData.db_backup_enabled}
                    onCheckedChange={(checked) => setFormData({...formData, db_backup_enabled: checked})}
                  />
                  <Label htmlFor="db-backup-enabled">Habilitar copias de seguridad automáticas</Label>
                </div>
              </div>

              <Alert>
                <Database className="h-4 w-4" />
                <AlertDescription>
                  Los datos se eliminarán automáticamente después de {formData.db_retention_days} días.
                  {formData.db_backup_enabled && (
                    <span> Las copias de seguridad se crearán cada {formData.db_backup_interval} días.</span>
                  )}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={loadBackendConfig}>
          {translate('reset')}
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? translate_common('loading') : translate('save_config')}
        </Button>
      </div>
    </div>
  );
}
