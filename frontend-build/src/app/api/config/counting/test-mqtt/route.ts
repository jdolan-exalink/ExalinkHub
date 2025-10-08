/**
 * API de prueba de conexión MQTT para el módulo de conteo
 * 
 * Permite probar la conectividad MQTT independientemente del módulo LPR,
 * siguiendo la misma estructura pero específico para conteo.
 * 
 * POST /api/config/counting/test-mqtt - Probar conexión MQTT para conteo
 * GET /api/config/counting/test-mqtt - Estado actual de conexión MQTT
 */

import { NextRequest, NextResponse } from 'next/server';
import { get_counting_database } from '@/lib/counting-database';

/**
 * Prueba la conexión MQTT para el módulo de conteo
 * @param {NextRequest} request - The incoming request
 * @returns {Promise<NextResponse>} Resultado de la prueba de conexión
 */
export async function POST(request: NextRequest) {
  try {
    const request_data = await request.json();
    
    console.log('Counting MQTT Test Request received:', {
      host: request_data.host,
      port: request_data.port,
      use_ssl: request_data.use_ssl,
      username: request_data.username ? '[PROVIDED]' : '[NOT PROVIDED]',
      password: request_data.password ? '[PROVIDED]' : '[NOT PROVIDED]',
      topic: request_data.topic || 'frigate/events'
    });
    
    // Validar campos requeridos
    if (!request_data.host || !request_data.port) {
      console.log('❌ Missing required fields for counting MQTT test');
      return NextResponse.json({
        success: false,
        error: 'Host y puerto son requeridos para probar la conexión MQTT del conteo'
      }, { status: 400 });
    }

    // Importar mqtt dinámicamente
    let mqtt: any;
    try {
      mqtt = await import('mqtt');
    } catch (error) {
      return NextResponse.json({
        success: false,
        error: 'Cliente MQTT no disponible. Para usar MQTT, instale: npm install mqtt'
      }, { status: 500 });
    }

    // Construir URL de conexión
    const protocol = request_data.use_ssl ? 'mqtts' : 'mqtt';
    const connection_url = `${protocol}://${request_data.host}:${request_data.port}`;

    // Opciones de conexión
    const connection_options: any = {
      connectTimeout: 10000,
      reconnectPeriod: 0,
      clean: true,
      clientId: `exalinkhub_counting_test_${Date.now()}`
    };

    // Agregar autenticación si se proporciona
    if (request_data.username && request_data.password) {
      connection_options.username = request_data.username;
      connection_options.password = request_data.password;
    }

    console.log('Testing counting MQTT connection:', {
      url: connection_url,
      topic: request_data.topic || 'frigate/events',
      options: { ...connection_options, password: connection_options.password ? '[HIDDEN]' : undefined }
    });

    // Crear promesa de prueba
    const test_promise = new Promise((resolve, reject) => {
      let connection_resolved = false;
      
      const client = mqtt.connect(connection_url, connection_options);
      
      const timeout = setTimeout(() => {
        if (!connection_resolved) {
          connection_resolved = true;
          client.end(true);
          reject(new Error('Timeout de conexión MQTT para conteo (10 segundos)'));
        }
      }, 10000);

      client.on('connect', () => {
        if (!connection_resolved) {
          console.log('Counting MQTT connection successful');
          connection_resolved = true;
          clearTimeout(timeout);
          
          // Probar suscripción al topic de eventos
          const test_topic = request_data.topic || 'frigate/events';
          client.subscribe(test_topic, (err: any) => {
            if (err) {
              client.end(true);
              reject(new Error(`Error al suscribirse al topic ${test_topic}: ${err.message}`));
            } else {
              client.end(true);
              resolve({
                success: true,
                message: `Conexión MQTT para conteo exitosa. Suscrito a topic: ${test_topic}`,
                details: {
                  host: request_data.host,
                  port: request_data.port,
                  topic: test_topic,
                  ssl: request_data.use_ssl
                }
              });
            }
          });
        }
      });

      client.on('error', (error: any) => {
        if (!connection_resolved) {
          console.error('Counting MQTT connection error:', error);
          connection_resolved = true;
          clearTimeout(timeout);
          client.end(true);
          
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
          console.log('Counting MQTT broker offline');
          connection_resolved = true;
          clearTimeout(timeout);
          client.end(true);
          reject(new Error('Broker MQTT offline o no disponible para conteo'));
        }
      });
    });

    const result = await test_promise;
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Error testing counting MQTT connection:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Error desconocido al probar conexión MQTT para conteo'
    }, { status: 500 });
  }
}

/**
 * Obtiene el estado actual de la conexión MQTT para conteo
 * @param {NextRequest} request - The incoming request  
 * @returns {Promise<NextResponse>} Estado actual de MQTT para conteo
 */
export async function GET(request: NextRequest) {
  try {
    const counting_db = get_counting_database();
    const config = counting_db.get_configuration();
    
    if (!config || !config.enabled) {
      return NextResponse.json({
        status: 'disabled',
        message: 'Módulo de conteo deshabilitado'
      });
    }

    if (!config.mqtt_host || !config.mqtt_port) {
      return NextResponse.json({
        status: 'not_configured',
        message: 'Configuración MQTT incompleta para conteo'
      });
    }

    return NextResponse.json({
      status: 'configured',
      message: 'MQTT configurado para conteo',
      config: {
        host: config.mqtt_host,
        port: config.mqtt_port,
        topic: config.mqtt_topic,
        has_auth: !!(config.mqtt_user && config.mqtt_pass)
      }
    });

  } catch (error: any) {
    console.error('Error getting counting MQTT status:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Error al obtener estado MQTT para conteo'
    }, { status: 500 });
  }
}