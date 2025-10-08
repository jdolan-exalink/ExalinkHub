import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';
import { FRIGATE_SERVERS } from '@/lib/frigate-servers';

/**
 * Prueba la conexión con el servidor Frigate configurado
 * @param {NextRequest} request - The incoming request
 * @returns {Promise<NextResponse>} Resultado de la prueba de conexión
 */
export async function POST(request: NextRequest) {
  try {
    const request_data = await request.json();
    const { frigate_server_id } = request_data;
    
    console.log('Frigate Test Request received:', {
      frigate_server_id
    });
    
    // Validar que se proporcionó el ID del servidor
    if (!frigate_server_id) {
      return NextResponse.json({
        success: false,
        error: 'Se requiere seleccionar un servidor Frigate'
      }, { status: 400 });
    }

    // Buscar el servidor en la configuración
    const server = FRIGATE_SERVERS.find(s => s.id === frigate_server_id);
    if (!server) {
      return NextResponse.json({
        success: false,
        error: 'Servidor Frigate no encontrado en la configuración'
      }, { status: 400 });
    }

    if (!server.enabled) {
      return NextResponse.json({
        success: false,
        error: 'El servidor Frigate seleccionado está deshabilitado'
      }, { status: 400 });
    }

    console.log('Testing Frigate connection:', {
      server_name: server.name,
      base_url: server.baseUrl
    });

    // Crear test promise con timeout
    const test_promise = new Promise(async (resolve, reject) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        reject(new Error('Timeout de conexión (10 segundos)'));
      }, 10000);

      try {
        // Probar endpoint de API de Frigate
        const test_url = `${server.baseUrl}/api/config`;
        
        const response = await fetch(test_url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        clearTimeout(timeout);

        if (response.ok) {
          const config_data = await response.json();
          
          // Verificar que es una respuesta válida de Frigate
          if (config_data && (config_data.cameras || config_data.version)) {
            resolve({
              success: true,
              message: 'Conexión con Frigate exitosa',
              server_info: {
                name: server.name,
                url: server.baseUrl,
                version: config_data.version || 'Unknown',
                cameras: config_data.cameras ? Object.keys(config_data.cameras).length : 0
              }
            });
          } else {
            reject(new Error('Respuesta inválida del servidor Frigate'));
          }
        } else if (response.status === 401) {
          reject(new Error('Credenciales incorrectas. Verifica la configuración de autenticación.'));
        } else if (response.status === 404) {
          reject(new Error('Endpoint no encontrado. Verifica que sea un servidor Frigate válido.'));
        } else {
          reject(new Error(`Error HTTP ${response.status}: ${response.statusText}`));
        }
      } catch (error: any) {
        clearTimeout(timeout);
        
        if (error.name === 'AbortError') {
          reject(new Error('Timeout de conexión (10 segundos)'));
        } else if (error.code === 'ECONNREFUSED') {
          reject(new Error('Conexión rechazada. Verifica que Frigate esté funcionando.'));
        } else if (error.code === 'ENOTFOUND') {
          reject(new Error('Host no encontrado. Verifica la URL del servidor Frigate.'));
        } else {
          reject(new Error(error.message || 'Error desconocido al conectar con Frigate'));
        }
      }
    });

    const result = await test_promise;
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error testing Frigate connection:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Error desconocido al probar conexión con Frigate'
    }, { status: 500 });
  }
}

/**
 * Obtiene el estado actual de la conexión con Frigate
 * @param {NextRequest} request - The incoming request  
 * @returns {Promise<NextResponse>} Estado actual de Frigate
 */
export async function GET(request: NextRequest) {
  try {
    const config_db = getConfigDatabase();
    const backend_config = config_db.getConsolidatedBackendConfig();
    
    if (!backend_config.lpr_frigate_server_id) {
      return NextResponse.json({
        status: 'not_configured',
        message: 'Servidor Frigate no configurado'
      });
    }

    // Buscar el servidor configurado
    const server = FRIGATE_SERVERS.find(s => s.id === backend_config.lpr_frigate_server_id);
    if (!server) {
      return NextResponse.json({
        status: 'error',
        message: 'Servidor Frigate configurado no encontrado'
      });
    }

    if (!server.enabled) {
      return NextResponse.json({
        status: 'disabled',
        message: 'Servidor Frigate deshabilitado'
      });
    }

    return NextResponse.json({
      status: 'configured',
      message: 'Frigate configurado',
      server: {
        id: server.id,
        name: server.name,
        url: server.baseUrl
      }
    });

  } catch (error: any) {
    console.error('Error getting Frigate status:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Error al obtener estado de Frigate'
    }, { status: 500 });
  }
}