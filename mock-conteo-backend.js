// Mock del backend de conteo para testing
const express = require('express');
const app = express();
const port = 2223;

// Middleware para JSON
app.use(express.json());

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Mock data para /api/counters
app.get('/api/counters', (req, res) => {
  console.log('📋 Respondiendo /api/counters');
  res.json({
    counters: [
      {
        id: 1,
        source_camera: "Portones",
        direction: "in"
      },
      {
        id: 2,
        source_camera: "Portones",
        direction: "out"
      }
    ]
  });
});

// Mock data para /api/counters/:id/history
app.get('/api/counters/:id/history', (req, res) => {
  const counterId = parseInt(req.params.id);
  console.log(`📊 Respondiendo /api/counters/${counterId}/history`);

  const now = new Date();

  // Generar datos históricos de las últimas 24 horas
  const history = [];
  for (let i = 0; i < 24; i++) {
    const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
    history.push({
      timestamp: timestamp.toISOString(),
      in: Math.floor(Math.random() * 10) + 1,
      out: Math.floor(Math.random() * 8) + 1
    });
  }

  res.json({
    history: history
  });
});

// Mock data para /api/summary
app.get('/api/summary', (req, res) => {
  console.log('📈 Respondiendo /api/summary');
  res.json({
    totals: [
      { label: 'auto', cnt: 45 },
      { label: 'moto', cnt: 12 },
      { label: 'bicicleta', cnt: 8 },
      { label: 'autobús', cnt: 3 },
      { label: 'personas', cnt: 25 }
    ]
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`🚀 Mock backend corriendo en http://localhost:${port}`);
  console.log(`📊 Endpoints disponibles:`);
  console.log(`   GET /api/counters`);
  console.log(`   GET /api/counters/:id/history`);
  console.log(`   GET /api/summary`);
  console.log(`   GET /health`);
  console.log(`\n💡 El servidor está listo para recibir peticiones...`);
});