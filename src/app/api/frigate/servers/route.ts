import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';
import { FrigateServer } from '@/lib/frigate-servers';

/**
 * @api {get} /api/frigate/servers Listar servidores Frigate
 * @apiDescription Devuelve la lista de servidores Frigate guardados en la base de datos.
 */
export async function GET() {
  const db = getConfigDatabase();
  const servers = db.getAllServers();
  return NextResponse.json({ servers });
}

/**
 * @api {post} /api/frigate/servers Agregar servidor Frigate
 * @apiDescription Agrega un nuevo servidor Frigate a la base de datos.
 * @apiBody {string} name
 * @apiBody {string} url
 * @apiBody {string} protocol
 * @apiBody {number} port
 * @apiBody {boolean} enabled
 * @apiBody {object} auth
 */
export async function POST(request: NextRequest) {
  const db = getConfigDatabase();
  const body = await request.json();
  // Validar datos mínimos
  if (!body.name || !body.url || !body.protocol || !body.port) {
    return NextResponse.json({ error: 'Faltan datos obligatorios' }, { status: 400 });
  }
  // Usar el método correcto para crear el servidor
  const id = db.createServer({
    name: body.name,
    url: body.url,
    port: body.port,
    protocol: body.protocol,
    username: body.username,
    password: body.password,
    auth_type: body.auth?.type || 'basic',
    jwt_token: body.auth?.token || null,
  jwt_expires_at: undefined,
    enabled: body.enabled ?? true
  });
  return NextResponse.json({ success: true, id });
}

/**
 * @api {put} /api/frigate/servers Editar servidor Frigate
 * @apiDescription Edita un servidor Frigate existente en la base de datos.
 * @apiBody {string} id
 * @apiBody {string} name
 * @apiBody {string} url
 * @apiBody {string} protocol
 * @apiBody {number} port
 * @apiBody {boolean} enabled
 * @apiBody {object} auth
 */
export async function PUT(request: NextRequest) {
  const db = getConfigDatabase();
  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
  }
  const ok = db.updateServer(body.id, body);
  return NextResponse.json({ success: ok });
}

/**
 * @api {delete} /api/frigate/servers Eliminar servidor Frigate
 * @apiDescription Elimina un servidor Frigate de la base de datos.
 * @apiBody {string} id
 */
export async function DELETE(request: NextRequest) {
  const db = getConfigDatabase();
  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ error: 'ID requerido' }, { status: 400 });
  }
  const ok = db.deleteServer(body.id);
  return NextResponse.json({ success: ok });
}
