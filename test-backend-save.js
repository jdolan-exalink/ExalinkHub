const test_config = {
  // LPR Configuration Settings
  lpr_mqtt_host: 'test.mosquitto.org',
  lpr_mqtt_port: 1883,
  lpr_mqtt_username: 'testuser',
  lpr_mqtt_password: 'testpass',
  lpr_mqtt_use_ssl: false,
  lpr_mqtt_topics_prefix: 'frigate',
  lpr_frigate_server_id: '1',
  lpr_retention_events_days: 60,
  lpr_retention_clips_days: 30,
  lpr_retention_snapshots_days: 60,
  lpr_retention_max_storage_gb: 50,
  lpr_auto_cleanup: true,
  
  // LPR Settings
  lpr_enabled: true,
  lpr_confidence_threshold: 0.8,
  lpr_max_processing_time: 30,
  lpr_regions: 'region1,region2',
  lpr_save_images: true,
  lpr_webhook_url: 'http://localhost:3000/webhook',
};

console.log('Testing backend config save...');

fetch('http://localhost:9002/api/config/backend', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(test_config),
})
.then(response => response.json())
.then(data => {
  console.log('✅ SUCCESS:', data);
})
.catch(error => {
  console.error('❌ ERROR:', error);
});