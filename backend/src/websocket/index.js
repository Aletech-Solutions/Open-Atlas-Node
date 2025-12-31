const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const db = require('../database');

let wss;
const clients = new Map(); // userId -> Set of WebSocket connections

function initWebSocket(server) {
  wss = new WebSocket.Server({ 
    server,
    path: '/ws'
  });

  wss.on('connection', async (ws, req) => {
    let userId = null;

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());

        // Handle authentication
        if (data.type === 'auth') {
          const token = data.token;
          
          jwt.verify(token, process.env.JWT_SECRET, (err, payload) => {
            if (err) {
              ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
              ws.close();
              return;
            }

            userId = payload.userId;

            // Store connection
            if (!clients.has(userId)) {
              clients.set(userId, new Set());
            }
            clients.get(userId).add(ws);

            ws.send(JSON.stringify({ 
              type: 'auth_success', 
              message: 'Authenticated successfully' 
            }));

            console.log(`WebSocket client authenticated: user ${userId}`);
          });
        }

        // Handle ping/pong
        if (data.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }

      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      if (userId && clients.has(userId)) {
        clients.get(userId).delete(ws);
        if (clients.get(userId).size === 0) {
          clients.delete(userId);
        }
        console.log(`WebSocket client disconnected: user ${userId}`);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Start heartbeat monitor for machines
  startMachineMonitor();

  console.log('WebSocket server initialized');
}

// Broadcast to all connected clients
function broadcast(message) {
  if (!wss) return;

  const data = JSON.stringify(message);
  
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// Send to specific user
function sendToUser(userId, message) {
  if (!clients.has(userId)) return;

  const data = JSON.stringify(message);
  
  clients.get(userId).forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });
}

// Notify about machine status change
function notifyMachineStatus(machineId, status, data = {}) {
  broadcast({
    type: 'machine_status',
    machineId,
    status,
    data,
    timestamp: new Date().toISOString()
  });
}

// Notify about new metrics
function notifyMetrics(machineId, metrics) {
  broadcast({
    type: 'machine_metrics',
    machineId,
    metrics,
    timestamp: new Date().toISOString()
  });
}

// Monitor machine health
function startMachineMonitor() {
  setInterval(async () => {
    try {
      // Mark machines as offline if not seen in 2 minutes
      const result = await db.query(`
        UPDATE machines 
        SET status = 'offline'
        WHERE status = 'online' 
        AND last_seen < NOW() - INTERVAL '2 minutes'
        RETURNING id, name
      `);

      result.rows.forEach(machine => {
        notifyMachineStatus(machine.id, 'offline', { name: machine.name });
        console.log(`Machine ${machine.name} marked as offline`);
      });
    } catch (error) {
      console.error('Machine monitor error:', error);
    }
  }, 30000); // Check every 30 seconds
}

module.exports = {
  initWebSocket,
  broadcast,
  sendToUser,
  notifyMachineStatus,
  notifyMetrics
};

