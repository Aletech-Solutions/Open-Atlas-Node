const express = require('express');
const { Client } = require('ssh2');
const pty = require('node-pty');
const db = require('../database');
const { logAudit } = require('../utils/audit');
const crypto = require('crypto');

const router = express.Router();
const activeSessions = new Map(); // sessionId -> { conn, stream, machineId, createdAt }

// Cleanup old sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 60 * 60 * 1000; // 1 hour
  
  activeSessions.forEach((session, sessionId) => {
    if (now - session.createdAt.getTime() > maxAge) {
      console.log(`Cleaning up old terminal session: ${sessionId}`);
      try {
        session.stream.end();
        session.conn.end();
      } catch (err) {
        console.error('Error cleaning up session:', err);
      }
      activeSessions.delete(sessionId);
    }
  });
}, 5 * 60 * 1000);

// Create SSH terminal session
router.post('/create/:machineId', async (req, res) => {
  try {
    const { machineId } = req.params;

    // Get machine details
    const result = await db.query(`
      SELECT m.*, sc.auth_method, sc.encrypted_password, sc.encrypted_private_key
      FROM machines m
      LEFT JOIN ssh_credentials sc ON m.id = sc.machine_id
      WHERE m.id = $1
    `, [machineId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    const machine = result.rows[0];
    
    // Check if machine credentials exist
    if (!machine.auth_method) {
      return res.status(400).json({ error: 'No SSH credentials configured for this machine' });
    }
    
    const sessionId = crypto.randomBytes(16).toString('hex');

    // Decrypt credentials
    const credentials = decryptCredentials(machine);
    
    if (!credentials.password && !credentials.privateKey) {
      return res.status(400).json({ error: 'Failed to decrypt SSH credentials' });
    }

    // Create SSH connection with Promise
    const conn = new Client();
    let responseHandled = false;

    const config = {
      host: machine.ip_address,
      port: machine.ssh_port,
      username: machine.ssh_username,
      readyTimeout: 30000
    };

    if (machine.auth_method === 'password') {
      config.password = credentials.password;
    } else {
      config.privateKey = credentials.privateKey;
    }

    conn.on('ready', () => {
      conn.shell({ term: 'xterm-256color' }, (err, stream) => {
        if (err) {
          console.error('SSH shell error:', err);
          conn.end();
          if (!responseHandled) {
            responseHandled = true;
            return res.status(500).json({ error: 'Failed to create shell' });
          }
          return;
        }

        activeSessions.set(sessionId, { 
          conn, 
          stream, 
          machineId,
          createdAt: new Date()
        });

        // Setup stream error handling
        stream.on('error', (streamErr) => {
          console.error('Stream error:', streamErr);
          if (activeSessions.has(sessionId)) {
            const session = activeSessions.get(sessionId);
            session.conn.end();
            activeSessions.delete(sessionId);
          }
        });

        stream.on('close', () => {
          console.log(`Terminal session ${sessionId} closed`);
          if (activeSessions.has(sessionId)) {
            const session = activeSessions.get(sessionId);
            session.conn.end();
            activeSessions.delete(sessionId);
          }
        });

        // Log audit
        logAudit(req.user.id, machineId, 'terminal_session_created').catch(err => {
          console.error('Audit log error:', err);
        });

        if (!responseHandled) {
          responseHandled = true;
          res.json({ 
            sessionId,
            message: 'Terminal session created'
          });
        }
      });
    });

    conn.on('error', (err) => {
      console.error('SSH connection error:', err);
      if (!responseHandled) {
        responseHandled = true;
        res.status(500).json({ 
          error: 'SSH connection failed',
          details: err.message 
        });
      }
    });

    conn.on('close', () => {
      if (activeSessions.has(sessionId)) {
        activeSessions.delete(sessionId);
      }
    });

    conn.connect(config);

  } catch (error) {
    console.error('Terminal creation error:', error);
    res.status(500).json({ error: 'Failed to create terminal session' });
  }
});

// Send command to terminal
router.post('/write/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { data } = req.body;

    if (!activeSessions.has(sessionId)) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = activeSessions.get(sessionId);
    session.stream.write(data);

    res.json({ success: true });
  } catch (error) {
    console.error('Terminal write error:', error);
    res.status(500).json({ error: 'Failed to write to terminal' });
  }
});

// Read from terminal (SSE)
router.get('/read/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!activeSessions.has(sessionId)) {
      console.error(`Terminal read: Session ${sessionId} not found`);
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = activeSessions.get(sessionId);

    // Setup SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    
    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

    // Data handler
    const dataHandler = (data) => {
      try {
        res.write(`data: ${JSON.stringify({ data: data.toString('base64') })}\n\n`);
      } catch (err) {
        console.error('Error writing SSE data:', err);
      }
    };

    // Close handler
    const closeHandler = () => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'close' })}\n\n`);
        res.end();
      } catch (err) {
        console.error('Error closing SSE:', err);
      }
    };

    // Error handler
    const errorHandler = (err) => {
      console.error('Stream error in SSE:', err);
      try {
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
        res.end();
      } catch (writeErr) {
        console.error('Error writing SSE error:', writeErr);
      }
    };

    session.stream.on('data', dataHandler);
    session.stream.on('close', closeHandler);
    session.stream.on('error', errorHandler);

    // Keep-alive ping every 30 seconds
    const keepAliveInterval = setInterval(() => {
      try {
        res.write(`:ping\n\n`);
      } catch (err) {
        console.error('Keep-alive error:', err);
        clearInterval(keepAliveInterval);
      }
    }, 30000);

    // Client disconnected
    req.on('close', () => {
      console.log(`SSE client disconnected for session ${sessionId}`);
      clearInterval(keepAliveInterval);
      session.stream.removeListener('data', dataHandler);
      session.stream.removeListener('close', closeHandler);
      session.stream.removeListener('error', errorHandler);
    });

  } catch (error) {
    console.error('Terminal read error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to read from terminal' });
    }
  }
});

// Close terminal session
router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!activeSessions.has(sessionId)) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = activeSessions.get(sessionId);
    session.stream.end();
    session.conn.end();
    
    await logAudit(req.user.id, session.machineId, 'terminal_session_closed');
    
    activeSessions.delete(sessionId);

    res.json({ message: 'Terminal session closed' });
  } catch (error) {
    console.error('Terminal close error:', error);
    res.status(500).json({ error: 'Failed to close terminal session' });
  }
});

// Resize terminal
router.post('/resize/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const { rows, cols } = req.body;

    if (!activeSessions.has(sessionId)) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const session = activeSessions.get(sessionId);
    session.stream.setWindow(rows, cols);

    res.json({ success: true });
  } catch (error) {
    console.error('Terminal resize error:', error);
    res.status(500).json({ error: 'Failed to resize terminal' });
  }
});

function decryptCredentials(machine) {
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(process.env.JWT_SECRET).slice(0, 32);

  const credentials = {};

  if (machine.auth_method === 'password' && machine.encrypted_password) {
    const parts = machine.encrypted_password.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    credentials.password = decrypted;
  }

  if (machine.auth_method === 'key' && machine.encrypted_private_key) {
    const parts = machine.encrypted_private_key.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    credentials.privateKey = decrypted;
  }

  return credentials;
}

module.exports = router;

