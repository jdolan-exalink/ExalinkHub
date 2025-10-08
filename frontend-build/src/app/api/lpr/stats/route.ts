/**
 * API para estadísticas LPR
 * GET /api/lpr/stats - Obtener estadísticas del sistema
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLPRDatabase } from '@/lib/lpr-database';
import { getLPRFileManager } from '@/lib/lpr-file-manager';

/**
 * GET /api/lpr/stats
 */
export async function GET(request: NextRequest) {
  try {
    const db = getLPRDatabase();
    const fileManager = getLPRFileManager();

    // Estadísticas de base de datos
    const dbStats = db.getStats();

    // Estadísticas de archivos
    const diskUsage = fileManager.getDiskUsage();

    // Formatear tamaños
    const formatSize = (bytes: number) => {
      return LPRFileManager.formatFileSize(bytes);
    };

    return NextResponse.json({
      database: {
        total_readings: dbStats.total_readings,
        unique_plates: dbStats.unique_plates,
        today_readings: dbStats.today_readings,
        cameras_active: dbStats.cameras_active,
        average_confidence: Math.round(dbStats.average_confidence * 100) / 100,
        last_reading: dbStats.last_reading,
        last_reading_ago: dbStats.last_reading ? 
          Math.floor((Date.now() / 1000) - dbStats.last_reading) : null
      },
      storage: {
        snapshots: {
          count: diskUsage.snapshots.count,
          total_size: diskUsage.snapshots.totalSize,
          total_size_formatted: formatSize(diskUsage.snapshots.totalSize)
        },
        clips: {
          count: diskUsage.clips.count,
          total_size: diskUsage.clips.totalSize,
          total_size_formatted: formatSize(diskUsage.clips.totalSize)
        },
        crops: {
          count: diskUsage.crops.count,
          total_size: diskUsage.crops.totalSize,
          total_size_formatted: formatSize(diskUsage.crops.totalSize)
        },
        total: {
          count: diskUsage.total.count,
          total_size: diskUsage.total.totalSize,
          total_size_formatted: formatSize(diskUsage.total.totalSize)
        }
      },
      system: {
        timestamp: Math.floor(Date.now() / 1000),
        uptime: process.uptime(),
        memory_usage: process.memoryUsage()
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas LPR:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/lpr/stats/cleanup
 * Ejecutar limpieza de archivos y BD antiguos
 */
export async function POST(request: NextRequest) {
  try {
    const { days_to_keep = 30 } = await request.json();
    
    const db = getLPRDatabase();
    const fileManager = getLPRFileManager();

    // Limpieza de base de datos
    const dbCleaned = db.cleanupOldReadings(days_to_keep);

    // Limpieza de archivos
    const filesCleaned = fileManager.cleanupOldFiles(days_to_keep);

    return NextResponse.json({
      success: true,
      cleanup: {
        database_records_deleted: dbCleaned,
        files_deleted: filesCleaned.deleted,
        files_errors: filesCleaned.errors,
        days_kept: days_to_keep
      }
    });

  } catch (error) {
    console.error('Error en limpieza LPR:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// Re-exportar para acceso desde otros módulos
import { LPRFileManager } from '@/lib/lpr-file-manager';