"use client"

import * as React from 'react'
import { Sidebar, SidebarContent, SidebarHeader, SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton } from './sidebar'

export default function FrigateExportsSidebar() {
  const [data, setData] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetch('/api/frigate/exports')
      .then(res => res.json())
      .then(json => {
        if (!mounted) return;
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
    return () => { mounted = false }
  }, []);

  return (
    <Sidebar side="right" variant="sidebar" collapsible="none">
      <SidebarHeader>
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Exportaciones</div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {loading && <div className="p-2 text-sm text-muted-foreground">Cargando...</div>}
        {error && <div className="p-2 text-sm text-destructive">Error: {error}</div>}

        {!loading && !error && (!data || !Array.isArray(data.servers) || data.servers.length === 0) && (
          <div className="p-2 text-sm text-muted-foreground">No hay servidores Frigate configurados o no hay exportaciones.</div>
        )}

        {!loading && data && Array.isArray(data.servers) && (
          <div className="p-2">
            {data.servers.map((srv: any) => (
              <div key={srv.id} className="mb-4">
                <div className="text-xs font-semibold text-muted-foreground">{srv.name}</div>
                <SidebarMenu>
                  {Array.isArray(srv.exports) && srv.exports.length > 0 ? (
                    srv.exports.map((ex: any) => (
                      <SidebarMenuItem key={ex.export_id}>
                        <SidebarMenuSubButton href={ex.download_path || `${srv.baseUrl.replace(/\/$/, '')}/api/export/${ex.export_id}/download`}>
                          <div className="flex flex-col text-sm">
                            <span className="font-medium">{ex.name || ex.export_id}</span>
                            {ex.created_at && <span className="text-xs text-muted-foreground">{new Date(ex.created_at).toLocaleString()}</span>}
                          </div>
                        </SidebarMenuSubButton>
                      </SidebarMenuItem>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground p-2">Sin exportaciones</div>
                  )}
                </SidebarMenu>
              </div>
            ))}
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
