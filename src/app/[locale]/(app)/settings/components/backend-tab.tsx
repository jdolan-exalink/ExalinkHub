'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  CreditCard, 
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
  Calendar,
  FileText,
  Eye
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { BackendConfig } from '@/lib/config-database';
import { FRIGATE_SERVERS, type FrigateServer } from '@/lib/frigate-servers';
import { toast } from '@/hooks/use-toast';
import { CountingConfig } from '@/components/counting/counting-config';

export default function BackendTab() {
  // const translate = useTranslations('settings.backend');
  // const translate_common = useTranslations('common');
  const [config, setConfig] = useState<BackendConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mqttTesting, setMqttTesting] = useState(false);
  const [mqttStatus, setMqttStatus] = useState<'unknown' | 'connected' | 'error' | 'testing'>('unknown');
  const [frigateTesting, setFrigateTesting] = useState(false);
  const [frigateStatus, setFrigateStatus] = useState<'unknown' | 'connected' | 'error' | 'testing'>('unknown');
  const [services, setServices] = useState<Record<string, any>>({
    'LPR (Matrículas)': { status: 'stopped', uptime: 0, processed: 0, memory_mb: 0, cpu_percent: 0, enabled: false },
    'Conteo': { status: 'stopped', uptime: 0, processed: 0, memory_mb: 0, cpu_percent: 0, enabled: false },
    'Notificaciones': { status: 'stopped', uptime: 0, sent: 0, memory_mb: 0, cpu_percent: 0, enabled: false }
  });
  const [logsModal, setLogsModal] = useState<{
    open: boolean;
    service: string;
    serviceSlug: string;
    logs: string;
    loading: boolean;
  }>({
    open: false,
    service: '',
    serviceSlug: '',
    logs: '',
    loading: false
  });

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
    
    // Counting Settings - Configuración según especificaciones técnicas
    counting_enabled: false,
    counting_mode: 'agregado', // 'agregado' | 'dividido'
    counting_title: 'Sistema de Conteo',
    counting_cameras: '', // Lista de cámaras separadas por coma
    counting_objects: '', // Lista de objetos separados por coma
    counting_confidence_threshold: 0.7,
    counting_retention_days: 30,
    counting_aggregation_interval: 60, // minutos
    counting_notifications_enabled: false,
    counting_notification_email: '',
    counting_config_json: '{}',
    
    // Legacy counting fields (mantenidos para compatibilidad)
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

  useEffect(() => {
    loadBackendConfig();
    updateServiceStatus();
    
    // Actualizar estado de servicios cada 30 segundos (reducido de 5 para evitar sobrecarga)
    const interval = setInterval(updateServiceStatus, 60000);
    return () => clearInterval(interval);
  }, []);

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
          lpr_frigate_server_id: data.config.lpr_frigate_server_id || '',
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
          
          // Counting Settings - Nuevos campos según especificaciones
          counting_enabled: data.config.counting_enabled || false,
          counting_mode: data.config.counting_mode || 'agregado',
          counting_title: data.config.counting_title || 'Sistema de Conteo',
          counting_cameras: data.config.counting_cameras || '',
          counting_objects: data.config.counting_objects || '',
          counting_confidence_threshold: data.config.counting_confidence_threshold || 0.7,
          counting_retention_days: data.config.counting_retention_days || 30,
          counting_aggregation_interval: data.config.counting_aggregation_interval || 60,
          counting_notifications_enabled: data.config.counting_notifications_enabled || false,
          counting_notification_email: data.config.counting_notification_email || '',
          counting_config_json: data.config.counting_config_json || '{}',
          
          // Legacy counting fields
          counting_zones: data.config.counting_zones || '',
          counting_reset_interval: data.config.counting_reset_interval || 24,
          counting_min_confidence: data.config.counting_min_confidence || 0.7,
          counting_webhook_url: data.config.counting_webhook_url || '',
          
          // Notification Settings
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
    // Normalizar nombre mostrado a slug backend
    const service_slug = service === 'Conteo' ? 'counting' : service;
    try {
      const response = await fetch(`/api/config/backend/services/${service_slug}/${action}`, {
        method: 'POST',
      });

      if (response.ok) {
        await updateServiceStatus();
      } else {
        const error = await response.json();
        alert(error.error || `Error al ${action} servicio ${service}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert(`Error al ${action} servicio ${service}`);
    }
  };

  const handleViewLogs = async (service: string) => {
    const serviceSlug = service === 'Conteo' ? 'counting' : service.toLowerCase();
    
    setLogsModal({
      open: true,
      service,
      serviceSlug,
      logs: '',
      loading: true
    });

    try {
      const response = await fetch(`/api/config/backend/services/${serviceSlug}/logs?lines=100`);
      
      if (response.ok) {
        const data = await response.json();
        setLogsModal(prev => ({
          ...prev,
          logs: data.logs || 'No se encontraron logs',
          loading: false
        }));
      } else {
        const error = await response.json();
        setLogsModal(prev => ({
          ...prev,
          logs: `Error al obtener logs: ${error.error || 'Error desconocido'}`,
          loading: false
        }));
      }
    } catch (error) {
      console.error('Error obteniendo logs:', error);
      setLogsModal(prev => ({
        ...prev,
        logs: 'Error al conectar con el servidor',
        loading: false
      }));
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
   * Prueba la conexión con Frigate
   */
  const test_frigate_connection = useCallback(async () => {
    if (!formData.lpr_frigate_server_id) {
      toast({
        title: 'Error de configuración',
        description: 'Selecciona un servidor Frigate antes de probar la conexión.',
        variant: 'destructive',
      });
      return;
    }

    setFrigateTesting(true);
    setFrigateStatus('testing');
    
    try {
      const response = await fetch('/api/config/backend/test-frigate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          frigate_server_id: formData.lpr_frigate_server_id
        }),
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setFrigateStatus('connected');
        toast({
          title: 'Conexión con Frigate exitosa',
          description: `Conectado a ${result.server_info?.name || 'Frigate'} correctamente.`,
        });
      } else {
        setFrigateStatus('error');
        toast({
          title: 'Error de conexión con Frigate',
          description: result.error || 'No se pudo conectar al servidor Frigate.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error testing Frigate:', error);
      setFrigateStatus('error');
      toast({
        title: 'Error de conexión',
        description: 'Error al probar la conexión con Frigate.',
        variant: 'destructive',
      });
    } finally {
      setFrigateTesting(false);
    }
  }, [formData.lpr_frigate_server_id]);

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

  /**
   * Obtiene el badge de estado Frigate
   */
  const get_frigate_status_badge = () => {
    switch (frigateStatus) {
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
                    <CreditCard className="h-4 w-4" />
                    <CardTitle className="text-sm flex items-center">
                      Matriculas
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewLogs('LPR (Matrículas)')}
                        className="ml-2 h-[28px] text-purple-600 border-purple-300 hover:bg-purple-50"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Ver Logs
                      </Button>
                    </CardTitle>
                  </div>
                  {getServiceBadge(services['LPR (Matrículas)']?.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">
                    <strong>Tiempo activo:</strong> {formatUptime(services['LPR (Matrículas)']?.uptime || 0)}
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Procesados:</strong> {services['LPR (Matrículas)']?.processed?.toLocaleString() || '0'}
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Memoria:</strong> {services['LPR (Matrículas)']?.memory_mb?.toFixed(1) || '0.0'} MB
                  </div>
                  <div className="text-muted-foreground">
                    <strong>CPU:</strong> {services['LPR (Matrículas)']?.cpu_percent?.toFixed(1) || '0.0'}%
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant={services['LPR (Matrículas)']?.enabled ? 'outline' : 'default'}
                    onClick={() => handleServiceAction('lpr', 'start')}
                    disabled={services['LPR (Matrículas)']?.enabled}
                    className={services['LPR (Matrículas)']?.enabled ? 'text-gray-400 border-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Iniciar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleServiceAction('lpr', 'stop')}
                    disabled={!services['LPR (Matrículas)']?.enabled}
                    className={services['LPR (Matrículas)']?.enabled ? 'text-red-600 border-red-300 hover:bg-red-50' : 'text-gray-400 border-gray-300 cursor-not-allowed'}
                  >
                    <Square className="h-3 w-3 mr-1" />
                    Detener
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleServiceAction('lpr', 'restart')}
                    disabled={!services['LPR (Matrículas)']?.enabled}
                    className={services['LPR (Matrículas)']?.enabled ? 'text-blue-600 border-blue-300 hover:bg-blue-50' : 'text-gray-400 border-gray-300 cursor-not-allowed'}
                  >
                    <Activity className="h-3 w-3 mr-1" />
                    Reiniciar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewLogs('LPR (Matrículas)')}
                    className="text-purple-600 border-purple-300 hover:bg-purple-50"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Ver Logs
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Conteo Service */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-4 w-4" />
                    <CardTitle className="text-sm flex items-center">
                      Conteo
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewLogs('Conteo')}
                        className="ml-2 h-[28px] text-purple-600 border-purple-300 hover:bg-purple-50"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Ver Logs
                      </Button>
                    </CardTitle>
                  </div>
                  {getServiceBadge(services['Conteo']?.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">
                    <strong>Tiempo activo:</strong> {formatUptime(services['Conteo']?.uptime || 0)}
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Procesados:</strong> {(services['Conteo']?.processed ?? 0).toLocaleString()}
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Memoria:</strong> {services['Conteo']?.memory_mb?.toFixed(1) || '0.0'} MB
                  </div>
                  <div className="text-muted-foreground">
                    <strong>CPU:</strong> {services['Conteo']?.cpu_percent?.toFixed(1) || '0.0'}%
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant={services['Conteo']?.enabled ? 'outline' : 'default'}
                    onClick={() => handleServiceAction('counting', 'start')}
                    disabled={services['Conteo']?.enabled}
                    className={services['Conteo']?.enabled ? 'text-gray-400 border-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Iniciar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleServiceAction('counting', 'stop')}
                    disabled={!services['Conteo']?.enabled}
                    className={services['Conteo']?.enabled ? 'text-red-600 border-red-300 hover:bg-red-50' : 'text-gray-400 border-gray-300 cursor-not-allowed'}
                  >
                    <Square className="h-3 w-3 mr-1" />
                    Detener
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleServiceAction('counting', 'restart')}
                    disabled={!services['Conteo']?.enabled}
                    className={services['Conteo']?.enabled ? 'text-blue-600 border-blue-300 hover:bg-blue-50' : 'text-gray-400 border-gray-300 cursor-not-allowed'}
                  >
                    <Activity className="h-3 w-3 mr-1" />
                    Reiniciar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewLogs('Conteo')}
                    className="text-purple-600 border-purple-300 hover:bg-purple-50"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Ver Logs
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
                    <CardTitle className="text-sm flex items-center">
                      Notificaciones
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewLogs('Notificaciones')}
                        className="ml-2 h-[28px] text-purple-600 border-purple-300 hover:bg-purple-50"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Ver Logs
                      </Button>
                    </CardTitle>
                  </div>
                  {getServiceBadge(services['Notificaciones']?.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-muted-foreground">
                    <strong>Tiempo activo:</strong> {formatUptime(services['Notificaciones']?.uptime || 0)}
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Enviadas:</strong> {(services['Notificaciones']?.sent ?? 0).toLocaleString()}
                  </div>
                  <div className="text-muted-foreground">
                    <strong>Memoria:</strong> {services['Notificaciones']?.memory_mb?.toFixed(1) || '0.0'} MB
                  </div>
                  <div className="text-muted-foreground">
                    <strong>CPU:</strong> {services['Notificaciones']?.cpu_percent?.toFixed(1) || '0.0'}%
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant={services['Notificaciones']?.enabled ? 'outline' : 'default'}
                    onClick={() => handleServiceAction('notifications', 'start')}
                    disabled={services['Notificaciones']?.enabled}
                    className={services['Notificaciones']?.enabled ? 'text-gray-400 border-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Iniciar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleServiceAction('notifications', 'stop')}
                    disabled={!services['Notificaciones']?.enabled}
                    className={services['Notificaciones']?.enabled ? 'text-red-600 border-red-300 hover:bg-red-50' : 'text-gray-400 border-gray-300 cursor-not-allowed'}
                  >
                    <Square className="h-3 w-3 mr-1" />
                    Detener
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleServiceAction('notifications', 'restart')}
                    disabled={!services['Notificaciones']?.enabled}
                    className={services['Notificaciones']?.enabled ? 'text-blue-600 border-blue-300 hover:bg-blue-50' : 'text-gray-400 border-gray-300 cursor-not-allowed'}
                  >
                    <Activity className="h-3 w-3 mr-1" />
                    Reiniciar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleViewLogs('Notificaciones')}
                    className="text-purple-600 border-purple-300 hover:bg-purple-50"
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    Ver Logs
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Server className="h-5 w-5" />
                      Servidor Frigate
                    </CardTitle>
                    <CardDescription>
                      Selecciona el servidor Frigate para procesamiento de matrículas
                    </CardDescription>
                  </div>
                  {get_frigate_status_badge()}
                </div>
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
                      {FRIGATE_SERVERS.filter(server => server.enabled).map(server => (
                        <SelectItem key={server.id} value={server.id}>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
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
                      const server = FRIGATE_SERVERS.find(s => s.id === formData.lpr_frigate_server_id);
                      return server ? (
                        <div className="space-y-1 text-sm">
                          <div><strong>Nombre:</strong> {server.name}</div>
                          <div><strong>URL:</strong> {server.baseUrl}</div>
                          <div className="flex items-center gap-2">
                            <strong>Estado:</strong>
                            <Badge className="bg-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Disponible
                            </Badge>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={test_frigate_connection}
                    disabled={frigateTesting || !formData.lpr_frigate_server_id}
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                  >
                    {frigateTesting ? (
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
          </div>

          {/* Configuración de Retención */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HardDrive className="h-5 w-5" />
                Retención de Datos
              </CardTitle>
              <CardDescription>
                Configuración de almacenamiento y limpieza automática de datos de matrículas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="retention-events">Eventos (días)</Label>
                  <Input
                    id="retention-events"
                    type="number"
                    min="1"
                    max="365"
                    value={formData.lpr_retention_events_days}
                    onChange={(e) => setFormData({...formData, lpr_retention_events_days: parseInt(e.target.value) || 30})}
                  />
                  <div className="text-xs text-muted-foreground">
                    Datos de eventos de matrículas
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retention-clips">Clips (días)</Label>
                  <Input
                    id="retention-clips"
                    type="number"
                    min="1"
                    max="90"
                    value={formData.lpr_retention_clips_days}
                    onChange={(e) => setFormData({...formData, lpr_retention_clips_days: parseInt(e.target.value) || 7})}
                  />
                  <div className="text-xs text-muted-foreground">
                    Videos de recortes
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="retention-snapshots">Snapshots (días)</Label>
                  <Input
                    id="retention-snapshots"
                    type="number"
                    min="1"
                    max="180"
                    value={formData.lpr_retention_snapshots_days}
                    onChange={(e) => setFormData({...formData, lpr_retention_snapshots_days: parseInt(e.target.value) || 14})}
                  />
                  <div className="text-xs text-muted-foreground">
                    Imágenes de capturas
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-storage">Límite (GB)</Label>
                  <Input
                    id="max-storage"
                    type="number"
                    min="1"
                    max="1000"
                    value={formData.lpr_retention_max_storage_gb}
                    onChange={(e) => setFormData({...formData, lpr_retention_max_storage_gb: parseInt(e.target.value) || 50})}
                  />
                  <div className="text-xs text-muted-foreground">
                    Espacio máximo total
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="auto-cleanup"
                  checked={formData.lpr_auto_cleanup}
                  onCheckedChange={(checked) => setFormData({...formData, lpr_auto_cleanup: checked})}
                />
                <Label htmlFor="auto-cleanup">Limpieza automática cuando se superan los límites</Label>
              </div>

              <Alert>
                <Calendar className="h-4 w-4" />
                <AlertDescription>
                  <strong>Política de retención:</strong> Los eventos se eliminarán después de {formData.lpr_retention_events_days} días, 
                  los clips después de {formData.lpr_retention_clips_days} días y los snapshots después de {formData.lpr_retention_snapshots_days} días.
                  {formData.lpr_auto_cleanup && ` La limpieza automática se activará al superar ${formData.lpr_retention_max_storage_gb} GB.`}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          {/* Configuración Básica de Procesamiento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuración de Procesamiento
              </CardTitle>
              <CardDescription>
                Ajustes básicos para el reconocimiento de matrículas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="lpr-enabled"
                  checked={formData.lpr_enabled}
                  onCheckedChange={(checked) => setFormData({...formData, lpr_enabled: checked})}
                />
                <Label htmlFor="lpr-enabled">Habilitar procesamiento de matrículas</Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lpr-confidence">Umbral de Confianza</Label>
                  <Input
                    id="lpr-confidence"
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.lpr_confidence_threshold}
                    onChange={(e) => setFormData({...formData, lpr_confidence_threshold: parseFloat(e.target.value)})}
                  />
                  <div className="text-sm text-muted-foreground">
                    Confianza mínima: {Math.round(formData.lpr_confidence_threshold * 100)}%
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lpr-processing-time">Tiempo Máximo (seg)</Label>
                  <Input
                    id="lpr-processing-time"
                    type="number"
                    min="1"
                    max="120"
                    value={formData.lpr_max_processing_time}
                    onChange={(e) => setFormData({...formData, lpr_max_processing_time: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="lpr-save-images"
                  checked={formData.lpr_save_images}
                  onCheckedChange={(checked) => setFormData({...formData, lpr_save_images: checked})}
                />
                <Label htmlFor="lpr-save-images">Guardar imágenes de placas detectadas</Label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="counting" className="space-y-4">
          <CountingConfig embedded />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sistema de Notificaciones</CardTitle>
              <CardDescription>
                Configuración de alertas y notificaciones automáticas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-2">
                <Switch
                  id="notifications-enabled"
                  checked={formData.notifications_enabled}
                  onCheckedChange={(checked) => setFormData({...formData, notifications_enabled: checked})}
                />
                <Label htmlFor="notifications-enabled">Habilitar sistema de notificaciones</Label>
              </div>

              {/* Email Notifications */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4" />
                  <h4 className="text-sm font-medium">Notificaciones por Email</h4>
                  <Switch
                    checked={formData.email_enabled}
                    onCheckedChange={(checked) => setFormData({...formData, email_enabled: checked})}
                  />
                </div>

                {formData.email_enabled && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div className="space-y-2">
                      <Label htmlFor="smtp-host">Servidor SMTP</Label>
                      <Input
                        id="smtp-host"
                        placeholder="smtp.gmail.com"
                        value={formData.email_smtp_host}
                        onChange={(e) => setFormData({...formData, email_smtp_host: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="smtp-port">Puerto</Label>
                      <Input
                        id="smtp-port"
                        type="number"
                        placeholder="587"
                        value={formData.email_smtp_port}
                        onChange={(e) => setFormData({...formData, email_smtp_port: parseInt(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email-username">Usuario</Label>
                      <Input
                        id="email-username"
                        placeholder="usuario@ejemplo.com"
                        value={formData.email_username}
                        onChange={(e) => setFormData({...formData, email_username: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email-password">Contraseña</Label>
                      <Input
                        id="email-password"
                        type="password"
                        value={formData.email_password}
                        onChange={(e) => setFormData({...formData, email_password: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="email-recipients">Destinatarios</Label>
                      <Textarea
                        id="email-recipients"
                        placeholder="admin@ejemplo.com, operador@ejemplo.com"
                        value={formData.email_recipients}
                        onChange={(e) => setFormData({...formData, email_recipients: e.target.value})}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Webhook Notifications */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Webhook className="h-4 w-4" />
                  <h4 className="text-sm font-medium">Webhook</h4>
                  <Switch
                    checked={formData.webhook_enabled}
                    onCheckedChange={(checked) => setFormData({...formData, webhook_enabled: checked})}
                  />
                </div>

                {formData.webhook_enabled && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="webhook-url">URL del Webhook</Label>
                      <Input
                        id="webhook-url"
                        placeholder="https://api.ejemplo.com/webhook"
                        value={formData.webhook_url}
                        onChange={(e) => setFormData({...formData, webhook_url: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="webhook-secret">Secreto (opcional)</Label>
                      <Input
                        id="webhook-secret"
                        placeholder="mi_secreto_webhook"
                        value={formData.webhook_secret}
                        onChange={(e) => setFormData({...formData, webhook_secret: e.target.value})}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Telegram Notifications */}
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <MessageSquare className="h-4 w-4" />
                  <h4 className="text-sm font-medium">Telegram</h4>
                  <Switch
                    checked={formData.telegram_enabled}
                    onCheckedChange={(checked) => setFormData({...formData, telegram_enabled: checked})}
                  />
                </div>

                {formData.telegram_enabled && (
                  <div className="grid grid-cols-2 gap-4 pl-6">
                    <div className="space-y-2">
                      <Label htmlFor="telegram-token">Bot Token</Label>
                      <Input
                        id="telegram-token"
                        placeholder="123456789:ABCdef..."
                        value={formData.telegram_bot_token}
                        onChange={(e) => setFormData({...formData, telegram_bot_token: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telegram-chat">Chat ID</Label>
                      <Input
                        id="telegram-chat"
                        placeholder="-1001234567890"
                        value={formData.telegram_chat_id}
                        onChange={(e) => setFormData({...formData, telegram_chat_id: e.target.value})}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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

  {/* Botón de Guardar */}
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={loadBackendConfig}>
          Resetear
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </div>

      {/* Modal de Logs */}
      <Dialog open={logsModal.open} onOpenChange={(open) => setLogsModal(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Logs del Servicio: {logsModal.service}
            </DialogTitle>
            <DialogDescription>
              Logs en tiempo real del contenedor {logsModal.service}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {logsModal.loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 animate-spin" />
                  <span>Cargando logs...</span>
                </div>
              </div>
            ) : (
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
                <pre className="whitespace-pre-wrap break-words">
                  {logsModal.logs || 'No se encontraron logs'}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}