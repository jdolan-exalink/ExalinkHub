/**
 * API para gestión de limpieza del módulo de conteo
 * 
 * Endpoints para:
 * - GET: Obtener estadísticas de la base de datos
 * - POST: Ejecutar limpieza manual
 * - DELETE: Ejecutar limpieza forzada (todos los datos)
 * 
 * Rutas:
 * - GET /api/conteo/cleanup/stats - Estadísticas de BD
 * - POST /api/conteo/cleanup/run - Ejecutar limpieza
 * - DELETE /api/conteo/cleanup/purge - Limpieza completa
 */

import { NextResponse } from 'next/server';
import { CountingCleanupService } from '@/lib/counting-cleanup-service';

/**
 * GET - Obtiene estadísticas de la base de datos de conteo
 */
export async function GET() {
  try {
    const cleanup_service = new CountingCleanupService();
    
    try {
      const stats = await cleanup_service.get_database_stats();
      
      return NextResponse.json({
        success: true,
        stats
      });
      
    } finally {
      cleanup_service.close();
    }
    
  } catch (error) {
    console.error('Error obteniendo estadísticas de limpieza:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor' 
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Ejecuta limpieza manual de datos antiguos
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { retention_days, force_cleanup } = body;
    
    // Validar parámetros
    const validated_retention_days = retention_days && retention_days > 0 ? retention_days : 30;
    
    const cleanup_service = new CountingCleanupService({
      retention_days: validated_retention_days,
      enable_auto_cleanup: true
    });
    
    try {
      let result;
      
      if (force_cleanup) {
        // Ejecutar limpieza forzada sin verificaciones
        result = await cleanup_service.execute_cleanup();
      } else {
        // Verificar si es necesario limpiar antes de ejecutar
        const should_run = await cleanup_service.should_run_cleanup();
        
        if (should_run) {
          result = await cleanup_service.execute_cleanup();
        } else {
          result = {
            events_deleted: 0,
            space_freed_mb: 0,
            duration_ms: 0,
            success: true,
            message: 'No es necesario ejecutar limpieza en este momento'
          };
        }
      }
      
      return NextResponse.json({
        success: true,
        cleanup_result: result
      });
      
    } finally {
      cleanup_service.close();
    }
    
  } catch (error) {
    console.error('Error ejecutando limpieza:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor' 
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Ejecuta limpieza completa (purga todos los datos)
 */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const { confirm_purge } = body;
    
    // Validar confirmación
    if (!confirm_purge) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Confirmación requerida para purga completa' 
        },
        { status: 400 }
      );
    }
    
    const cleanup_service = new CountingCleanupService({
      retention_days: 0, // Eliminar todos los datos
      enable_auto_cleanup: true
    });
    
    try {
      const result = await cleanup_service.execute_cleanup();
      
      return NextResponse.json({
        success: true,
        purge_result: result,
        message: 'Purga completa ejecutada correctamente'
      });
      
    } finally {
      cleanup_service.close();
    }
    
  } catch (error) {
    console.error('Error ejecutando purga:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Error interno del servidor' 
      },
      { status: 500 }
    );
  }
}