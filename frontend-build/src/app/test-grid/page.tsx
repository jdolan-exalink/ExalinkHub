'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TestGridPage() {
  const [lpr_readings, set_lpr_readings] = useState<any[]>([]);
  const [loading_readings, set_loading_readings] = useState(true);

  // Función para cargar lecturas LPR
  const load_lpr_readings = async () => {
    try {
      set_loading_readings(true);
      const response = await fetch('/api/lpr/readings?limit=100');
      if (response.ok) {
        const data = await response.json();
        set_lpr_readings(data.readings || []);
        console.log('Datos cargados:', data.readings);
      } else {
        console.error('Error en respuesta:', response.status);
      }
    } catch (error) {
      console.error('Error cargando lecturas LPR:', error);
    } finally {
      set_loading_readings(false);
    }
  };

  // Cargar lecturas al montar el componente
  useEffect(() => {
    load_lpr_readings();
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Test Grid - Lecturas LPR</h1>

      {/* Barra de herramientas */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Base de Datos de Matrículas</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={load_lpr_readings}
            disabled={loading_readings}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading_readings ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </Card>

      {/* Grilla de base de datos */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium">ID</th>
                <th className="px-4 py-3 text-left font-medium">Matrícula</th>
                <th className="px-4 py-3 text-left font-medium">Cámara</th>
                <th className="px-4 py-3 text-left font-medium">Confianza</th>
                <th className="px-4 py-3 text-left font-medium">Fecha/Hora</th>
                <th className="px-4 py-3 text-left font-medium">Tipo Vehículo</th>
                <th className="px-4 py-3 text-left font-medium">Velocidad</th>
                <th className="px-4 py-3 text-left font-medium">Dirección</th>
                <th className="px-4 py-3 text-left font-medium">Servidor</th>
              </tr>
            </thead>
            <tbody>
              {loading_readings ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    Cargando datos...
                  </td>
                </tr>
              ) : lpr_readings.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                    No hay registros de matrículas en la base de datos
                  </td>
                </tr>
              ) : (
                lpr_readings.map((reading: any) => (
                  <tr key={reading.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3">{reading.id}</td>
                    <td className="px-4 py-3 font-mono font-medium">{reading.plate}</td>
                    <td className="px-4 py-3">{reading.camera}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        reading.confidence > 0.8 ? 'bg-green-100 text-green-800' :
                        reading.confidence > 0.6 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {(reading.confidence * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(reading.timestamp * 1000).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">{reading.vehicle_type || '-'}</td>
                    <td className="px-4 py-3">{reading.speed ? `${reading.speed} km/h` : '-'}</td>
                    <td className="px-4 py-3">{reading.direction || '-'}</td>
                    <td className="px-4 py-3 text-sm">{reading.server_name}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Debug info */}
      <Card className="p-4">
        <h3 className="font-semibold mb-2">Debug Info</h3>
        <p>Total registros: {lpr_readings.length}</p>
        <p>Loading: {loading_readings ? 'Sí' : 'No'}</p>
        <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-auto max-h-40">
          {JSON.stringify(lpr_readings.slice(0, 2), null, 2)}
        </pre>
      </Card>
    </div>
  );
}