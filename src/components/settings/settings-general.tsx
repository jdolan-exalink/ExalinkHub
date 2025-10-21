/**
 * Pantalla de ajustes general del sistema
 * Incluye gestión de servidores Frigate y configuración de paneles
 */

'use client';

import React from 'react';
import FrigateServersConfiguration from './frigate-servers-configuration';
import LPRServersConfiguration from './lpr-servers-configuration';
import PanelsConfiguration from './panels-configuration';

export default function SettingsGeneral() {
  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold mb-4">Ajustes del Sistema</h2>
      <FrigateServersConfiguration />
      <LPRServersConfiguration />
      <PanelsConfiguration />
    </div>
  );
}
