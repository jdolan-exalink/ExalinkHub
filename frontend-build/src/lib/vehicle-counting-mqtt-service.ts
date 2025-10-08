/**
 * Servicio MQTT para Conteo Vehicular IN/OUT
 * Procesa eventos de Frigate para detectar transiciones entre zonas IN y OUT
 */

import mqtt from 'mqtt';
import { getVehicleCountingDatabase } from './vehicle-counting-database';
import type { VehicleZoneConfig } from './vehicle-counting-database';

interface FrigateEvent {
  before?: {
    id: string;
    label: string;
    current_zones: string[];
    entered_zones: string[];
    score: number;
  };
  after?: {
    id: string;
    label: string;
    current_zones: string[];
    entered_zones: string[];
    score: number;
  };
  type: string;
  camera: string;
}

class VehicleCountingMqttService {
  private client: mqtt.MqttClient | null = null;
  private db = getVehicleCountingDatabase();
  private zone_configs: VehicleZoneConfig[] = [];
  private object_states: Map<string, {
    camera: string;
    object_type: string;
    current_zones: string[];
    last_seen: Date;
  }> = new Map();

  // Configuración de debounce para evitar eventos duplicados
  private debounce_time = 5000; // 5 segundos
  private recent_transitions: Map<string, Date> = new Map();

  constructor(
    private mqtt_host: string = 'localhost',
    private mqtt_port: number = 1883,
    private mqtt_username?: string,
    private mqtt_password?: string,
    private topic_prefix: string = 'frigate'
  ) {
    this.load_zone_configs();
  }

  /**
   * Carga las configuraciones de zonas habilitadas desde la base de datos
   */
  private load_zone_configs() {
    this.zone_configs = this.db.get_enabled_zone_configs();
    console.log(`🚗 Cargadas ${this.zone_configs.length} configuraciones de zonas vehiculares`);
  }

  /**
   * Inicia la conexión MQTT y suscripciones
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const client_options: mqtt.IClientOptions = {
        host: this.mqtt_host,
        port: this.mqtt_port,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
      };

      if (this.mqtt_username && this.mqtt_password) {
        client_options.username = this.mqtt_username;
        client_options.password = this.mqtt_password;
      }

      this.client = mqtt.connect(client_options);

      this.client.on('connect', () => {
        console.log('🚗 Servicio MQTT de conteo vehicular conectado');
        
        // Suscribirse a eventos de Frigate
        const event_topic = `${this.topic_prefix}/events`;
        this.client!.subscribe(event_topic, (err) => {
          if (err) {
            console.error('Error suscribiéndose a topic de eventos:', err);
            reject(err);
          } else {
            console.log(`📡 Suscrito a: ${event_topic}`);
            resolve();
          }
        });
      });

      this.client.on('message', (topic, message) => {
        this.handle_message(topic, message);
      });

      this.client.on('error', (error) => {
        console.error('Error MQTT conteo vehicular:', error);
        reject(error);
      });

      this.client.on('offline', () => {
        console.log('🔌 Servicio MQTT de conteo vehicular desconectado');
      });
    });
  }

  /**
   * Procesa mensajes MQTT recibidos
   */
  private handle_message(topic: string, message: Buffer) {
    try {
      if (topic.endsWith('/events')) {
        const event: FrigateEvent = JSON.parse(message.toString());
        this.process_frigate_event(event);
      }
    } catch (error) {
      console.error('Error procesando mensaje MQTT vehicular:', error);
    }
  }

  /**
   * Procesa un evento de Frigate para detectar transiciones vehiculares
   */
  private process_frigate_event(event: FrigateEvent) {
    if (!event.after || !event.before) return;
    
    const { after, before, camera } = event;
    
    // Solo procesar objetos vehiculares
    const vehicle_types = ['car', 'truck', 'motorcycle', 'bus', 'bicycle'];
    if (!vehicle_types.includes(after.label)) return;

    // Buscar configuraciones de zonas para esta cámara
    const camera_configs = this.zone_configs.filter(config => config.camera_name === camera);
    if (camera_configs.length === 0) return;

    // Actualizar estado del objeto
    this.object_states.set(after.id, {
      camera: camera,
      object_type: after.label,
      current_zones: after.current_zones,
      last_seen: new Date()
    });

    // Procesar transiciones para cada configuración de zona
    for (const config of camera_configs) {
      this.process_zone_transition(config, before, after);
    }

    // Limpiar estados antiguos (objetos no vistos en los últimos 30 segundos)
    this.cleanup_old_object_states();
  }

  /**
   * Procesa transiciones entre zonas IN y OUT para una configuración específica
   */
  private process_zone_transition(
    config: VehicleZoneConfig,
    before: FrigateEvent['before'],
    after: FrigateEvent['after']
  ) {
    if (!before || !after) return;

    const { zone_in, zone_out } = config;
    const object_id = after.id;
    const object_type = after.label;
    const confidence = after.score;

    // Verificar transición IN (objeto entra a zona IN)
    if (!before.current_zones.includes(zone_in) && after.current_zones.includes(zone_in)) {
      this.record_transition(config, object_id, object_type, 'in', confidence, zone_in);
    }

    // Verificar transición OUT (objeto entra a zona OUT)
    if (!before.current_zones.includes(zone_out) && after.current_zones.includes(zone_out)) {
      this.record_transition(config, object_id, object_type, 'out', confidence, zone_out);
    }
  }

  /**
   * Registra una transición en la base de datos con debounce
   */
  private record_transition(
    config: VehicleZoneConfig,
    object_id: string,
    object_type: string,
    transition_type: 'in' | 'out',
    confidence: number,
    zone_name: string
  ) {
    // Crear clave única para debounce
    const debounce_key = `${config.id}-${object_id}-${transition_type}`;
    const now = new Date();

    // Verificar debounce
    const last_transition = this.recent_transitions.get(debounce_key);
    if (last_transition && (now.getTime() - last_transition.getTime()) < this.debounce_time) {
      return; // Ignorar transición duplicada
    }

    // Registrar transición en la base de datos
    const event_id = this.db.insert_transition_event(
      config.camera_name,
      config.id,
      object_id,
      object_type,
      transition_type,
      confidence,
      zone_name
    );

    if (event_id) {
      console.log(`🚗 Transición vehicular registrada: ${config.camera_name} - ${object_type} ${transition_type.toUpperCase()} (ID: ${event_id})`);
      
      // Actualizar debounce
      this.recent_transitions.set(debounce_key, now);
      
      // Limpiar entradas antiguas de debounce
      this.cleanup_debounce_cache();
    }
  }

  /**
   * Limpia estados de objetos que no se han visto recientemente
   */
  private cleanup_old_object_states() {
    const cutoff_time = new Date(Date.now() - 30000); // 30 segundos
    
    for (const [object_id, state] of this.object_states.entries()) {
      if (state.last_seen < cutoff_time) {
        this.object_states.delete(object_id);
      }
    }
  }

  /**
   * Limpia entradas antiguas del caché de debounce
   */
  private cleanup_debounce_cache() {
    const cutoff_time = new Date(Date.now() - this.debounce_time * 2);
    
    for (const [key, timestamp] of this.recent_transitions.entries()) {
      if (timestamp < cutoff_time) {
        this.recent_transitions.delete(key);
      }
    }
  }

  /**
   * Recarga las configuraciones de zonas desde la base de datos
   */
  reload_zone_configs() {
    this.load_zone_configs();
    console.log('🔄 Configuraciones de zonas vehiculares recargadas');
  }

  /**
   * Obtiene estadísticas actuales del servicio
   */
  get_service_stats() {
    return {
      connected: this.client?.connected || false,
      zone_configs_loaded: this.zone_configs.length,
      active_objects: this.object_states.size,
      recent_transitions: this.recent_transitions.size,
      uptime: process.uptime()
    };
  }

  /**
   * Detiene el servicio MQTT
   */
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.end(true, {}, () => {
          console.log('🚗 Servicio MQTT de conteo vehicular detenido');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Singleton instance
let vehicleMqttServiceInstance: VehicleCountingMqttService | null = null;

/**
 * Obtiene la instancia singleton del servicio MQTT vehicular
 */
export function getVehicleCountingMqttService(
  mqtt_host?: string,
  mqtt_port?: number,
  mqtt_username?: string,
  mqtt_password?: string,
  topic_prefix?: string
): VehicleCountingMqttService {
  if (!vehicleMqttServiceInstance) {
    vehicleMqttServiceInstance = new VehicleCountingMqttService(
      mqtt_host,
      mqtt_port,
      mqtt_username,
      mqtt_password,
      topic_prefix
    );
  }
  return vehicleMqttServiceInstance;
}

export default VehicleCountingMqttService;