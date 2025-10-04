/**
 * Script para crear vistas predefinidas estándar VMS
 * Ejecutar: node scripts/create-predefined-views.js
 */

const Database = require('better-sqlite3');
const path = require('path');

// Conectar a la base de datos
const db_path = path.join(__dirname, '..', 'DB', 'views.db');
const db = new Database(db_path);

// Inicializar tablas si no existen
db.exec(`
  CREATE TABLE IF NOT EXISTS saved_views (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    layout TEXT NOT NULL,
    cameras TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Definir vistas predefinidas estándar VMS
const predefined_views = [
  {
    name: "📺 Vista Completa",
    layout: "1x1",
    description: "Una sola cámara en pantalla completa - ideal para monitoreo detallado",
    cameras: JSON.stringify([
      { id: 0, camera: null }
    ])
  },
  {
    name: "🏠 Vista Quad - Perímetro", 
    layout: "2x2",
    description: "4 cámaras principales del perímetro de la propiedad",
    cameras: JSON.stringify([
      { id: 0, camera: null },
      { id: 1, camera: null },
      { id: 2, camera: null },
      { id: 3, camera: null }
    ])
  },
  {
    name: "🚗 Vista Accesos",
    layout: "2x2", 
    description: "Cámaras enfocadas en entradas y salidas",
    cameras: JSON.stringify([
      { id: 0, camera: null }, // Portones
      { id: 1, camera: null }, // Ingreso
      { id: 2, camera: null }, // Cochera
      { id: 3, camera: null }  // Patio
    ])
  },
  {
    name: "👁️ Vista Panorámica",
    layout: "3x3",
    description: "9 cámaras para supervisión general",
    cameras: JSON.stringify([
      { id: 0, camera: null },
      { id: 1, camera: null },
      { id: 2, camera: null },
      { id: 3, camera: null },
      { id: 4, camera: null },
      { id: 5, camera: null },
      { id: 6, camera: null },
      { id: 7, camera: null },
      { id: 8, camera: null }
    ])
  },
  {
    name: "🎯 Vista Detallada",
    layout: "1+5",
    description: "Una cámara principal grande + 5 auxiliares pequeñas",
    cameras: JSON.stringify([
      { id: 0, camera: null }, // Cámara principal grande
      { id: 1, camera: null },
      { id: 2, camera: null }, 
      { id: 3, camera: null },
      { id: 4, camera: null },
      { id: 5, camera: null }
    ])
  },
  {
    name: "📊 Vista Comando",
    layout: "1+12", 
    description: "Una cámara principal + 12 cámaras de monitoreo",
    cameras: JSON.stringify([
      { id: 0, camera: null }, // Cámara principal
      { id: 1, camera: null },
      { id: 2, camera: null },
      { id: 3, camera: null },
      { id: 4, camera: null },
      { id: 5, camera: null },
      { id: 6, camera: null },
      { id: 7, camera: null },
      { id: 8, camera: null },
      { id: 9, camera: null },
      { id: 10, camera: null },
      { id: 11, camera: null },
      { id: 12, camera: null }
    ])
  },
  {
    name: "🏢 Vista Matriz",
    layout: "4x4",
    description: "16 cámaras en matriz - ideal para centros de control",
    cameras: JSON.stringify(
      Array.from({ length: 16 }, (_, index) => ({ 
        id: index, 
        camera: null 
      }))
    )
  }
];

// Función para insertar vistas predefinidas
function insert_predefined_views() {
  const insert_stmt = db.prepare(`
    INSERT OR REPLACE INTO saved_views (name, layout, cameras) 
    VALUES (?, ?, ?)
  `);

  console.log('🔄 Creando vistas predefinidas...\n');

  predefined_views.forEach((view, index) => {
    try {
      insert_stmt.run(view.name, view.layout, view.cameras);
      console.log(`✅ ${index + 1}. ${view.name}`);
      console.log(`   Layout: ${view.layout}`);
      console.log(`   ${view.description}\n`);
    } catch (error) {
      console.log(`❌ Error creando vista "${view.name}":`, error.message);
    }
  });

  console.log('✨ Vistas predefinidas creadas exitosamente!');
  console.log('\n📋 Resumen:');
  
  // Mostrar todas las vistas guardadas
  const all_views = db.prepare('SELECT name, layout FROM saved_views ORDER BY id').all();
  all_views.forEach((view, index) => {
    console.log(`   ${index + 1}. ${view.name} (${view.layout})`);
  });
}

// Ejecutar script
try {
  insert_predefined_views();
} catch (error) {
  console.error('❌ Error ejecutando script:', error);
} finally {
  db.close();
  console.log('\n🔒 Base de datos cerrada.');
}