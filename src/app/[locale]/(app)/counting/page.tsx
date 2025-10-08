"use client";

import React, { useState } from 'react';
import { CountingPanel } from '@/components/counting/counting-panel';
import { BarChart3, RefreshCw } from 'lucide-react';

/**
 * Página principal del módulo de conteo de objetos
 * 
 * Integra el panel de visualización y la configuración del sistema
 * de conteo automático de objetos usando las APIs implementadas.
 */
export default function CountingPage() {
  const [refresh_tick, set_refresh_tick] = useState(0);
  const trigger_refresh = () => set_refresh_tick(t => t + 1);
  return (
    <div className="h-screen flex flex-col">
      {/* Header compacto */}
      <div className="flex-shrink-0 border-b bg-background px-4 py-3 flex items-center justify-between gap-4">
        <h1 className="font-headline text-2xl font-semibold tracking-tight flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-primary" />
          Sistema de Conteo
        </h1>
        <button
          onClick={trigger_refresh}
          className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-muted transition"
          aria-label="Actualizar datos de conteo"
        >
          <RefreshCw className="h-4 w-4" /> Actualizar
        </button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <CountingPanel refresh_trigger={refresh_tick} />
      </div>
    </div>
  );
}