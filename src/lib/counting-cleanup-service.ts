/**
 * Servicio de limpieza automática para el módulo de conteo
 * 
 * Maneja la retención automática de datos antiguos según los parámetros
 * configurados. Incluye:
 * - Limpieza de eventos antiguos según retención configurada
 * - Optimización de base de datos
 * - Log de operaciones de limpieza
 * - Reportes de espacio liberado
 * 
 * Se ejecuta periódicamente como tarea programada.
 */

import { CountingDatabase } from './counting-database';

/**
 * Configuración para el servicio de limpieza
 */
interface cleanup_config {
  retention_days: number;
  enable_auto_cleanup: boolean;
  max_batch_size: number;
  vacuum_after_cleanup: boolean;
}

/**
 * Resultado de operación de limpieza
 */
interface cleanup_result {
  events_deleted: number;
  space_freed_mb: number;
  duration_ms: number;
  success: boolean;
  error?: string;
}

/**
 * Servicio principal de limpieza del módulo de conteo
 */
export class CountingCleanupService {
  private db: CountingDatabase;
  private config: cleanup_config;

  constructor(config?: Partial<cleanup_config>) {
    this.db = new CountingDatabase();
    this.config = {
      retention_days: config?.retention_days || 30,
      enable_auto_cleanup: config?.enable_auto_cleanup !== false,
      max_batch_size: config?.max_batch_size || 1000,
      vacuum_after_cleanup: config?.vacuum_after_cleanup !== false
    };
  }

  /**
   * Ejecuta la limpieza automática de datos antiguos
   */
  async execute_cleanup(): Promise<cleanup_result> {
    const start_time = Date.now();
    
    try {
      if (!this.config.enable_auto_cleanup) {
        return {
          events_deleted: 0,
          space_freed_mb: 0,
          duration_ms: Date.now() - start_time,
          success: true
        };
      }

      console.log(`[CountingCleanup] Iniciando limpieza automática (retención: ${this.config.retention_days} días)`);

      // Calcular fecha límite para retención
      const cutoff_date = new Date();
      cutoff_date.setDate(cutoff_date.getDate() - this.config.retention_days);
      const cutoff_timestamp = Math.floor(cutoff_date.getTime() / 1000);

      // Obtener tamaño de base de datos antes de limpieza
      const size_before_mb = await this.get_database_size_mb();

      // Eliminar eventos antiguos en lotes
      let total_deleted = 0;
      let batch_deleted = 0;
      
      do {
        batch_deleted = await this.delete_old_events_batch(cutoff_timestamp, this.config.max_batch_size);
        total_deleted += batch_deleted;
        
        // Evitar sobrecarga del sistema
        if (batch_deleted > 0) {
          await this.sleep(100);
        }
      } while (batch_deleted > 0);

      // Optimizar base de datos si se liberó espacio significativo
      if (total_deleted > 0 && this.config.vacuum_after_cleanup) {
        console.log(`[CountingCleanup] Optimizando base de datos después de eliminar ${total_deleted} eventos`);
        await this.vacuum_database();
      }

      // Calcular espacio liberado
      const size_after_mb = await this.get_database_size_mb();
      const space_freed_mb = Math.max(0, size_before_mb - size_after_mb);

      const result: cleanup_result = {
        events_deleted: total_deleted,
        space_freed_mb,
        duration_ms: Date.now() - start_time,
        success: true
      };

      console.log(`[CountingCleanup] Limpieza completada: ${total_deleted} eventos eliminados, ${space_freed_mb.toFixed(2)} MB liberados`);
      
      // Registrar estadísticas de limpieza
      await this.log_cleanup_stats(result);

      return result;

    } catch (error) {
      console.error('[CountingCleanup] Error durante limpieza:', error);
      
      return {
        events_deleted: 0,
        space_freed_mb: 0,
        duration_ms: Date.now() - start_time,
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  /**
   * Elimina un lote de eventos antiguos
   */
  private async delete_old_events_batch(cutoff_timestamp: number, batch_size: number): Promise<number> {
    const result = this.db.execute_statement(`
      DELETE FROM conteo_eventos 
      WHERE timestamp < ? 
      AND id IN (
        SELECT id FROM conteo_eventos 
        WHERE timestamp < ? 
        LIMIT ?
      )
    `, [cutoff_timestamp, cutoff_timestamp, batch_size]);

    return result.changes || 0;
  }

  /**
   * Optimiza la base de datos
   */
  private async vacuum_database(): Promise<void> {
    this.db.execute_sql('VACUUM');
    this.db.execute_sql('ANALYZE');
  }

  /**
   * Obtiene el tamaño aproximado de la base de datos en MB
   */
  private async get_database_size_mb(): Promise<number> {
    try {
      const result = this.db.query_statement('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()') as { size: number };
      return (result?.size || 0) / (1024 * 1024);
    } catch (error) {
      console.warn('[CountingCleanup] No se pudo obtener tamaño de BD:', error);
      return 0;
    }
  }

  /**
   * Registra estadísticas de limpieza
   */
  private async log_cleanup_stats(result: cleanup_result): Promise<void> {
    try {
      this.db.execute_statement(`
        INSERT INTO conteo_eventos (timestamp, camera, label, count, confidence, bucket_id)
        VALUES (?, 'system', 'cleanup_stats', ?, 1.0, 'cleanup')
      `, [
        Math.floor(Date.now() / 1000),
        result.events_deleted
      ]);
    } catch (error) {
      console.warn('[CountingCleanup] No se pudo registrar estadísticas:', error);
    }
  }

  /**
   * Obtiene estadísticas de la base de datos
   */
  async get_database_stats(): Promise<{
    total_events: number;
    oldest_event_age_days: number;
    database_size_mb: number;
    events_by_period: { period: string; count: number }[];
  }> {
    try {
      // Total de eventos
      const total_result = this.db.query_statement('SELECT COUNT(*) as count FROM conteo_eventos WHERE label != "cleanup_stats"') as { count: number };
      const total_events = total_result?.count || 0;

      // Evento más antiguo
      const oldest_result = this.db.query_statement('SELECT MIN(timestamp) as oldest FROM conteo_eventos WHERE label != "cleanup_stats"') as { oldest: number };
      const oldest_timestamp = oldest_result?.oldest || Math.floor(Date.now() / 1000);
      const oldest_event_age_days = Math.floor((Date.now() / 1000 - oldest_timestamp) / 86400);

      // Tamaño de base de datos
      const database_size_mb = await this.get_database_size_mb();

      // Eventos por período (últimos 7 días)
      const week_ago = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
      const period_results = this.db.query_all_statement(`
        SELECT 
          DATE(datetime(timestamp, 'unixepoch')) as period,
          COUNT(*) as count
        FROM conteo_eventos 
        WHERE label != "cleanup_stats"
          AND timestamp > ?
        GROUP BY DATE(datetime(timestamp, 'unixepoch'))
        ORDER BY period DESC
        LIMIT 7
      `, [week_ago]) as { period: string; count: number }[];

      return {
        total_events,
        oldest_event_age_days,
        database_size_mb,
        events_by_period: period_results
      };
    } catch (error) {
      console.error('[CountingCleanup] Error obteniendo estadísticas:', error);
      return {
        total_events: 0,
        oldest_event_age_days: 0,
        database_size_mb: 0,
        events_by_period: []
      };
    }
  }

  /**
   * Actualiza la configuración de limpieza
   */
  update_config(new_config: Partial<cleanup_config>): void {
    this.config = { ...this.config, ...new_config };
  }

  /**
   * Función auxiliar para sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Verifica si es necesario ejecutar limpieza
   */
  async should_run_cleanup(): Promise<boolean> {
    if (!this.config.enable_auto_cleanup) {
      return false;
    }

    try {
      const stats = await this.get_database_stats();
      
      // Ejecutar limpieza si hay eventos más antiguos que la retención configurada
      return stats.oldest_event_age_days > this.config.retention_days;
      
    } catch (error) {
      console.error('[CountingCleanup] Error verificando necesidad de limpieza:', error);
      return false;
    }
  }

  /**
   * Cierra la conexión a la base de datos
   */
  close(): void {
    this.db.close();
  }
}

/**
 * Ejecuta limpieza automática como tarea programada
 */
export async function run_scheduled_cleanup(retention_days: number = 30): Promise<cleanup_result> {
  const cleanup_service = new CountingCleanupService({
    retention_days,
    enable_auto_cleanup: true
  });

  try {
    const should_run = await cleanup_service.should_run_cleanup();
    
    if (should_run) {
      return await cleanup_service.execute_cleanup();
    } else {
      return {
        events_deleted: 0,
        space_freed_mb: 0,
        duration_ms: 0,
        success: true
      };
    }
  } finally {
    cleanup_service.close();
  }
}