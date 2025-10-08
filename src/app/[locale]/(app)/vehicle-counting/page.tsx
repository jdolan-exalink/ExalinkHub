/**
 * Página del Panel de Conteo Vehicular
 * Interfaz principal para el sistema de conteo vehicular IN/OUT
 */

import VehicleCountingPanel from '@/components/vehicle-counting/vehicle-counting-panel';

export default function VehicleCountingPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="container mx-auto p-6 space-y-6 pb-10">
        <VehicleCountingPanel />
      </div>
    </div>
  );
}