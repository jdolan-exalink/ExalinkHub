import { NextRequest, NextResponse } from 'next/server';
import { validate_share_token, increment_token_download_count, revoke_share_token } from '@/lib/export-tokens';
import { resolve_frigate_server } from '@/lib/frigate-servers';
import { create_frigate_api } from '@/lib/frigate-api';

/**
 * GET /api/frigate/exports/download/[token]
 * 
 * Descarga un export usando un token de compartir público
 * No requiere autenticación
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json(
        { error: 'Token no proporcionado' },
        { status: 400 }
      );
    }

    // Validar token
    const token_data = validate_share_token(token);

    if (!token_data) {
      return NextResponse.json(
        { error: 'Token inválido o expirado' },
        { status: 401 }
      );
    }

    // Obtener servidor
    const target_server = resolve_frigate_server(token_data.server_id);

    if (!target_server) {
      return NextResponse.json(
        { error: 'Servidor Frigate no disponible' },
        { status: 503 }
      );
    }

    // Descargar export desde Frigate
    try {
      const frigate_api = create_frigate_api(target_server);
      const export_blob = await frigate_api.downloadExportedClip(token_data.export_id);

      // Incrementar contador de descargas
      increment_token_download_count(token);

      // Convertir blob a buffer
      const array_buffer = await export_blob.arrayBuffer();
      const buffer = Buffer.from(array_buffer);

      // Generar nombre de archivo
      const filename = `export_${token_data.export_id}.mp4`;

      return new NextResponse(buffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Content-Length': buffer.length.toString(),
          'Cache-Control': 'no-cache',
        },
      });

    } catch (download_error) {
      console.error('Error descargando export:', download_error);
      return NextResponse.json(
        {
          error: 'Error al descargar el export',
          details: download_error instanceof Error ? download_error.message : 'Unknown error'
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error en GET /api/frigate/exports/download/[token]:', error);
    return NextResponse.json(
      {
        error: 'Error al procesar descarga',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/frigate/exports/download/[token]
 * 
 * Revoca un token de compartir específico
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json(
        { error: 'Token no proporcionado' },
        { status: 400 }
      );
    }

    const revoked = revoke_share_token(token);

    if (!revoked) {
      return NextResponse.json(
        { success: false, message: 'Token no encontrado o ya expirado' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Token revocado correctamente',
    });

  } catch (error) {
    console.error('Error en DELETE /api/frigate/exports/download/[token]:', error);
    return NextResponse.json(
      {
        error: 'Error al revocar token',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
