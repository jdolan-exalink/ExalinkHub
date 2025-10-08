/**
 * Servicio MQTT para el módulo de conteo de objetos
 * 
 * Cliente MQTT persistente que se conecta a Frigate para escuchar eventos,
 * procesa las detecciones, traduce etiquetas y almacena eventos válidos.
 * 
 * Funcionalidades:
 * - Conexión persistente con reconexión automática
 * - Traducción de etiquetas de inglés a español
 * - Filtrado por cámaras y objetos configurados
 * - Almacenamiento en base de datos
 * - Manejo de errores y logging
 */

import { connect, IClientOptions, MqttClient } from 'mqtt';
import { CountingDatabase, type counting_configuration, type counting_event } from './counting-database';

// Mapeo de traducción de etiquetas de inglés a español
const LABEL_TRANSLATION: Record<string, string> = {
  'car': 'auto',
  'motorcycle': 'moto',
  'bicycle': 'bicicleta',
  'bus': 'autobús',
  'person': 'personas',
  'truck': 'camión',
  'motorbike': 'moto',
  'bike': 'bicicleta'
};

interface FrigateEvent {
  type: 'new' | 'update' | 'end';
  before?: {
    id?: string;
    camera?: string;
    label?: string;
    start_time?: number;
    end_time?: number;
    zones?: string[];
    score?: number;
  };
  after?: {
    id?: string;
    camera?: string;
    label?: string;
    start_time?: number;
    end_time?: number;
    zones?: string[];
    score?: number;
  };
}

/**
 * Servicio MQTT para el módulo de conteo
 */
export class CountingMqttService {
  private client: MqttClient | null = null;
  private is_connected = false;
  private reconnect_timeout: NodeJS.Timeout | null = null;
  private connection_attempts = 0;
  private max_reconnect_attempts = 10;
  private reconnect_delay = 5000; // 5 segundos
  private is_shutting_down = false;

  constructor() {
    this.start_service();
  }

  /**
   * Inicia el servicio MQTT
   */
  private async start_service(): Promise<void> {
    try {
      const counting_db = new CountingDatabase();
      const config = counting_db.get_configuration();

      if (!config || !config.enabled) {
        console.log('📊 Counting MQTT service: Module disabled or not configured');
        return;
      }

      if (!config.mqtt_host || !config.mqtt_port) {
        console.error('📊 Counting MQTT service: Missing required configuration');
        return;
      }

      // Obtener cámaras configuradas según modo de operación
      let monitored_cameras: string[] = [];
      if (config.operation_mode === 'two_cameras') {
        monitored_cameras = [config.camera_in, config.camera_out].filter(Boolean) as string[];
      } else if (config.operation_mode === 'zones' && config.camera_zones) {
        monitored_cameras = [config.camera_zones];
      }

      console.log('📊 Starting Counting MQTT service...', {
        host: config.mqtt_host,
        port: config.mqtt_port,
        topic: config.mqtt_topic,
        operation_mode: config.operation_mode,
        cameras: monitored_cameras.length,
        active_objects: JSON.parse(config.active_objects || '["car","person"]').length
      });

      await this.connect_mqtt(config);

    } catch (error) {
      console.error('📊 Error starting Counting MQTT service:', error);
      this.schedule_reconnect();
    }
  }

  /**
   * Conecta al broker MQTT
   */
  private async connect_mqtt(config: any): Promise<void> {
    if (this.client) {
      this.client.end();
    }

    const protocol = config.mqtt_use_ssl ? 'mqtts' : 'mqtt';
    const connection_url = `${protocol}://${config.mqtt_host}:${config.mqtt_port}`;

    const options: IClientOptions = {
      connectTimeout: 30000,
      reconnectPeriod: 0, // Manejamos reconexión manualmente
      clean: true,
      clientId: `exalinkhub_counting_${Date.now()}`,
      keepalive: 60
    };

    // Agregar autenticación si está configurada
    if (config.mqtt_user && config.mqtt_pass) {
      options.username = config.mqtt_user;
      options.password = config.mqtt_pass;
    }

    this.client = connect(connection_url, options);

    this.client.on('connect', () => {
      console.log('📊 Counting MQTT: Connected successfully');
      this.is_connected = true;
      this.connection_attempts = 0;
      
      // Suscribirse al topic de eventos
      const topic = config.mqtt_topic || 'frigate/events';
      this.client?.subscribe(topic, (err: any) => {
        if (err) {
          console.error('📊 Counting MQTT: Error subscribing to topic:', err);
        } else {
          console.log(`📊 Counting MQTT: Subscribed to topic: ${topic}`);
        }
      });
    });

    this.client.on('message', (topic: string, payload: Buffer) => {
      this.handle_message(topic, payload);
    });

    this.client.on('error', (error: any) => {
      console.error('📊 Counting MQTT: Connection error:', error);
      this.is_connected = false;
      
      if (!this.is_shutting_down) {
        this.schedule_reconnect();
      }
    });

    this.client.on('close', () => {
      console.log('📊 Counting MQTT: Connection closed');
      this.is_connected = false;
      
      if (!this.is_shutting_down) {
        this.schedule_reconnect();
      }
    });

    this.client.on('offline', () => {
      console.log('📊 Counting MQTT: Client offline');
      this.is_connected = false;
    });
  }

  /**
   * Maneja los mensajes MQTT recibidos
   */
  private handle_message(topic: string, payload: Buffer): void {
    try {
      const message_str = payload.toString();
      
      // Solo procesar si es un mensaje JSON válido
      if (!message_str.startsWith('{')) {
        return;
      }

      const event: FrigateEvent = JSON.parse(message_str);
      
      // Solo procesar eventos de tipo 'end', 'new' o 'update'
      if (!['end', 'new', 'update'].includes(event.type)) {
        return;
      }

      // Usar 'after' para obtener los datos del evento
      const event_data = event.after;
      if (!event_data) {
        return;
      }

      this.process_frigate_event(event_data);

    } catch (error) {
      console.error('📊 Counting MQTT: Error processing message:', error);
    }
  }

  /**
   * Procesa un evento de Frigate
   */
  private async process_frigate_event(event_data: any): Promise<void> {
    try {
      const counting_db = new CountingDatabase();
      const config = counting_db.get_configuration();

      if (!config || !config.enabled) {
        return;
      }

      // Extraer datos del evento
      const {
        id,
        camera,
        label,
        start_time,
        end_time,
        zones = [],
        score
      } = event_data;

      // Validar datos requeridos
      if (!id || !camera || !label || !start_time) {
        return;
      }

      // Verificar que la cámara esté en la lista de cámaras monitoreadas
      // Obtener cámaras configuradas según modo de operación
      let monitored_cameras: string[] = [];
      if (config.operation_mode === 'two_cameras') {
        monitored_cameras = [config.camera_in, config.camera_out].filter(Boolean) as string[];
      } else if (config.operation_mode === 'zones' && config.camera_zones) {
        monitored_cameras = [config.camera_zones];
      }
      if (monitored_cameras.length > 0 && !monitored_cameras.includes(camera)) {
        return;
      }

      // Traducir etiqueta de inglés a español
      const translated_label = LABEL_TRANSLATION[label.toLowerCase()] || label;

      // Verificar que la etiqueta traducida esté en los objetos activos
      const active_objects = JSON.parse(config.active_objects);
      if (!active_objects.includes(translated_label)) {
        return;
      }

      // Crear evento de conteo
      const counting_event_data: counting_event = {
        id: id,
        camera: camera,
        label: translated_label,
        start_time: new Date(start_time * 1000).toISOString(),
        end_time: end_time ? new Date(end_time * 1000).toISOString() : new Date().toISOString(),
        zone: zones.length > 0 ? zones.join(',') : undefined,
        confidence: score,
        metadata: JSON.stringify({
          original_label: label,
          frigate_event_type: 'object_detection',
          processed_at: new Date().toISOString()
        })
      };

      // Insertar en la base de datos
      const success = counting_db.insert_event(counting_event_data);

      if (success) {
        console.log('📊 Counting event stored:', {
          id: counting_event_data.id,
          camera: counting_event_data.camera,
          label: translated_label,
          original_label: label,
          confidence: score
        });
      }

    } catch (error) {
      console.error('📊 Error processing Frigate event:', error);
    }
  }

  /**
   * Programa un intento de reconexión
   */
  private schedule_reconnect(): void {
    if (this.is_shutting_down || this.reconnect_timeout) {
      return;
    }

    this.connection_attempts++;

    if (this.connection_attempts > this.max_reconnect_attempts) {
      console.error('📊 Counting MQTT: Max reconnection attempts reached');
      return;
    }

    const delay = this.reconnect_delay * Math.min(this.connection_attempts, 5); // Exponential backoff limitado
    
    console.log(`📊 Counting MQTT: Scheduling reconnection attempt ${this.connection_attempts} in ${delay}ms`);

    this.reconnect_timeout = setTimeout(() => {
      this.reconnect_timeout = null;
      this.start_service();
    }, delay);
  }

  /**
   * Recarga la configuración y reinicia el servicio
   */
  async reload_configuration(): Promise<void> {
    console.log('📊 Counting MQTT: Reloading configuration...');
    await this.stop();
    await this.start_service();
  }

  /**
   * Detiene el servicio MQTT
   */
  async stop(): Promise<void> {
    this.is_shutting_down = true;

    if (this.reconnect_timeout) {
      clearTimeout(this.reconnect_timeout);
      this.reconnect_timeout = null;
    }

    if (this.client) {
      this.client.end(true);
      this.client = null;
    }

    this.is_connected = false;
    console.log('📊 Counting MQTT service stopped');
  }

  /**
   * Obtiene el estado del servicio
   */
  get_status() {
    return {
      connected: this.is_connected,
      connection_attempts: this.connection_attempts,
      max_attempts: this.max_reconnect_attempts,
      shutting_down: this.is_shutting_down
    };
  }
}

// Instancia global del servicio
let counting_mqtt_service: CountingMqttService | null = null;

/**
 * Obtiene la instancia del servicio MQTT de conteo
 */
export function get_counting_mqtt_service(): CountingMqttService {
  if (!counting_mqtt_service) {
    counting_mqtt_service = new CountingMqttService();
  }
  return counting_mqtt_service;
}

/**
 * Inicia el servicio MQTT de conteo si no está ejecutándose
 */
export function start_counting_mqtt_service(): CountingMqttService {
  return get_counting_mqtt_service();
}