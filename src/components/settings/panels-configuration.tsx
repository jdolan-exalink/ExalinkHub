/**
 * Componente de configuración unificada de paneles
 * Permite habilitar/deshabilitar paneles (LPR, Conteo personas, Conteo vehicular)
 * y configurar las cámaras asignadas a cada panel
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Settings2, 
  Camera, 
  Car, 
  Users, 
  Scan, 
  Save, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface PanelConfig {
  enabled: boolean;
  title: string;
  cameras: string[];
  config: Record<string, any>;
  updated_at?: string;
}

interface Camera {
  id: string;
  name: string;
  enabled: boolean;
  server_name?: string;
}

export function PanelsConfiguration() {
  const translate_settings = useTranslations('settings');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingCameras, setLoadingCameras] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<Camera[]>([]);
  
  const [panelConfigs, setPanelConfigs] = useState<{
    lpr: PanelConfig;
    counting_people: PanelConfig;
    counting_vehicles: PanelConfig;
  }>({
    lpr: {
      enabled: false,
      title: 'Reconocimiento de Matrículas',
      cameras: [],
      config: {}
    },
    counting_people: {
      enabled: false,
      title: 'Conteo de Personas',
      cameras: [],
      config: {}
    },
    counting_vehicles: {
      enabled: false,
      title: 'Conteo Vehicular',
      cameras: [],
      config: {}
    }
  });

  /**
   * Carga la configuración actual de los paneles
   */
  const loadPanelConfigs = useCallback(async () => {
    try {
      const response = await fetch('/api/panels/config');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPanelConfigs(prev => ({
            ...prev,
            ...data.data
          }));
        }
      }
    } catch (error) {
      console.error('Error loading panel configs:', error);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la configuración de paneles',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Carga las cámaras disponibles de todos los servidores
   */
  const loadAvailableCameras = useCallback(async () => {
    setLoadingCameras(true);
    try {
      const response = await fetch('/api/frigate/cameras?all_servers=true');
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data)) {
          setAvailableCameras(data);
        } else if (data.cameras && Array.isArray(data.cameras)) {
          setAvailableCameras(data.cameras);
        }
      }
    } catch (error) {
      console.error('Error loading cameras:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las cámaras disponibles',
        variant: 'destructive'
      });
    } finally {
      setLoadingCameras(false);
    }
  }, []);

  /**
   * Actualiza la configuración de un panel específico
   */
  const updatePanelConfig = async (
    panelName: 'lpr' | 'counting_people' | 'counting_vehicles',
    updates: Partial<PanelConfig>
  ) => {
    setSaving(true);
    try {
      const currentConfig = panelConfigs[panelName];
      const updatedConfig = { ...currentConfig, ...updates };

      const response = await fetch('/api/panels/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          panel_name: panelName,
          ...updatedConfig
        })
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPanelConfigs(prev => ({
            ...prev,
            [panelName]: updatedConfig
          }));

          toast({
            title: 'Configuración guardada',
            description: `Panel ${updatedConfig.title} actualizado correctamente`
          });
        }
      } else {
        throw new Error('Error al actualizar configuración');
      }
    } catch (error) {
      console.error('Error updating panel config:', error);
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración del panel',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Habilita o deshabilita un panel
   */
  const togglePanel = (panelName: 'lpr' | 'counting_people' | 'counting_vehicles', enabled: boolean) => {
    updatePanelConfig(panelName, { enabled });
  };

  /**
   * Actualiza el título de un panel
   */
  const updatePanelTitle = (panelName: 'lpr' | 'counting_people' | 'counting_vehicles', title: string) => {
    updatePanelConfig(panelName, { title });
  };

  /**
   * Actualiza las cámaras asignadas a un panel
   */
  const updatePanelCameras = (panelName: 'lpr' | 'counting_people' | 'counting_vehicles', cameras: string[]) => {
    updatePanelConfig(panelName, { cameras });
  };

  /**
   * Maneja el cambio de selección de cámaras
   */
  const handleCameraToggle = (panelName: 'lpr' | 'counting_people' | 'counting_vehicles', cameraId: string, checked: boolean) => {
    const currentCameras = panelConfigs[panelName].cameras;
    let newCameras: string[];

    if (checked) {
      newCameras = [...currentCameras, cameraId];
    } else {
      newCameras = currentCameras.filter(id => id !== cameraId);
    }

    updatePanelCameras(panelName, newCameras);
  };

  /**
   * Renderiza el panel de configuración para un tipo específico
   */
  const renderPanelConfig = (
    panelName: 'lpr' | 'counting_people' | 'counting_vehicles',
    icon: React.ReactNode,
    description: string
  ) => {
    const config = panelConfigs[panelName];

    return (
      <Card key={panelName}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <div>
                <CardTitle className="text-lg">{config.title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                checked={config.enabled}
                onCheckedChange={(checked) => togglePanel(panelName, checked)}
                disabled={saving}
              />
              <Label className="text-sm">
                {config.enabled ? 'Habilitado' : 'Deshabilitado'}
              </Label>
            </div>
          </div>
        </CardHeader>

        {config.enabled && (
          <CardContent className="space-y-4">
            {/* Título personalizable */}
            <div className="space-y-2">
              <Label htmlFor={`${panelName}-title`}>Título del Panel</Label>
              <Input
                id={`${panelName}-title`}
                value={config.title}
                onChange={(e) => updatePanelTitle(panelName, e.target.value)}
                placeholder="Título del panel"
              />
            </div>

            {/* Selección de cámaras */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Cámaras Asignadas ({config.cameras.length})</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadAvailableCameras}
                  disabled={loadingCameras}
                >
                  {loadingCameras ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Actualizar
                </Button>
              </div>

              {availableCameras.length === 0 ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No se encontraron cámaras disponibles. Verifica la conexión con los servidores Frigate.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded p-2">
                  {availableCameras.map(camera => (
                    <div key={camera.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${panelName}-camera-${camera.id}`}
                        checked={config.cameras.includes(camera.id)}
                        onCheckedChange={(checked) => 
                          handleCameraToggle(panelName, camera.id, checked as boolean)
                        }
                      />
                      <Label 
                        htmlFor={`${panelName}-camera-${camera.id}`}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {camera.name}
                        {camera.server_name && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({camera.server_name})
                          </span>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Información adicional */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Estado:</strong> {config.cameras.length} cámaras asignadas.
                {config.updated_at && (
                  <span className="ml-2">Última actualización: {new Date(config.updated_at).toLocaleString()}</span>
                )}
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>
    );
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    loadPanelConfigs();
    loadAvailableCameras();
  }, [loadPanelConfigs, loadAvailableCameras]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        Cargando configuración de funciones...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{translate_settings('panels_card_title')}</h3>
          <p className="text-sm text-muted-foreground">
            {translate_settings('panels_card_description')}
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          {Object.values(panelConfigs).filter(p => p.enabled).length} de 3 habilitados
        </Badge>
      </div>

      <div className="space-y-4">
        {/* Panel LPR */}
        {renderPanelConfig('lpr', <Scan className="h-5 w-5" />, 'Reconocimiento automático de matrículas')}

        {/* Panel Conteo de Personas */}
        {renderPanelConfig('counting_people', <Users className="h-5 w-5" />, 'Conteo y aforo de personas por áreas')}

        {/* Panel Conteo Vehicular */}
        {renderPanelConfig('counting_vehicles', <Car className="h-5 w-5" />, 'Conteo vehicular con zonas IN/OUT')}
      </div>

      {saving && (
        <Alert>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <AlertDescription>
            Guardando configuración de funciones...
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default PanelsConfiguration;