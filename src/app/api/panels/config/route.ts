/**
 * API para configuración de paneles del sistema
 * GET /api/panels/config - Obtener configuración de todos los paneles
 * PUT /api/panels/config - Actualizar configuración de paneles
 */

import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

const config_db = getConfigDatabase();

export async function GET(request: NextRequest) {
  try {
    const panels = config_db.getAllPanelConfigs();
    
    // Convertir a formato más amigable para el frontend
    const panel_configs = panels.reduce((acc, panel) => {
      acc[panel.panel_name] = {
        enabled: Boolean(panel.enabled),
        title: panel.title,
        cameras: JSON.parse(panel.cameras || '[]'),
        config: JSON.parse(panel.config || '{}'),
        updated_at: panel.updated_at
      };
      return acc;
    }, {} as Record<string, any>);

    return NextResponse.json({
      success: true,
      data: panel_configs
    });
  } catch (error) {
    console.error('Error getting panel configs:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error obteniendo configuración de paneles' 
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { panel_name, enabled, title, cameras, config } = body;

    // Validar panel_name
    const valid_panels = ['lpr', 'counting_people', 'counting_vehicles'];
    if (!valid_panels.includes(panel_name)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Nombre de panel inválido. Debe ser: lpr, counting_people, o counting_vehicles' 
        },
        { status: 400 }
      );
    }

    // Actualizar configuración
    const updated = config_db.updatePanelConfig(
      panel_name as 'lpr' | 'counting_people' | 'counting_vehicles',
      enabled,
      title,
      cameras || [],
      config || {}
    );

    if (updated) {
      const updated_panel = config_db.getPanelConfig(panel_name as any);
      return NextResponse.json({
        success: true,
        data: {
          panel_name: updated_panel?.panel_name,
          enabled: Boolean(updated_panel?.enabled),
          title: updated_panel?.title,
          cameras: JSON.parse(updated_panel?.cameras || '[]'),
          config: JSON.parse(updated_panel?.config || '{}'),
          updated_at: updated_panel?.updated_at
        }
      });
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Error actualizando configuración de panel' 
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error updating panel config:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error actualizando configuración de panel' 
      },
      { status: 500 }
    );
  }
}