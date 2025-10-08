'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Clock, CheckCircle, XCircle, Timer } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Nota: Este es el sistema existente mantenido como fallback
// Los componentes LPRFilters, LPRTable, etc. del sistema original
// deberían importarse desde @/components/ui/ si están disponibles

export default function PlatesPageExisting() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Sistema clásico de matrículas. Para acceder al sistema mejorado, asegúrate de que el servidor LPR esté ejecutándose en el puerto 2221.
        </AlertDescription>
      </Alert>
      
      <Card>
        <CardHeader>
          <CardTitle>Sistema Clásico LPR</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            El sistema clásico está disponible pero se recomienda usar el nuevo sistema mejorado cuando esté disponible.
          </p>
          <div className="mt-4">
            <p className="text-sm">
              <strong>Características:</strong>
            </p>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
              <li>• Integración directa con Frigate</li>
              <li>• Base de datos SQLite local</li>
              <li>• Filtros básicos de búsqueda</li>
              <li>• Visualización de snapshots y clips</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}