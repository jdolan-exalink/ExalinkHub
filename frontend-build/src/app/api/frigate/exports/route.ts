import { NextRequest, NextResponse } from 'next/server';
import { get_active_frigate_servers, resolve_frigate_server } from '@/lib/frigate-servers';
import { create_frigate_api } from '@/lib/frigate-api';
import { revoke_tokens_for_export } from '@/lib/export-tokens';

/**
 * GET /api/frigate/exports
 * Lista las exportaciones guardadas en cada servidor Frigate configurado.
 * Respuesta: { servers: [ { id, name, baseUrl, exports: [ { export_id, name, status, created_at, download_path } ] } ] }
 */
export async function GET() {
  try {
    const servers = get_active_frigate_servers();

    const results: Array<any> = [];

    for (const srv of servers) {
      const server_info: any = { id: srv.id, name: srv.name, baseUrl: srv.baseUrl, exports: [] };

      try {
        const api = create_frigate_api(srv);
        const items = await api.list_exports();
        server_info.exports = (items || []).map(it => ({
          export_id: it.export_id,
          name: it.name,
          status: it.status,
          created_at: it.created_at,
          download_path: it.download_path,
          camera: it.camera,
          start_time: it.start_time,
          end_time: it.end_time,
        }));
      } catch (err) {
        console.warn(`Failed to list exports for server ${srv.name}:`, err instanceof Error ? err.message : String(err));
        server_info.error = err instanceof Error ? err.message : String(err);
      }

      results.push(server_info);
    }

    // Ordenar exports de cada servidor por nombre y fecha (created_at)
    results.forEach((r: any) => {
      if (Array.isArray(r.exports)) {
        r.exports.sort((a: any, b: any) => {
          // Primero por nombre (alfabético), luego por fecha descendente
          const nameA = (a.name || '').toString().toLowerCase();
          const nameB = (b.name || '').toString().toLowerCase();
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          const dateA = a.created_at ? Date.parse(a.created_at) : 0;
          const dateB = b.created_at ? Date.parse(b.created_at) : 0;
          return dateB - dateA;
        });
      }
    });

    return NextResponse.json({ servers: results });
  } catch (error) {
    console.error('Error in /api/frigate/exports:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

/**
 * POST /api/frigate/exports
 * Crea un nuevo export en un servidor Frigate
 * Verifica que existan grabaciones, crea el export y espera a que esté listo
 * 
 * Body: {
 *   server_id?: string,
 *   camera: string,
 *   start_time: number,
 *   end_time: number,
 *   name?: string,
 *   wait_for_completion?: boolean  // Si true, espera a que el export esté listo (default: false)
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { server_id, camera, start_time, end_time, name, wait_for_completion = false } = body;

    // Validaciones
    if (!camera) {
      return NextResponse.json(
        { success: false, message: 'El parámetro "camera" es requerido' },
        { status: 400 }
      );
    }

    if (!start_time || !end_time) {
      return NextResponse.json(
        { success: false, message: 'Los parámetros "start_time" y "end_time" son requeridos' },
        { status: 400 }
      );
    }

    if (start_time >= end_time) {
      return NextResponse.json(
        { success: false, message: 'start_time debe ser menor que end_time' },
        { status: 400 }
      );
    }

    const target_server = resolve_frigate_server(server_id);

    if (!target_server) {
      return NextResponse.json(
        { success: false, message: 'No hay servidores Frigate disponibles' },
        { status: 503 }
      );
    }

    const frigate_api = create_frigate_api(target_server);

    // PASO 1: Verificar que existen grabaciones en el rango de tiempo
    console.log('📅 Verificando disponibilidad de grabaciones:', { 
      camera, 
      start_time, 
      end_time,
      start_date: new Date(start_time * 1000).toISOString(),
      end_date: new Date(end_time * 1000).toISOString(),
    });
    
    const recordings_check = await frigate_api.check_recordings_available(camera, start_time, end_time);
    
    if (!recordings_check.available) {
      const start_date = new Date(start_time * 1000);
      const end_date = new Date(end_time * 1000);
      const now = new Date();
      
      // Mensaje específico para fechas futuras
      let user_message = recordings_check.message || 'No se encontraron grabaciones para el rango de tiempo especificado';
      
      if (start_date > now) {
        user_message = `⚠️ La fecha seleccionada está en el futuro.\n\nFecha seleccionada: ${start_date.toLocaleString('es-ES')}\nFecha actual: ${now.toLocaleString('es-ES')}\n\n❌ No se pueden exportar grabaciones que aún no existen.`;
      } else if (recordings_check.duration === 0) {
        user_message = `⚠️ No hay grabaciones con contenido para el período seleccionado.\n\nCámara: ${camera}\nPeríodo: ${start_date.toLocaleString('es-ES')} - ${end_date.toLocaleString('es-ES')}\n\n💡 Verifica que la cámara estaba grabando en ese momento.`;
      }
      
      return NextResponse.json(
        { 
          success: false, 
          message: user_message,
          details: {
            camera,
            start_time,
            end_time,
            start_date: start_date.toISOString(),
            end_date: end_date.toISOString(),
            current_date: now.toISOString(),
            duration_requested: end_time - start_time,
            duration_available: recordings_check.duration || 0,
          }
        },
        { status: 404 }
      );
    }

    console.log('✅ Grabaciones disponibles:', recordings_check);

    // PASO 2: Crear export
    console.log('Creando export:', { camera, start_time, end_time, name, server: target_server.name });
    
    const export_id = await frigate_api.startRecordingExport(
      camera,
      start_time,
      end_time,
      { name }
    );

    console.log('Export creado con ID:', export_id);

    // PASO 3: Si wait_for_completion es true, esperar a que esté listo
    let final_status;
    if (wait_for_completion) {
      console.log('Esperando a que el export esté listo...');
      final_status = await frigate_api.wait_for_export_ready(export_id, {
        max_wait_ms: 120000, // 2 minutos máximo
        poll_interval_ms: 2000, // Verificar cada 2 segundos
        on_progress: (progress, status) => {
          console.log(`Export ${export_id} progreso: ${progress}% - ${status}`);
        },
      });

      if (!final_status.ready) {
        return NextResponse.json(
          {
            success: false,
            message: final_status.error || 'El export no se completó en el tiempo esperado',
            export_id,
            status: final_status.status,
            server_id: target_server.id,
            server_name: target_server.name,
          },
          { status: 500 }
        );
      }
    } else {
      // Solo obtener el estado inicial
      final_status = await frigate_api.getExportStatus(export_id);
    }

    return NextResponse.json({
      success: true,
      export_id,
      server_id: target_server.id,
      server_name: target_server.name,
      status: final_status,
      download_url: `${target_server.baseUrl}/api/export/${export_id}/download`,
      ready: wait_for_completion ? ('ready' in final_status ? final_status.ready : false) : undefined,
      recordings_info: recordings_check,
    });

  } catch (error) {
    console.error('Error en POST /api/frigate/exports:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Error al crear export',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/frigate/exports
 * Elimina un export de un servidor Frigate
 * 
 * Body: {
 *   server_id: string,
 *   export_id: string
 * }
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { server_id, export_id } = body;

    // Validaciones
    if (!export_id) {
      return NextResponse.json(
        { success: false, error: 'El parámetro "export_id" es requerido' },
        { status: 400 }
      );
    }

    if (!server_id) {
      return NextResponse.json(
        { success: false, error: 'El parámetro "server_id" es requerido' },
        { status: 400 }
      );
    }

    const target_server = resolve_frigate_server(server_id);

    if (!target_server) {
      return NextResponse.json(
        { success: false, error: 'Servidor Frigate no encontrado' },
        { status: 404 }
      );
    }

    const frigate_api = create_frigate_api(target_server);

    // Eliminar export
    console.log('Eliminando export:', { export_id, server: target_server.name });
    
    const deleted = await frigate_api.delete_export(export_id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'No se pudo eliminar el export' },
        { status: 500 }
      );
    }

    // Revocar todos los tokens asociados a este export
    const revoked_tokens = revoke_tokens_for_export(server_id, export_id);
    console.log(`Revocados ${revoked_tokens} tokens asociados al export ${export_id}`);

    return NextResponse.json({
      success: true,
      message: 'Export eliminado correctamente',
      export_id,
      revoked_tokens,
    });

  } catch (error) {
    console.error('Error en DELETE /api/frigate/exports:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Error al eliminar export',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
