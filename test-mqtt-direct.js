// Test simple de conexión MQTT usando la librería mqtt directamente
const mqtt = require('mqtt');

// Configura aquí tus datos MQTT reales
const MQTT_CONFIG = {
  host: 'localhost',     // Cambia por tu broker MQTT
  port: 1883,
  username: 'tu_usuario', // Cambia por tu usuario (si tienes)
  password: 'tu_password' // Cambia por tu contraseña (si tienes)
};

console.log('Probando conexión MQTT...');
console.log('Configuración:', {
  host: MQTT_CONFIG.host,
  port: MQTT_CONFIG.port,
  username: MQTT_CONFIG.username ? '[CONFIGURADO]' : '[NO CONFIGURADO]',
  password: MQTT_CONFIG.password ? '[CONFIGURADO]' : '[NO CONFIGURADO]'
});

const protocol = 'mqtt'; // o 'mqtts' para SSL
const connection_url = `${protocol}://${MQTT_CONFIG.host}:${MQTT_CONFIG.port}`;

const options = {
  connectTimeout: 10000,
  reconnectPeriod: 0,
  clean: true,
  clientId: `exalinkhub_test_${Date.now()}`
};

// Solo agregar credenciales si están configuradas
if (MQTT_CONFIG.username && MQTT_CONFIG.password) {
  options.username = MQTT_CONFIG.username;
  options.password = MQTT_CONFIG.password;
}

console.log('Conectando a:', connection_url);

const client = mqtt.connect(connection_url, options);

const timeout = setTimeout(() => {
  console.log('❌ TIMEOUT: No se pudo conectar en 10 segundos');
  client.end(true);
  process.exit(1);
}, 10000);

client.on('connect', () => {
  clearTimeout(timeout);
  console.log('✅ ÉXITO: Conexión MQTT establecida correctamente');
  client.end(true);
  process.exit(0);
});

client.on('error', (error) => {
  clearTimeout(timeout);
  console.log('❌ ERROR de conexión MQTT:');
  console.log('Código:', error.code);
  console.log('Mensaje:', error.message);
  
  if (error.code === 'ECONNREFUSED') {
    console.log('💡 Sugerencia: Verifique que el broker MQTT esté funcionando en', MQTT_CONFIG.host + ':' + MQTT_CONFIG.port);
  } else if (error.code === 'ENOTFOUND') {
    console.log('💡 Sugerencia: Verifique la dirección del host:', MQTT_CONFIG.host);
  } else if (error.code === 4) {
    console.log('💡 Sugerencia: Credenciales incorrectas');
  } else if (error.code === 5) {
    console.log('💡 Sugerencia: Usuario no autorizado');
  }
  
  client.end(true);
  process.exit(1);
});

client.on('offline', () => {
  clearTimeout(timeout);
  console.log('❌ ERROR: Broker MQTT offline');
  client.end(true);
  process.exit(1);
});

console.log('Esperando conexión...');