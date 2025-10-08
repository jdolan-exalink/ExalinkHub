/**
 * Script para verificar la nueva estructura de base de datos del sistema de conteo
 * y poblar con datos de ejemplo para testing
 */

const Database = require('better-sqlite3');
const path = require('path');

// Conectar a la base de datos de conteo
const db_path = path.join(__dirname, 'DB', 'counting.db');
const db = new Database(db_path);

console.log('🔍 Verificando estructura de base de datos de conteo...');

try {
  // Verificar que las nuevas tablas existen
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
  console.log('\nTablas disponibles:');
  tables.forEach(table => {
    console.log(`  - ${table.name}`);
  });

  // Verificar estructura de tabla areas
  console.log('\n📍 Estructura de tabla "areas":');
  const areas_structure = db.prepare("PRAGMA table_info(areas)").all();
  areas_structure.forEach(col => {
    console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
  });

  // Verificar estructura de tabla access_points
  console.log('\n🚪 Estructura de tabla "access_points":');
  const access_points_structure = db.prepare("PRAGMA table_info(access_points)").all();
  access_points_structure.forEach(col => {
    console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
  });

  // Verificar estructura de tabla counting_events
  console.log('\n📊 Estructura de tabla "counting_events":');
  const events_structure = db.prepare("PRAGMA table_info(counting_events)").all();
  events_structure.forEach(col => {
    console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.pk ? 'PRIMARY KEY' : ''}`);
  });

  // Verificar datos de ejemplo
  console.log('\n📋 Datos de áreas:');
  const areas = db.prepare("SELECT * FROM areas").all();
  areas.forEach(area => {
    console.log(`  ${area.id}: ${area.nombre} (${area.tipo}) - ${area.estado_actual}/${area.max_ocupacion} [${area.color_estado}]`);
  });

  console.log('\n🚪 Datos de puntos de acceso:');
  const access_points = db.prepare(`
    SELECT ap.*, a.nombre as area_nombre 
    FROM access_points ap 
    JOIN areas a ON ap.area_id = a.id
  `).all();
  access_points.forEach(ap => {
    console.log(`  ${ap.id}: ${ap.fuente_id} -> ${ap.area_nombre} (${ap.direccion})`);
  });

  console.log('\n📊 Datos de eventos de conteo:');
  const events = db.prepare("SELECT * FROM counting_events ORDER BY ts DESC LIMIT 10").all();
  if (events.length > 0) {
    events.forEach(event => {
      console.log(`  ${event.id}: Area ${event.area_id} - ${event.tipo} (${event.valor}) [${event.fuente}]`);
    });
  } else {
    console.log('  (No hay eventos de conteo aún)');
  }

  // Insertar algunos eventos de prueba
  console.log('\n🧪 Insertando eventos de prueba...');
  
  const now = new Date().toISOString();
  const one_hour_ago = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  // Obtener ID de primera área
  const first_area = areas[0];
  if (first_area) {
    // Insertar algunos eventos de prueba
    const insert_event = db.prepare(`
      INSERT INTO counting_events (area_id, tipo, valor, fuente, ts, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const test_events = [
      {
        area_id: first_area.id,
        tipo: 'enter',
        valor: 1,
        fuente: 'CAM-001',
        ts: one_hour_ago,
        metadata: JSON.stringify({ test: true, source: 'manual_test' })
      },
      {
        area_id: first_area.id,
        tipo: 'exit',
        valor: -1,
        fuente: 'CAM-001',
        ts: now,
        metadata: JSON.stringify({ test: true, source: 'manual_test' })
      }
    ];

    test_events.forEach(event => {
      try {
        insert_event.run(event.area_id, event.tipo, event.valor, event.fuente, event.ts, event.metadata);
        console.log(`  ✅ Evento ${event.tipo} insertado para área ${event.area_id}`);
      } catch (err) {
        console.log(`  ⚠️ Error insertando evento: ${err.message}`);
      }
    });

    // Actualizar ocupación del área
    const update_area = db.prepare('UPDATE areas SET estado_actual = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    update_area.run(0, first_area.id); // Reset a 0 después de entrada y salida
    
    console.log(`  ✅ Ocupación del área ${first_area.nombre} actualizada`);
  }

  // Insertar una medición de prueba
  console.log('\n📈 Insertando medición de prueba...');
  if (first_area) {
    const insert_measurement = db.prepare(`
      INSERT INTO measurements (area_id, ocupacion_actual, densidad, ts)
      VALUES (?, ?, ?, ?)
    `);

    try {
      insert_measurement.run(first_area.id, 5, 0.05, now);
      console.log(`  ✅ Medición insertada para área ${first_area.nombre}`);
    } catch (err) {
      console.log(`  ⚠️ Error insertando medición: ${err.message}`);
    }
  }

  // Verificar configuración
  console.log('\n⚙️ Configuración actual:');
  const config = db.prepare("SELECT * FROM conteo_configuracion ORDER BY id DESC LIMIT 1").get();
  if (config) {
    console.log(`  Enabled: ${config.enabled}`);
    console.log(`  MQTT: ${config.mqtt_host}:${config.mqtt_port}`);
    console.log(`  Topic: ${config.mqtt_topic}`);
    console.log(`  Mode: ${config.operation_mode}`);
    console.log(`  Objects: ${config.objects}`);
    console.log(`  Active: ${config.active_objects}`);
    console.log(`  Confidence: ${config.confidence_threshold}`);
    console.log(`  Retention: ${config.retention_days} days`);
  } else {
    console.log('  (No hay configuración)');
  }

  console.log('\n✅ Verificación completada exitosamente!');

} catch (error) {
  console.error('❌ Error verificando base de datos:', error);
} finally {
  db.close();
}