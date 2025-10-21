/**
 * Componente de gráfico de barras para datos horarios de conteo vehicular
 * Muestra entradas y salidas por hora en las últimas 24 horas
 */

'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  TooltipProps
} from 'recharts';
import { ArrowUp, ArrowDown, Activity } from 'lucide-react';

interface HourlyData {
  hour: number;
  in: number;
  out: number;
  total: number;
}

interface VehicleType {
  label: string;
  count: number;
  icon: string;
  color: string;
  in: number;
  out: number;
}

interface HourlyChartProps {
  data: HourlyData[];
  vehicleTypes?: VehicleType[];
  loading?: boolean;
}

// Componente personalizado para el tooltip
const CustomTooltip: React.FC<TooltipProps<any, any>> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const entradas = data.entradas || 0;
    const salidas = data.salidas || 0;
    const total = data.total || 0;

    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
        <div className="font-semibold text-foreground mb-2">
          🕐 Hora: {label}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ArrowUp className="h-4 w-4 text-green-600" />
            <span className="text-green-600 font-medium">Entradas:</span>
            <span className="font-bold text-green-600">{entradas}</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowDown className="h-4 w-4 text-red-600" />
            <span className="text-red-600 font-medium">Salidas:</span>
            <span className="font-bold text-red-600">{salidas}</span>
          </div>
          <div className="flex items-center gap-2 border-t pt-1 mt-2">
            <Activity className="h-4 w-4 text-blue-600" />
            <span className="text-blue-600 font-medium">Total:</span>
            <span className="font-bold text-blue-600">{total}</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export function HourlyChart({ data, vehicleTypes = [], loading = false }: HourlyChartProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Cargando datos del gráfico...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">No hay datos disponibles para mostrar</div>
      </div>
    );
  }

  // Preparar datos para todas las 24 horas del día
  const chartData = data.map(hourData => ({
    hour: `${hourData.hour.toString().padStart(2, '0')}:00`,
    entradas: hourData.in,
    salidas: hourData.out,
    total: hourData.total
  }));

  // Calcular totales del día completo
  const totalEntradas = data.reduce((sum, hour) => sum + hour.in, 0);
  const totalSalidas = data.reduce((sum, hour) => sum + hour.out, 0);
  const totalEventos = data.reduce((sum, hour) => sum + hour.total, 0);

  // Calcular máximo para el eje Y
  const maxValue = Math.max(...data.map(d => Math.max(d.in, d.out, d.total)));
  const yAxisMax = Math.ceil(maxValue * 1.1) || 10; // Mínimo 10 para el eje Y

  return (
    <div className="w-full">
      {/* Totales destacados arriba del gráfico */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <ArrowUp className="h-5 w-5 text-green-600" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">Entradas</span>
          </div>
          <div className="text-2xl font-bold text-green-600">{totalEntradas}</div>
          <div className="text-xs text-green-600/70">entradas del día</div>
        </div>
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <ArrowDown className="h-5 w-5 text-red-600" />
            <span className="text-sm font-medium text-red-700 dark:text-red-400">Salidas</span>
          </div>
          <div className="text-2xl font-bold text-red-600">{totalSalidas}</div>
          <div className="text-xs text-red-600/70">salidas del día</div>
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Activity className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Total</span>
          </div>
          <div className="text-2xl font-bold text-blue-600">{totalEventos}</div>
          <div className="text-xs text-blue-600/70">eventos del día</div>
        </div>
      </div>

      {/* Tipos de vehículo detectados */}

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 12 }}
            interval={2} // Mostrar cada 3 horas para no sobrecargar
          />
          <YAxis
            tick={{ fontSize: 12 }}
            domain={[0, yAxisMax]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value) => value === 'entradas' ? 'Entradas' : value === 'salidas' ? 'Salidas' : value}
          />
          <Bar
            dataKey="entradas"
            fill="hsl(142, 76%, 36%)" // Verde para entradas
            radius={[2, 2, 0, 0]}
          />
          <Bar
            dataKey="salidas"
            fill="hsl(0, 84%, 60%)" // Rojo para salidas
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default HourlyChart;