import { NextRequest, NextResponse } from 'next/server';
import { getConfigDatabase } from '@/lib/config-database';
import {
  get_frigate_server_by_id,
  getFrigateHeaders as get_frigate_headers
} from '@/lib/frigate-servers';

/**
 * Verifica el estado de conectividad de MQTT y Frigate para el sistema LPR
 * @param {NextRequest} request - The incoming request
 * @returns {Promise<NextResponse>} Estado de conectividad completo
 */
export async function GET(request: NextRequest) {
  try {
    const config_db = getConfigDatabase();
    const backend_config = config_db.getConsolidatedBackendConfig();

    const status = {
      lpr_enabled: backend_config.lpr_enabled || false,
      mqtt_configured: false,
      mqtt_status: 'not_configured',
      frigate_configured: false,
      frigate_status: 'not_configured',
      system_ready: false,
      issues: [] as string[]
    };


    // Verificación real de MQTT
    if (backend_config.lpr_mqtt_host && backend_config.lpr_mqtt_port) {
      status.mqtt_configured = true;
      // Probar conexión real a MQTT
      try {
        const mqtt = require('mqtt');
        
        // Build connection URL
        const protocol = backend_config.lpr_mqtt_use_ssl ? 'mqtts' : 'mqtt';
        const connection_url = `${protocol}://${backend_config.lpr_mqtt_host}:${backend_config.lpr_mqtt_port}`;
        
        // Build connection options
        const connection_options: any = {
          connectTimeout: 5000, // 5 segundos timeout
          reconnectPeriod: 0, // Disable reconnection for test
          clean: true, // Clean session
          clientId: `exalinkhub_connectivity_test_${Date.now()}` // Unique client ID
        };

        // Add authentication if provided
        if (backend_config.lpr_mqtt_username && backend_config.lpr_mqtt_password) {
          connection_options.username = backend_config.lpr_mqtt_username;
          connection_options.password = backend_config.lpr_mqtt_password;
        }

        const client = mqtt.connect(connection_url, connection_options);
        
        await new Promise((resolve, reject) => {
          client.on('connect', () => {
            status.mqtt_status = 'online';
            client.end();
            resolve(true);
          });
          client.on('error', (err: any) => {
            status.mqtt_status = 'offline';
            status.issues.push('MQTT conexión fallida: ' + err.message);
            client.end();
            resolve(false);
          });
        });
      } catch (err: any) {
        status.mqtt_status = 'offline';
        status.issues.push('MQTT error: ' + (err?.message || 'desconocido'));
      }
    } else {
      status.issues.push('MQTT no configurado completamente');
    }

    // Verificación real de Frigate
    if (backend_config.lpr_frigate_server_id) {
      const server = get_frigate_server_by_id(backend_config.lpr_frigate_server_id);
      if (server && server.enabled) {
        status.frigate_configured = true;
        // Probar conexión real a Frigate
        try {
          const headers = get_frigate_headers(server);
          delete headers['Content-Type'];

          const response = await fetch(`${server.baseUrl}/api/version`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000),
            headers
          });
          if (response.ok) {
            status.frigate_status = 'online';
          } else {
            status.frigate_status = 'offline';
            status.issues.push('Frigate conexión fallida: ' + response.status);
          }
        } catch (err: any) {
          status.frigate_status = 'offline';
          status.issues.push('Frigate error: ' + (err?.message || 'desconocido'));
        }
      } else if (server && !server.enabled) {
        status.frigate_status = 'disabled';
        status.issues.push('Servidor Frigate deshabilitado');
      } else {
        status.frigate_status = 'invalid';
        status.issues.push('Servidor Frigate no encontrado');
      }
    } else {
      status.issues.push('Servidor Frigate no seleccionado');
    }

    // Verificar si el sistema está listo
    status.system_ready = status.lpr_enabled && 
                         status.mqtt_configured && 
                         status.frigate_configured &&
                         status.issues.length === 0;

    console.log('LPR System connectivity status:', status);

    return NextResponse.json({ 
      status: 'success',
      data: status
    });

  } catch (error: any) {
    console.error('Error checking LPR connectivity:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Error al verificar conectividad del sistema LPR',
      data: {
        lpr_enabled: false,
        mqtt_configured: false,
        mqtt_status: 'error',
        frigate_configured: false,
        frigate_status: 'error',
        system_ready: false,
        issues: ['Error interno del sistema']
      }
    }, { status: 500 });
  }
}

/**
 * Realiza una prueba completa de conectividad MQTT y Frigate
 * @param {NextRequest} request - The incoming request
 * @returns {Promise<NextResponse>} Resultado de las pruebas de conectividad
 */
export async function POST(request: NextRequest) {
  try {
    const config_db = getConfigDatabase();
    const backend_config = config_db.getConsolidatedBackendConfig();

    const test_results = {
      mqtt_test: null as any,
      frigate_test: null as any,
      overall_status: 'testing' as 'testing' | 'success' | 'partial' | 'failed',
      issues: [] as string[]
    };

    // Probar MQTT si está configurado
    if (backend_config.lpr_mqtt_host && backend_config.lpr_mqtt_port) {
      try {
        const mqtt_response = await fetch('/api/config/backend/test-mqtt', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            host: backend_config.lpr_mqtt_host,
            port: backend_config.lpr_mqtt_port,
            username: backend_config.lpr_mqtt_username,
            password: backend_config.lpr_mqtt_password,
            use_ssl: backend_config.lpr_mqtt_use_ssl,
          }),
        });

        test_results.mqtt_test = await mqtt_response.json();
      } catch (error) {
        test_results.mqtt_test = {
          success: false,
          error: 'Error al probar conexión MQTT'
        };
      }
    } else {
      test_results.mqtt_test = {
        success: false,
        error: 'MQTT no configurado'
      };
    }

    // Probar Frigate si está configurado
    if (backend_config.lpr_frigate_server_id) {
      try {
        const frigate_response = await fetch('/api/config/backend/test-frigate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            frigate_server_id: backend_config.lpr_frigate_server_id
          }),
        });

        test_results.frigate_test = await frigate_response.json();
      } catch (error) {
        test_results.frigate_test = {
          success: false,
          error: 'Error al probar conexión con Frigate'
        };
      }
    } else {
      test_results.frigate_test = {
        success: false,
        error: 'Frigate no configurado'
      };
    }

    // Determinar estado general
    const mqtt_success = test_results.mqtt_test?.success || false;
    const frigate_success = test_results.frigate_test?.success || false;

    if (mqtt_success && frigate_success) {
      test_results.overall_status = 'success';
    } else if (mqtt_success || frigate_success) {
      test_results.overall_status = 'partial';
      if (!mqtt_success) test_results.issues.push('MQTT: ' + (test_results.mqtt_test?.error || 'Conexión fallida'));
      if (!frigate_success) test_results.issues.push('Frigate: ' + (test_results.frigate_test?.error || 'Conexión fallida'));
    } else {
      test_results.overall_status = 'failed';
      test_results.issues.push('MQTT: ' + (test_results.mqtt_test?.error || 'Conexión fallida'));
      test_results.issues.push('Frigate: ' + (test_results.frigate_test?.error || 'Conexión fallida'));
    }

    console.log('LPR Connectivity test results:', test_results);

    return NextResponse.json({
      status: 'success',
      data: test_results
    });

  } catch (error: any) {
    console.error('Error testing LPR connectivity:', error);
    
    return NextResponse.json({
      status: 'error',
      message: 'Error al probar conectividad del sistema LPR'
    }, { status: 500 });
  }
}
