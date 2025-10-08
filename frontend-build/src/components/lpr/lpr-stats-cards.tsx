/**
 * Componente de tarjetas de estadísticas para el panel LPR
 */

'use client';

import React from 'react';
import { Car, Camera, TrendingUp, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SystemStats {
  total_events: number;
  events_today: number;
  events_this_week: number;
  events_this_month: number;
  cameras_active: number;
  top_cameras: Array<{name: string; count: number}>;
  top_plates: Array<{plate: string; count: number}>;
  traffic_light_stats: Record<string, number>;
}

interface LPRStatsCardsProps {
  stats: SystemStats;
}

export function LPRStatsCards({ stats }: LPRStatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Eventos</CardTitle>
          <Car className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total_events.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            {stats.events_today} hoy
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Esta Semana</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.events_this_week.toLocaleString()}</div>
          <p className="text-xs text-muted-foreground">
            {stats.events_this_month} este mes
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cámaras Activas</CardTitle>
          <Camera className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.cameras_active}</div>
          <p className="text-xs text-muted-foreground">
            cámaras detectando
          </p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Semáforos</CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {stats.traffic_light_stats.red || 0}
          </div>
          <p className="text-xs text-muted-foreground">
            infracciones rojas
          </p>
        </CardContent>
      </Card>
    </div>
  );
}