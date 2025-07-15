// =================================================================
//                      DÉPENDANCES ET SETUP
// =================================================================
const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');

// Configuration des constantes de l'application
const API_PORT = 3001;
const LOCUST_URL = 'http://localhost:8089';
const PROMETHEUS_URL = 'http://localhost:9090';
const DB_FILE = './loadtest_history.db';

// Initialisation de l'application Express
const app = express();
app.use(cors());
app.use(express.json());

// Création du serveur HTTP unique pour Express et le WebSocket
const server = http.createServer(app);
const wss = new WebSocketServer({ server }); // Attacher le WebSocket au serveur Express

// =================================================================
//                  GESTION DE LA BASE DE DONNÉES (SQLITE)
// =================================================================

const db = new sqlite3.Database(DB_FILE, (err) => {
  if (err) {
    console.error("Erreur de connexion à la base de données:", err.message);
  } else {
    console.log('Connecté à la base de données SQLite.');
    db.run(`CREATE TABLE IF NOT EXISTS tests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'stopped', 'failed')),
      start_time DATETIME,
      end_time DATETIME,
      target_url TEXT,
      users INTEGER,
      spawn_rate REAL,
      duration INTEGER,
      avg_response_time REAL,
      requests_per_second REAL,
      error_rate REAL,
      total_requests INTEGER,
      total_failures INTEGER
    )`);
  }
});

// =================================================================
//            GESTION DES WEBSOCKETS POUR LA COMMUNICATION TEMPS RÉEL
// =================================================================

const clients = new Set();
let statsPollingInterval = null;

wss.on('connection', (ws) => {
  console.log('Client WebSocket connecté');
  clients.add(ws);

  ws.on('close', () => {
    console.log('Client WebSocket déconnecté');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('Erreur WebSocket:', error);
  });

  // Envoyer le statut de connexion initial
  ws.send(JSON.stringify({ type: 'connection', status: 'connected' }));
});

function broadcast(data) {
  const jsonData = JSON.stringify(data);
  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      client.send(jsonData);
    }
  }
}

// =================================================================
//                     LOGIQUE MÉTIER (LOCUST)
// =================================================================

function startStatsPolling(testId) {
  if (statsPollingInterval) {
    clearInterval(statsPollingInterval);
  }

  statsPollingInterval = setInterval(async () => {
    try {
      const response = await axios.get(`${LOCUST_URL}/stats/requests`);
      const stats = response.data;
      broadcast({ type: 'stats_update', stats });

      if (stats.state === 'stopped' || stats.state === 'spawning_complete') {
        const test = await getTestFromDb(testId);
        if (test && test.status === 'running') {
            await stopTestInternal(testId, 'completed', stats);
        }
      }
    } catch (error) {
      // Si Locust ne répond pas, on ne stoppe pas le polling pour permettre une reconnexion
      console.error('Erreur lors de la récupération des stats Locust:', error.message);
      broadcast({ type: 'locust_error', message: 'Impossible de joindre Locust.' });
    }
  }, 2000);
}

function stopStatsPolling() {
  if (statsPollingInterval) {
    clearInterval(statsPollingInterval);
    statsPollingInterval = null;
  }
}

async function stopTestInternal(testId, finalStatus, finalStats = null) {
    stopStatsPolling();
    const endTime = new Date().toISOString();
    let statsToSave = {};

    if (!finalStats) {
        try {
            const response = await axios.get(`${LOCUST_URL}/stats/requests`);
            finalStats = response.data;
        } catch (error) {
            console.error("Impossible de récupérer les stats finales.", error.message);
        }
    }
    
    if (finalStats && finalStats.stats) {
        const aggregated = finalStats.stats.find(s => s.name === 'Aggregated');
        if (aggregated) {
            statsToSave = {
                avg_response_time: aggregated.avg_response_time,
                requests_per_second: aggregated.total_rps,
                error_rate: aggregated.num_requests > 0 ? (aggregated.num_failures / aggregated.total_requests) * 100 : 0,
                total_requests: aggregated.num_requests,
                total_failures: aggregated.num_failures
            };
        }
    }

    const query = `
      UPDATE tests 
      SET status = ?, end_time = ?, avg_response_time = ?, requests_per_second = ?, error_rate = ?, total_requests = ?, total_failures = ?
      WHERE id = ? AND status = 'running'
    `;
    db.run(query, [finalStatus, endTime, ...Object.values(statsToSave), testId]);

    const eventType = finalStatus === 'completed' ? 'test_completed' : 'test_stopped';
    broadcast({ type: eventType, testId });
}

function getTestFromDb(testId) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM tests WHERE id = ?', [testId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// =================================================================
//                      ROUTES DE L'API (EXPRESS)
// =================================================================

app.post('/api/tests/start', async (req, res) => {
  const { name, targetUrl, users, spawnRate, duration } = req.body;
  
  try {
    const payload = new URLSearchParams({ user_count: users, spawn_rate: spawnRate, host: targetUrl });
    await axios.post(`${LOCUST_URL}/swarm`, payload);

    const startTime = new Date().toISOString();
    const query = `INSERT INTO tests (name, status, start_time, target_url, users, spawn_rate, duration) VALUES (?, 'running', ?, ?, ?, ?, ?)`;
    db.run(query, [name, startTime, targetUrl, users, spawnRate, duration], function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Erreur base de données.' });
      
      const testId = this.lastID;
      if (duration > 0) {
        setTimeout(() => axios.get(`${LOCUST_URL}/stop`), duration * 1000);
      }

      startStatsPolling(testId);
      broadcast({ type: 'test_started', testId, name });
      res.json({ success: true, testId });
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur communication avec Locust.' });
  }
});

app.post('/api/tests/stop', (req, res) => {
  db.get("SELECT id FROM tests WHERE status = 'running' ORDER BY start_time DESC LIMIT 1", async (err, row) => {
    if (!row) return res.status(404).json({ success: false, message: 'Aucun test en cours.' });
    
    try {
      await axios.get(`${LOCUST_URL}/stop`);
      await stopTestInternal(row.id, 'stopped');
      res.json({ success: true, message: 'Test arrêté.' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Erreur communication avec Locust.' });
    }
  });
});

app.get('/api/tests/current', (req, res) => {
  db.get("SELECT * FROM tests WHERE status = 'running' ORDER BY start_time DESC LIMIT 1", async (err, row) => {
    if (row) {
      try {
        const response = await axios.get(`${LOCUST_URL}/stats/requests`);
        res.json({ running: true, testId: row.id, name: row.name, stats: response.data });
      } catch (e) {
        res.json({ running: true, testId: row.id, name: row.name, stats: null });
      }
    } else {
      res.json({ running: false });
    }
  });
});

app.get('/api/tests/history', (req, res) => {
  db.all("SELECT * FROM tests ORDER BY start_time DESC", (err, rows) => {
    res.json(rows || []);
  });
});

// =================================================================
//         PROXY POUR PROMETHEUS & LOCUST
// =================================================================

app.get('/api/metrics/query', async (req, res) => {
  try {
    const response = await axios.get(`${PROMETHEUS_URL}/api/v1/query`, { params: req.query });
    res.json(response.data);
  } catch (error) {
    res.status(502).json({ error: 'Erreur communication avec Prometheus.' });
  }
});

app.get('/api/locust/stats', async (req, res) => {
  try {
    const response = await axios.get(`${LOCUST_URL}/stats/requests`);
    res.json(response.data);
  } catch (error) {
    res.status(502).json({ error: 'Erreur communication avec Locust.' });
  }
});


// =================================================================
//                      DÉMARRAGE DU SERVEUR
// =================================================================

server.listen(API_PORT, () => {
  console.log(`🚀 Serveur API et WebSocket démarré sur http://localhost:${API_PORT}`);
});