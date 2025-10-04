'use client';

import { useState, useEffect } from 'react';
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
  MessageSquare
} from 'lucide-react';
import type { BackendConfig } from '@/lib/config-database';

export default function BackendTab() {
  const [config, setConfig] = useState<BackendConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [services, setServices] = useState({
    lpr: { status: 'stopped', uptime: 0, processed: 0 },
    counting: { status: 'stopped', uptime: 0, counted: 0 },
    notifications: { status: 'stopped', uptime: 0, sent: 0 }
  });

  const [formData, setFormData] = useState({
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

  useEffect(() => {
    loadBackendConfig();
    updateServiceStatus();
    
    // Actualizar estado de servicios cada 5 segundos
    const interval = setInterval(updateServiceStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadBackendConfig = async () => {
    try {
      const response = await fetch('/api/config/backend');
      const data = await response.json();
      if (data.config) {
        setConfig(data.config);
        setFormData({
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

  const getServiceBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Activo</Badge>;
      case 'stopped':
        return <Badge variant="secondary"><Square className="h-3 w-3 mr-1" />Detenido</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Error</Badge>;
      default:
        return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Desconocido</Badge>;
    }
  };

  const formatUptime = (seconds: number) => {
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
            {/* LPR Service */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    <CardTitle className="text-sm">Reconocimiento LPR</CardTitle>
                  </div>
                  {getServiceBadge(services.lpr.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-sm text-muted-foreground">
                  Tiempo activo: {formatUptime(services.lpr.uptime)}
                </div>
                <div className="text-sm text-muted-foreground">
                  Procesados: {services.lpr.processed.toLocaleString()}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={services.lpr.status === 'running' ? 'outline' : 'default'}
                    onClick={() => handleServiceAction('lpr', services.lpr.status === 'running' ? 'stop' : 'start')}
                  >
                    {services.lpr.status === 'running' ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleServiceAction('lpr', 'restart')}
                  >
                    <Activity className="h-3 w-3" />
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
      <Tabs defaultValue="lpr" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="lpr" className="flex items-center gap-2">
            <Car className="h-4 w-4" />
            LPR
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

        <TabsContent value="lpr" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Reconocimiento de Placas (LPR)</CardTitle>
              <CardDescription>
                Ajustes para el sistema de reconocimiento automático de placas vehiculares
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="lpr-enabled"
                  checked={formData.lpr_enabled}
                  onCheckedChange={(checked) => setFormData({...formData, lpr_enabled: checked})}
                />
                <Label htmlFor="lpr-enabled">Habilitar procesamiento LPR</Label>
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

              <div className="space-y-2">
                <Label htmlFor="lpr-regions">Regiones de Placas</Label>
                <Textarea
                  id="lpr-regions"
                  placeholder="us, eu, br, mx (separados por coma)"
                  value={formData.lpr_regions}
                  onChange={(e) => setFormData({...formData, lpr_regions: e.target.value})}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="lpr-save-images"
                  checked={formData.lpr_save_images}
                  onCheckedChange={(checked) => setFormData({...formData, lpr_save_images: checked})}
                />
                <Label htmlFor="lpr-save-images">Guardar imágenes de placas detectadas</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lpr-webhook">Webhook URL (opcional)</Label>
                <Input
                  id="lpr-webhook"
                  placeholder="https://api.ejemplo.com/lpr-webhook"
                  value={formData.lpr_webhook_url}
                  onChange={(e) => setFormData({...formData, lpr_webhook_url: e.target.value})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="counting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Conteo de Personas</CardTitle>
              <CardDescription>
                Ajustes para el sistema de conteo automático de personas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="counting-enabled"
                  checked={formData.counting_enabled}
                  onCheckedChange={(checked) => setFormData({...formData, counting_enabled: checked})}
                />
                <Label htmlFor="counting-enabled">Habilitar conteo de personas</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="counting-zones">Zonas de Conteo</Label>
                <Textarea
                  id="counting-zones"
                  placeholder="entrada_principal, sala_espera, oficinas (separadas por coma)"
                  value={formData.counting_zones}
                  onChange={(e) => setFormData({...formData, counting_zones: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="counting-confidence">Confianza Mínima</Label>
                  <Input
                    id="counting-confidence"
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={formData.counting_min_confidence}
                    onChange={(e) => setFormData({...formData, counting_min_confidence: parseFloat(e.target.value)})}
                  />
                  <div className="text-sm text-muted-foreground">
                    Confianza mínima: {Math.round(formData.counting_min_confidence * 100)}%
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="counting-reset">Intervalo de Reset (horas)</Label>
                  <Input
                    id="counting-reset"
                    type="number"
                    min="1"
                    max="168"
                    value={formData.counting_reset_interval}
                    onChange={(e) => setFormData({...formData, counting_reset_interval: parseInt(e.target.value)})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="counting-webhook">Webhook URL (opcional)</Label>
                <Input
                  id="counting-webhook"
                  placeholder="https://api.ejemplo.com/counting-webhook"
                  value={formData.counting_webhook_url}
                  onChange={(e) => setFormData({...formData, counting_webhook_url: e.target.value})}
                />
              </div>
            </CardContent>
          </Card>
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
                  {formData.db_backup_enabled && ` Las copias de seguridad se crearán cada ${formData.db_backup_interval} días.`}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Botón de Guardar */}
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={loadBackendConfig}>
          Restablecer
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </Button>
      </div>
    </div>
  );
}