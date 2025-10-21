import { NextRequest, NextResponse } from 'next/server';
import { getLPRServersManager } from '@/lib/lpr-servers';

/**
 * @api {get} /api/lpr/servers Listar servidores LPR
 * @apiDescription Devuelve la lista de servidores LPR y configuración general del archivo matriculas.conf.
 */
export async function GET() {
  try {
    console.log('🔍 LPR Servers API: Starting GET request');
    const manager = getLPRServersManager();
    console.log('✅ LPR Servers Manager created successfully');
    const servers = manager.getAllServers();
    console.log('✅ Servers retrieved:', servers.length);
    const general = manager.getGeneralConfig();
    console.log('✅ General config retrieved:', general);

    return NextResponse.json({
      servers,
      general,
      success: true
    });
  } catch (error) {
    console.error('❌ Error al leer configuración LPR:', error);
    return NextResponse.json({
      error: 'No se pudo leer la configuración LPR',
      details: error instanceof Error ? error.message : 'Unknown error',
      success: false
    }, { status: 500 });
  }
}

/**
 * @api {post} /api/lpr/servers Agregar servidor LPR
 * @apiDescription Agrega un nuevo servidor LPR al archivo matriculas.conf.
 * @apiBody {string} name - Nombre del servidor
 * @apiBody {string} mqtt_broker - Broker MQTT
 * @apiBody {number} mqtt_port - Puerto MQTT
 * @apiBody {string} [mqtt_user] - Usuario MQTT
 * @apiBody {string} [mqtt_pass] - Contraseña MQTT
 * @apiBody {string} [frigate_url] - URL de Frigate
 * @apiBody {string} [frigate_token] - Token de Frigate
 * @apiBody {string} [frigate_auth=bearer] - Tipo de autenticación
 * @apiBody {string} [mqtt_topic=frigate/events] - Topic MQTT
 * @apiBody {string} [sftp_host] - Host SFTP
 * @apiBody {number} [sftp_port=22] - Puerto SFTP
 * @apiBody {string} [sftp_user=frigate] - Usuario SFTP
 * @apiBody {string} [sftp_pass=frigate123] - Contraseña SFTP
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validar datos mínimos
    if (!body.name?.trim()) {
      return NextResponse.json({
        error: 'El nombre del servidor es obligatorio',
        success: false
      }, { status: 400 });
    }

    const manager = getLPRServersManager();

    // Crear el servidor
    const serverId = manager.createServer({
      name: body.name.trim(),
      mqtt_broker: body.mqtt_broker || '127.0.0.1',
      mqtt_port: body.mqtt_port || 1883,
      mqtt_user: body.mqtt_user || '',
      mqtt_pass: body.mqtt_pass || '',
      frigate_url: body.frigate_url || '',
      frigate_token: body.frigate_token || '',
      frigate_auth: body.frigate_auth || 'bearer',
      frigate_user: body.frigate_user || '',
      frigate_pass: body.frigate_pass || '',
      frigate_header_name: body.frigate_header_name || '',
      frigate_header_value: body.frigate_header_value || '',
      mqtt_topic: body.mqtt_topic || 'frigate/events',
      sftp_host: body.sftp_host || '',
      sftp_port: body.sftp_port || 22,
      sftp_user: body.sftp_user || 'frigate',
      sftp_pass: body.sftp_pass || 'frigate123',
      sftp_plate_root: body.sftp_plate_root || '/mnt/cctv/clips/lpr',
      sftp_plate_path_template: body.sftp_plate_path_template || '{root}/{camera}/{event_id}.jpg',
      sftp_clip_mode: body.sftp_clip_mode || 'api',
      sftp_clip_root: body.sftp_clip_root || '/mnt/cctv/clips/lpr',
      sftp_clip_path_template: body.sftp_clip_path_template || '{root}/{camera}/',
      enabled: body.enabled ?? true
    });

    return NextResponse.json({
      success: true,
      id: serverId,
      message: `Servidor ${body.name} creado correctamente`
    });
  } catch (error) {
    console.error('Error al crear servidor LPR:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'No se pudo crear el servidor',
      success: false
    }, { status: 500 });
  }
}

/**
 * @api {put} /api/lpr/servers Editar servidor LPR
 * @apiDescription Edita un servidor LPR existente en el archivo matriculas.conf.
 * @apiBody {string} id - ID del servidor a editar
 * @apiBody {string} name - Nuevo nombre del servidor
 * @apiBody {string} mqtt_broker - Broker MQTT
 * @apiBody {number} mqtt_port - Puerto MQTT
 * @apiBody {string} [mqtt_user] - Usuario MQTT
 * @apiBody {string} [mqtt_pass] - Contraseña MQTT
 * @apiBody {string} [frigate_url] - URL de Frigate
 * @apiBody {string} [frigate_token] - Token de Frigate
 * @apiBody {string} [frigate_auth=bearer] - Tipo de autenticación
 * @apiBody {string} [mqtt_topic=frigate/events] - Topic MQTT
 * @apiBody {string} [sftp_host] - Host SFTP
 * @apiBody {number} [sftp_port=22] - Puerto SFTP
 * @apiBody {string} [sftp_user=frigate] - Usuario SFTP
 * @apiBody {string} [sftp_pass=frigate123] - Contraseña SFTP
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({
        error: 'ID del servidor es requerido',
        success: false
      }, { status: 400 });
    }

    const manager = getLPRServersManager();

    const success = manager.updateServer(body.id, {
      name: body.name,
      mqtt_broker: body.mqtt_broker,
      mqtt_port: body.mqtt_port,
      mqtt_user: body.mqtt_user,
      mqtt_pass: body.mqtt_pass,
      frigate_url: body.frigate_url,
      frigate_token: body.frigate_token,
      frigate_auth: body.frigate_auth,
      frigate_user: body.frigate_user,
      frigate_pass: body.frigate_pass,
      frigate_header_name: body.frigate_header_name,
      frigate_header_value: body.frigate_header_value,
      mqtt_topic: body.mqtt_topic,
      sftp_host: body.sftp_host,
      sftp_port: body.sftp_port,
      sftp_user: body.sftp_user,
      sftp_pass: body.sftp_pass,
      sftp_plate_root: body.sftp_plate_root,
      sftp_plate_path_template: body.sftp_plate_path_template,
      sftp_clip_mode: body.sftp_clip_mode,
      sftp_clip_root: body.sftp_clip_root,
      sftp_clip_path_template: body.sftp_clip_path_template,
      enabled: body.enabled
    });

    if (!success) {
      return NextResponse.json({
        error: 'Servidor no encontrado',
        success: false
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `Servidor ${body.name} actualizado correctamente`
    });
  } catch (error) {
    console.error('Error al actualizar servidor LPR:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'No se pudo actualizar el servidor',
      success: false
    }, { status: 500 });
  }
}

/**
 * @api {delete} /api/lpr/servers Eliminar servidor LPR
 * @apiDescription Elimina un servidor LPR del archivo matriculas.conf.
 * @apiBody {string} id - ID del servidor a eliminar
 */
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({
        error: 'ID del servidor es requerido',
        success: false
      }, { status: 400 });
    }

    const manager = getLPRServersManager();
    const success = manager.deleteServer(body.id);

    if (!success) {
      return NextResponse.json({
        error: 'Servidor no encontrado',
        success: false
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Servidor eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar servidor LPR:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'No se pudo eliminar el servidor',
      success: false
    }, { status: 500 });
  }
}