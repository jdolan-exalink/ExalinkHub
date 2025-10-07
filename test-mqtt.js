const mqtt_config = {
  host: 'localhost', // Cambia por tu host MQTT
  port: 1883,
  username: 'tu_usuario', // Cambia por tu usuario
  password: 'tu_password', // Cambia por tu contraseña
  use_ssl: false
};

fetch('http://localhost:9002/api/config/backend/test-mqtt', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(mqtt_config),
})
.then(response => response.json())
.then(data => {
  console.log('Response:', data);
})
.catch(error => {
  console.error('Error:', error);
});