import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';

/**
 * Tests MQTT broker connection with current configuration
 * @param {NextRequest} request - The incoming request
 * @returns {Promise<NextResponse>} Connection test result
 */
export async function POST(request: NextRequest) {
  try {
    // Get MQTT configuration from request body (form data)
    const request_data = await request.json();
    
    console.log('MQTT Test Request received:', {
      host: request_data.host,
      port: request_data.port,
      use_ssl: request_data.use_ssl,
      username: request_data.username ? '[PROVIDED]' : '[NOT PROVIDED]',
      password: request_data.password ? '[PROVIDED]' : '[NOT PROVIDED]'
    });
    
    // Validate required fields
    if (!request_data.host || !request_data.port) {
      console.log('❌ Missing required fields');
      return NextResponse.json({
        success: false,
        error: 'Host y puerto son requeridos para probar la conexión MQTT'
      }, { status: 400 });
    }

    // Import mqtt dynamically to avoid issues if not installed
    let mqtt: any;
    try {
      mqtt = await import('mqtt');
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'MQTT client no disponible. Para usar MQTT, instale: npm install mqtt'
      }, { status: 500 });
    }

    // Build connection URL
    const protocol = request_data.use_ssl ? 'mqtts' : 'mqtt';
    const connection_url = `${protocol}://${request_data.host}:${request_data.port}`;

    // Build connection options
    const connection_options: any = {
      connectTimeout: 10000, // Aumentar timeout a 10 segundos
      reconnectPeriod: 0, // Disable reconnection for test
      clean: true, // Clean session
      clientId: `exalinkhub_test_${Date.now()}` // Unique client ID
    };

    // Add authentication if provided
    if (request_data.username && request_data.password) {
      connection_options.username = request_data.username;
      connection_options.password = request_data.password;
    }

    console.log('Testing MQTT connection:', {
      url: connection_url,
      options: { ...connection_options, password: connection_options.password ? '[HIDDEN]' : undefined }
    });

    // Create test promise
    const test_promise = new Promise((resolve, reject) => {
      let connection_resolved = false;
      
      const client = mqtt.connect(connection_url, connection_options);
      
      const timeout = setTimeout(() => {
        if (!connection_resolved) {
          connection_resolved = true;
          client.end(true);
          reject(new Error('Timeout de conexión (10 segundos)'));
        }
      }, 10000);

      client.on('connect', () => {
        if (!connection_resolved) {
          console.log('MQTT connection successful');
          connection_resolved = true;
          clearTimeout(timeout);
          client.end(true);
          resolve({
            success: true,
            message: 'Conexión MQTT exitosa'
          });
        }
      });

      client.on('error', (error: any) => {
        if (!connection_resolved) {
          console.error('MQTT connection error:', error);
          connection_resolved = true;
          clearTimeout(timeout);
          client.end(true);
          
          // Mejor manejo de errores específicos
          let error_message = error.message || 'Error desconocido';
          if (error.code === 'ECONNREFUSED') {
            error_message = 'Conexión rechazada. Verifique que el broker MQTT esté funcionando.';
          } else if (error.code === 'ENOTFOUND') {
            error_message = 'Host no encontrado. Verifique la dirección del broker MQTT.';
          } else if (error.code === 'ECONNRESET') {
            error_message = 'Conexión reiniciada por el broker. Verifique las credenciales.';
          } else if (error.code === 4) {
            error_message = 'Credenciales incorrectas. Verifique usuario y contraseña.';
          } else if (error.code === 5) {
            error_message = 'No autorizado. Verifique permisos del usuario MQTT.';
          }
          
          reject(new Error(error_message));
        }
      });

      client.on('offline', () => {
        if (!connection_resolved) {
          console.log('MQTT broker offline');
          connection_resolved = true;
          clearTimeout(timeout);
          client.end(true);
          reject(new Error('Broker MQTT offline o no disponible'));
        }
      });

      client.on('close', () => {
        console.log('MQTT connection closed');
      });

      client.on('disconnect', () => {
        console.log('MQTT disconnected');
      });
    });

    const result = await test_promise;
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error testing MQTT connection:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Error desconocido al probar conexión MQTT'
    }, { status: 500 });
  }
}

/**
 * Gets current MQTT connection status
 * @param {NextRequest} request - The incoming request  
 * @returns {Promise<NextResponse>} Current MQTT status
 */
export async function GET(request: NextRequest) {
  try {
    const config_db = getConfigDatabase();
    const backend_config = config_db.getConsolidatedBackendConfig();
    
    if (!backend_config.mqtt_enabled) {
      return NextResponse.json({
        status: 'disabled',
        message: 'MQTT deshabilitado'
      });
    }

    if (!backend_config.mqtt_host || !backend_config.mqtt_port) {
      return NextResponse.json({
        status: 'error',
        message: 'Configuración incompleta'
      });
    }

    // For now, return configured status
    // In the future, this could maintain a persistent connection status
    return NextResponse.json({
      status: 'configured',
      message: 'MQTT configurado',
      config: {
        host: backend_config.mqtt_host,
        port: backend_config.mqtt_port,
        use_ssl: backend_config.mqtt_use_ssl,
        has_auth: !!(backend_config.mqtt_username && backend_config.mqtt_password)
      }
    });

  } catch (error: any) {
    console.error('Error getting MQTT status:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Error al obtener estado MQTT'
    }, { status: 500 });
  }
}