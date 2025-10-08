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
    entered_zones?: string[];
    exited_zones?: string[];
  };
  after?: {
    id?: string;
    camera?: string;
    label?: string;
    start_time?: number;
    end_time?: number;
    zones?: string[];
    score?: number;
    entered_zones?: string[];
    exited_zones?: string[];
  };
}

// Interface para eventos de conteo normalizados
interface NormalizedCountingEvent {
  area_ref: string;
  tipo: 'enter' | 'exit';
  valor: number;
  fuente: string;
  ts: string;
  metadata?: any;
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
      
      // Solo procesar eventos de tipo 'new' o 'update' para detectar transiciones enter/exit
      if (!['new', 'update'].includes(event.type)) {
        return;
      }

      // Usar 'after' para obtener los datos del evento actual
      const event_data = event.after;
      const event_before = event.before;
      
      if (!event_data) {
        return;
      }

      this.process_frigate_event(event_data, event_before);

    } catch (error) {
      console.error('📊 Counting MQTT: Error processing message:', error);
    }
  }

  /**
   * Procesa un evento de Frigate según la especificación técnica
   * Detecta transiciones entered_zones/exited_zones y las convierte en eventos de conteo
   */
  private async process_frigate_event(event_data: any, event_before?: any): Promise<void> {
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
        entered_zones = [],
        exited_zones = [],
        score,
        timestamp
      } = event_data;

      // Validar datos requeridos
      if (!id || !camera || !label) {
        return;
      }

      // Filtrar solo objetos relevantes (person o car según especificación)
      const relevant_labels = ['person', 'car', 'truck', 'motorcycle', 'bicycle', 'bus'];
      if (!relevant_labels.includes(label.toLowerCase())) {
        return;
      }

      // Traducir etiqueta de inglés a español
      const translated_label = LABEL_TRANSLATION[label.toLowerCase()] || label;

      // Verificar que la etiqueta traducida esté en los objetos activos
      const active_objects = JSON.parse(config.active_objects);
      if (!active_objects.includes(translated_label)) {
        return;
      }

      // Verificar umbral de confianza
      if (score && score < config.confidence_threshold) {
        return;
      }

      // Obtener todas las áreas activas
      const active_areas = counting_db.get_all_areas().filter(area => area.enabled);
      
      // Procesar entered_zones (entradas)
      for (const zone of entered_zones) {
        await this.process_zone_transition(
          counting_db,
          zone,
          'enter',
          camera,
          translated_label,
          timestamp,
          active_areas,
          { event_id: id, confidence: score }
        );
      }

      // Procesar exited_zones (salidas)
      for (const zone of exited_zones) {
        await this.process_zone_transition(
          counting_db,
          zone,
          'exit',
          camera,
          translated_label,
          timestamp,
          active_areas,
          { event_id: id, confidence: score }
        );
      }

    } catch (error) {
      console.error('📊 Error processing Frigate event:', error);
    }
  }

  /**
   * Procesa una transición de zona (entrada/salida)
   */
  private async process_zone_transition(
    counting_db: CountingDatabase,
    zone_name: string,
    tipo: 'enter' | 'exit',
    camera: string,
    label: string,
    timestamp: number,
    active_areas: any[],
    metadata: any
  ): Promise<void> {
    try {
      // Buscar área que corresponde a esta zona
      // Las zonas se mapean a áreas a través de los access_points
      const access_points = counting_db.query_all_statement(`
        SELECT ap.*, a.nombre as area_nombre, a.tipo as area_tipo, a.id as area_id
        FROM access_points ap
        JOIN areas a ON ap.area_id = a.id
        WHERE ap.fuente_id = ? AND ap.enabled = 1 AND a.enabled = 1
      `, [zone_name]);

      if (access_points.length === 0) {
        // Si no hay un access_point configurado para esta zona, ignorar
        return;
      }

      for (const access_point of access_points) {
        // Verificar que el tipo de objeto coincida con el tipo de área
        const area_accepts_object = this.area_accepts_object_type(access_point.area_tipo, label);
        if (!area_accepts_object) {
          continue;
        }

        // Aplicar de-bounce temporal (500-1000ms)
        if (await this.is_duplicate_event(counting_db, access_point.area_id, tipo, metadata.event_id)) {
          console.log(`📊 Duplicate event detected, skipping: ${metadata.event_id}`);
          continue;
        }

        // Determinar valor del evento basado en dirección del access_point
        let valor = 0;
        if ((tipo === 'enter' && access_point.direccion === 'entrada') || 
            (tipo === 'exit' && access_point.direccion === 'salida')) {
          valor = 1; // Entrada al área
        } else if ((tipo === 'exit' && access_point.direccion === 'entrada') || 
                   (tipo === 'enter' && access_point.direccion === 'salida')) {
          valor = -1; // Salida del área
        }

        if (valor === 0) {
          continue; // No es una transición relevante
        }

        // Crear evento de conteo normalizado
        const normalized_event: NormalizedCountingEvent = {
          area_ref: access_point.area_nombre,
          tipo: valor > 0 ? 'enter' : 'exit',
          valor: valor,
          fuente: camera,
          ts: new Date((timestamp || Date.now() / 1000) * 1000).toISOString(),
          metadata: {
            zone_name,
            original_label: label,
            confidence: metadata.confidence,
            frigate_event_id: metadata.event_id,
            access_point_id: access_point.id
          }
        };

        // Insertar evento en la base de datos
        const event_id = counting_db.insert_counting_event({
          area_id: access_point.area_id,
          tipo: normalized_event.tipo,
          valor: normalized_event.valor,
          fuente: normalized_event.fuente,
          ts: normalized_event.ts,
          metadata: JSON.stringify(normalized_event.metadata)
        });

        if (event_id) {
          console.log('📊 Counting event processed:', {
            area: normalized_event.area_ref,
            tipo: normalized_event.tipo,
            valor: normalized_event.valor,
            fuente: normalized_event.fuente,
            zone: zone_name
          });

          // Verificar umbrales y generar alertas si es necesario
          await this.check_occupancy_thresholds(counting_db, access_point.area_id);
        }
      }

    } catch (error) {
      console.error('📊 Error processing zone transition:', error);
    }
  }

  /**
   * Verifica si un área acepta un tipo específico de objeto
   */
  private area_accepts_object_type(area_tipo: string, object_label: string): boolean {
    const person_objects = ['personas', 'person'];
    const vehicle_objects = ['auto', 'car', 'camión', 'truck', 'moto', 'motorcycle', 'bicicleta', 'bicycle', 'autobús', 'bus'];

    if (area_tipo === 'personas') {
      return person_objects.includes(object_label);
    } else if (area_tipo === 'vehiculos') {
      return vehicle_objects.includes(object_label);
    }

    return false;
  }

  /**
   * Verifica si un evento es duplicado para evitar doble conteo
   */
  private async is_duplicate_event(
    counting_db: CountingDatabase,
    area_id: number,
    tipo: 'enter' | 'exit',
    event_id: string
  ): Promise<boolean> {
    // Verificar eventos de los últimos 1000ms con el mismo event_id
    const cutoff_time = new Date(Date.now() - 1000).toISOString();
    
    const duplicate = counting_db.query_statement(`
      SELECT COUNT(*) as count 
      FROM counting_events 
      WHERE area_id = ? AND tipo = ? AND ts >= ? AND JSON_EXTRACT(metadata, '$.frigate_event_id') = ?
    `, [area_id, tipo, cutoff_time, event_id]);

    return duplicate && duplicate.count > 0;
  }

  /**
   * Verifica umbrales de ocupación y genera alertas
   */
  private async check_occupancy_thresholds(counting_db: CountingDatabase, area_id: number): Promise<void> {
    try {
      const area = counting_db.get_area_by_id(area_id);
      if (!area) return;

      const current_ocupacion = area.estado_actual;
      const max_ocupacion = area.max_ocupacion;
      const percentage = (current_ocupacion / max_ocupacion) * 100;

      // Generar alertas según umbrales
      if (percentage >= 100) {
        // Límite excedido
        counting_db.insert_counting_event({
          area_id: area_id,
          tipo: 'exceeded',
          valor: 0,
          fuente: 'system',
          ts: new Date().toISOString(),
          metadata: JSON.stringify({
            current_ocupacion,
            max_ocupacion,
            percentage: Math.round(percentage),
            alert_type: 'exceeded'
          })
        });

        console.log(`🚨 Area ${area.nombre}: Límite excedido (${current_ocupacion}/${max_ocupacion})`);
      } else if (percentage >= 80) {
        // Warning threshold
        counting_db.insert_counting_event({
          area_id: area_id,
          tipo: 'warning',
          valor: 0,
          fuente: 'system',
          ts: new Date().toISOString(),
          metadata: JSON.stringify({
            current_ocupacion,
            max_ocupacion,
            percentage: Math.round(percentage),
            alert_type: 'warning'
          })
        });

        console.log(`⚠️ Area ${area.nombre}: Warning de ocupación (${current_ocupacion}/${max_ocupacion})`);
      }

    } catch (error) {
      console.error('📊 Error checking occupancy thresholds:', error);
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