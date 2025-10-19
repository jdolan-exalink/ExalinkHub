"use client";

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  Trash2, 
  Share2, 
  RefreshCw, 
  X, 
  Clock, 
  Server,
  Video,
  CheckCircle,
  Loader2,
  Copy,
  ExternalLink
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * Interfaz para datos de export de Frigate
 */
interface FrigateExport {
  export_id: string;
  name?: string;
  status?: string;
  created_at?: string;
  download_path?: string;
  camera?: string;
  start_time?: number;
  end_time?: number;
}

/**
 * Interfaz para servidor con sus exports
 */
interface ServerWithExports {
  id: string | number;
  name: string;
  baseUrl: string;
  exports: FrigateExport[];
  error?: string;
}

/**
 * Props del componente ExportsSidebar
 */
interface ExportsSidebarProps {
  is_open: boolean;
  on_close: () => void;
  on_export_created?: () => void;
}

/**
 * Componente de barra lateral para gestión de exports de grabaciones
 * Muestra todos los exports guardados en servidores Frigate
 */
export default function ExportsSidebar({ is_open, on_close, on_export_created }: ExportsSidebarProps) {
  const translate = useTranslations('recordings.exports');
  
  const [servers, set_servers] = useState<ServerWithExports[]>([]);
  const [is_loading, set_is_loading] = useState(false);
  const [share_dialog_open, set_share_dialog_open] = useState(false);
  const [selected_export, set_selected_export] = useState<{
    server_id: string | number;
    export_id: string;
    name?: string;
  } | null>(null);
  const [share_url, set_share_url] = useState('');
  const [share_duration, set_share_duration] = useState(24);
  const [is_generating_share, set_is_generating_share] = useState(false);

  /**
   * Cargar lista de exports desde todos los servidores
   */
  const load_exports = async () => {
    set_is_loading(true);
    try {
      const response = await fetch('/api/frigate/exports');
      
      if (!response.ok) {
        throw new Error('Error al cargar exports');
      }

      const data = await response.json();
      set_servers(data.servers || []);
    } catch (error) {
      console.error('Error cargando exports:', error);
      toast({
        title: 'Error',
        description: 'Error al cargar lista de exports',
        variant: 'destructive',
      });
    } finally {
      set_is_loading(false);
    }
  };

  /**
   * Descargar un export
   */
  const handle_download = async (server_id: string | number, export_id: string, name?: string) => {
    try {
      toast({
        title: 'Iniciando descarga...',
      });

      // Obtener el servidor para construir la URL
      const server = servers.find(s => s.id === server_id);
      if (!server) {
        toast({
          title: 'Error',
          description: 'Servidor no encontrado',
          variant: 'destructive',
        });
        return;
      }

      // Descargar directamente desde Frigate
      const download_url = `${server.baseUrl}/api/export/${export_id}/download`;
      
      const link = document.createElement('a');
      link.href = download_url;
      link.download = name ? `${name}.mp4` : `export_${export_id}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: 'Descarga iniciada',
      });
    } catch (error) {
      console.error('Error descargando export:', error);
      toast({
        title: 'Error',
        description: 'Error al descargar export',
        variant: 'destructive',
      });
    }
  };

  /**
   * Eliminar un export
   */
  const handle_delete = async (server_id: string | number, export_id: string, name?: string) => {
    if (!confirm(`¿Eliminar export "${name || export_id}"?`)) {
      return;
    }

    try {
      const response = await fetch('/api/frigate/exports', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_id, export_id }),
      });

      if (!response.ok) {
        throw new Error('Error al eliminar export');
      }

      toast({
        title: 'Export eliminado correctamente',
      });
      load_exports(); // Recargar lista
    } catch (error) {
      console.error('Error eliminando export:', error);
      toast({
        title: 'Error',
        description: 'Error al eliminar export',
        variant: 'destructive',
      });
    }
  };

  /**
   * Abrir diálogo para compartir export
   */
  const handle_share_click = (server_id: string | number, export_id: string, name?: string) => {
    set_selected_export({ server_id, export_id, name });
    set_share_url('');
    set_share_dialog_open(true);
  };

  /**
   * Generar link de compartir
   */
  const generate_share_link = async () => {
    if (!selected_export) return;

    set_is_generating_share(true);
    try {
      const response = await fetch('/api/frigate/exports/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server_id: selected_export.server_id,
          export_id: selected_export.export_id,
          duration_hours: share_duration,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al generar link de compartir');
      }

      const data = await response.json();
      set_share_url(data.share_url);
      toast({
        title: 'Link de compartir generado',
      });
    } catch (error) {
      console.error('Error generando link:', error);
      toast({
        title: 'Error',
        description: 'Error al generar link de compartir',
        variant: 'destructive',
      });
    } finally {
      set_is_generating_share(false);
    }
  };

  /**
   * Copiar link al portapapeles
   */
  const copy_share_link = () => {
    if (share_url) {
      navigator.clipboard.writeText(share_url);
      toast({
        title: 'Link copiado al portapapeles',
      });
    }
  };

  /**
   * Formatear fecha de creación
   */
  const format_date = (date_string?: string) => {
    if (!date_string) return 'Fecha desconocida';
    
    try {
      const date = new Date(date_string);
      return new Intl.DateTimeFormat('es', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return date_string;
    }
  };

  /**
   * Formatear duración del export
   */
  const format_duration = (start_time?: number, end_time?: number) => {
    if (!start_time || !end_time) return '';
    
    const duration_seconds = end_time - start_time;
    const minutes = Math.floor(duration_seconds / 60);
    const seconds = duration_seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  // Cargar exports al abrir
  useEffect(() => {
    if (is_open) {
      load_exports();
    }
  }, [is_open]);

  // Contar total de exports
  const total_exports = servers.reduce((sum, server) => sum + (server.exports?.length || 0), 0);

  if (!is_open) return null;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={on_close}
      />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-96 bg-background border-l border-border z-50 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              Exports Guardados
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={load_exports}
              disabled={is_loading}
            >
              <RefreshCw className={`h-4 w-4 ${is_loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={on_close}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="px-4 py-2 bg-muted/50 border-b border-border">
          <div className="text-sm text-muted-foreground">
            {total_exports} export{total_exports !== 1 ? 's' : ''} en {servers.length} servidor{servers.length !== 1 ? 'es' : ''}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {is_loading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : total_exports === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Video className="h-12 w-12 mb-2 opacity-50" />
              <p className="text-sm">No hay exports guardados</p>
            </div>
          ) : (
            servers.map((server) => (
              <div key={server.id} className="border-b border-border last:border-0">
                {/* Server header */}
                <div className="px-4 py-2 bg-muted/30 flex items-center gap-2">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{server.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({server.exports?.length || 0})
                  </span>
                </div>

                {/* Exports list */}
                {server.exports && server.exports.length > 0 ? (
                  <div className="divide-y divide-border">
                    {server.exports.map((exp) => (
                      <div key={exp.export_id} className="p-4 hover:bg-muted/50 transition-colors">
                        {/* Export info */}
                        <div className="mb-2">
                          <div className="font-medium text-sm truncate">
                            {exp.name || exp.export_id}
                          </div>
                          {exp.camera && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {exp.camera}
                              {exp.start_time && exp.end_time && (
                                <span className="ml-2">
                                  • {format_duration(exp.start_time, exp.end_time)}
                                </span>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format_date(exp.created_at)}
                          </div>
                          {exp.status && (
                            <div className="flex items-center gap-1 mt-1">
                              {exp.status === 'complete' ? (
                                <CheckCircle className="h-3 w-3 text-green-500" />
                              ) : (
                                <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                              )}
                              <span className="text-xs capitalize">{exp.status}</span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handle_download(server.id, exp.export_id, exp.name)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            Descargar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handle_share_click(server.id, exp.export_id, exp.name)}
                          >
                            <Share2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handle_delete(server.id, exp.export_id, exp.name)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-sm text-muted-foreground text-center">
                    Sin exports
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Share Dialog */}
      <Dialog open={share_dialog_open} onOpenChange={set_share_dialog_open}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Compartir Export</DialogTitle>
            <DialogDescription>
              Genera un link temporal para compartir "{selected_export?.name || selected_export?.export_id}"
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!share_url ? (
              <>
                <div>
                  <Label htmlFor="duration">Duración del link (horas)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    max="168"
                    value={share_duration}
                    onChange={(e) => set_share_duration(parseInt(e.target.value) || 24)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    El link expirará después de {share_duration} hora{share_duration !== 1 ? 's' : ''}
                  </p>
                </div>

                <Button
                  onClick={generate_share_link}
                  disabled={is_generating_share}
                  className="w-full"
                >
                  {is_generating_share ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    <>
                      <Share2 className="h-4 w-4 mr-2" />
                      Generar Link
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <div>
                  <Label>Link de compartir</Label>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={share_url}
                      readOnly
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={copy_share_link}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => window.open(share_url, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Este link es válido por {share_duration} hora{share_duration !== 1 ? 's' : ''} y se puede compartir públicamente
                  </p>
                </div>

                <Button
                  onClick={() => {
                    set_share_dialog_open(false);
                    set_share_url('');
                  }}
                  className="w-full"
                >
                  Cerrar
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
