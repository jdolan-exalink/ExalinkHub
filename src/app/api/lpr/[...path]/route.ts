import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

/**
 * Endpoint proxy para el backend LPR
 *
 * Este endpoint actúa como proxy entre el frontend y el backend LPR,
 * permitiendo que el navegador acceda a la API del backend LPR sin
 * exponer el puerto 2221 directamente.
 *
 * Todas las peticiones a /api/lpr/* se redirigen a http://lpr-backend:2221/api/*
 *
 * Última actualización: 14 de octubre de 2025 - Forzar rebuild
 */

const LPR_BACKEND_URL = 'http://lpr-backend:2221';

/**
 * Obtiene las credenciales del backend LPR desde la configuración
 */
async function getLPRCredentials() {
  try {
    const configDb = getConfigDatabase();
    const lprConfig = configDb.getBackendConfigByService('LPR (Matrículas)');

    if (lprConfig && lprConfig.config) {
      const config = JSON.parse(lprConfig.config);
      return {
        username: config.lpr_auth_username || 'admin',
        password: config.lpr_auth_password || 'admin123'
      };
    }

    // Fallback a valores por defecto
    return {
      username: 'admin',
      password: 'admin123'
    };
  } catch (error) {
    console.error('[LPR Proxy] Error obteniendo credenciales:', error);
    return {
      username: 'admin',
      password: 'admin123'
    };
  }
}

/**
 * Crea headers de autenticación Basic para el backend LPR
 */
function createBasicAuthHeader(username: string, password: string) {
  const credentials = btoa(`${username}:${password}`);
  return `Basic ${credentials}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Construir URL del backend
    const backendUrl = new URL(`${LPR_BACKEND_URL}/api/${path}`);

    // Copiar parámetros de búsqueda
    searchParams.forEach((value, key) => {
      backendUrl.searchParams.set(key, value);
    });

    console.log(`[LPR Proxy] GET ${backendUrl.toString()}`);

    // Obtener credenciales del LPR backend
    const credentials = await getLPRCredentials();
    const authHeader = createBasicAuthHeader(credentials.username, credentials.password);

    // Hacer petición al backend LPR
    const response = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    });

    // Copiar respuesta del backend
    const responseBody = await response.text();

    console.log(`[LPR Proxy] Response: ${response.status} ${responseBody.substring(0, 100)}...`);

    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });

  } catch (error) {
    console.error('[LPR Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const url = new URL(request.url);

    // Construir URL del backend
    const backendUrl = `${LPR_BACKEND_URL}/api/${path}`;

    console.log(`[LPR Proxy] POST ${backendUrl}`);

    // Obtener body de la petición
    const body = await request.text();

    // Obtener credenciales del LPR backend
    const credentials = await getLPRCredentials();
    const authHeader = createBasicAuthHeader(credentials.username, credentials.password);

    // Hacer petición al backend LPR
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: body || undefined,
    });

    // Copiar respuesta del backend
    const responseBody = await response.text();

    console.log(`[LPR Proxy] Response: ${response.status}`);

    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });

  } catch (error) {
    console.error('[LPR Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const url = new URL(request.url);

    // Construir URL del backend
    const backendUrl = `${LPR_BACKEND_URL}/api/${path}`;

    console.log(`[LPR Proxy] PUT ${backendUrl}`);

    // Obtener body de la petición
    const body = await request.text();

    // Obtener credenciales del LPR backend
    const credentials = await getLPRCredentials();
    const authHeader = createBasicAuthHeader(credentials.username, credentials.password);

    // Hacer petición al backend LPR
    const response = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: body || undefined,
    });

    // Copiar respuesta del backend
    const responseBody = await response.text();

    console.log(`[LPR Proxy] Response: ${response.status}`);

    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });

  } catch (error) {
    console.error('[LPR Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const path = params.path.join('/');
    const url = new URL(request.url);

    // Construir URL del backend
    const backendUrl = `${LPR_BACKEND_URL}/api/${path}`;

    console.log(`[LPR Proxy] DELETE ${backendUrl}`);

    // Obtener credenciales del LPR backend
    const credentials = await getLPRCredentials();
    const authHeader = createBasicAuthHeader(credentials.username, credentials.password);

    // Hacer petición al backend LPR
    const response = await fetch(backendUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    });

    // Copiar respuesta del backend
    const responseBody = await response.text();

    console.log(`[LPR Proxy] Response: ${response.status}`);

    return new NextResponse(responseBody, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });

  } catch (error) {
    console.error('[LPR Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}