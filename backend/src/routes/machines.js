const express = require('express');
const db = require('../database');
const { requireRole } = require('../middleware/auth');
const sshInstaller = require('../services/ssh-installer');
const agentCommunicator = require('../services/agent-communicator');
const { logAudit } = require('../utils/audit');

const router = express.Router();

// Get all machines
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        m.id, m.name, m.hostname, m.ip_address, m.ssh_port, 
        m.agent_port, m.status, m.os_info, m.hardware_info, 
        m.last_seen, m.created_at,
        u.username as added_by_username
      FROM machines m
      LEFT JOIN users u ON m.added_by = u.id
      ORDER BY m.created_at DESC
    `);

    res.json({ machines: result.rows });
  } catch (error) {
    console.error('Error fetching machines:', error);
    res.status(500).json({ error: 'Failed to fetch machines' });
  }
});

// Get single machine
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT 
        m.id, m.name, m.hostname, m.ip_address, m.ssh_port, 
        m.agent_port, m.status, m.os_info, m.hardware_info, 
        m.last_seen, m.created_at,
        u.username as added_by_username
      FROM machines m
      LEFT JOIN users u ON m.added_by = u.id
      WHERE m.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    res.json({ machine: result.rows[0] });
  } catch (error) {
    console.error('Error fetching machine:', error);
    res.status(500).json({ error: 'Failed to fetch machine' });
  }
});

// Get machine error details and logs (admin only)
router.get('/:id/debug', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get machine info
    const machineResult = await db.query(
      'SELECT * FROM machines WHERE id = $1',
      [id]
    );

    if (machineResult.rows.length === 0) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    // Get audit logs for this machine
    const auditResult = await db.query(`
      SELECT 
        al.id, al.action, al.details, al.ip_address, al.created_at,
        u.username, u.email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.machine_id = $1
      ORDER BY al.created_at DESC
      LIMIT 50
    `, [id]);

    // Get recent metrics to see if agent was ever online
    const metricsResult = await db.query(`
      SELECT metric_type, timestamp
      FROM metrics
      WHERE machine_id = $1
      ORDER BY timestamp DESC
      LIMIT 10
    `, [id]);

    // Get installation logs
    const installLogsResult = await db.query(`
      SELECT stage, log_output, error_output, success, created_at
      FROM installation_logs
      WHERE machine_id = $1
      ORDER BY created_at ASC
    `, [id]);

    res.json({
      machine: machineResult.rows[0],
      audit_logs: auditResult.rows,
      recent_metrics: metricsResult.rows,
      installation_logs: installLogsResult.rows,
      has_agent_data: metricsResult.rows.length > 0
    });
  } catch (error) {
    console.error('Error fetching machine debug info:', error);
    res.status(500).json({ error: 'Failed to fetch debug information' });
  }
});

// Add new machine (admin only)
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const {
      name,
      hostname,
      ip_address,
      ssh_port = 22,
      ssh_username,
      auth_method,
      password,
      private_key,
      requires_sudo = true,
      sudo_password
    } = req.body;

    // Validation
    if (!name || !hostname || !ip_address || !ssh_username || !auth_method) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (auth_method !== 'password' && auth_method !== 'key') {
      return res.status(400).json({ error: 'Invalid auth method' });
    }

    if (auth_method === 'password' && !password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (auth_method === 'key' && !private_key) {
      return res.status(400).json({ error: 'Private key is required' });
    }

    // Insert machine
    const machineResult = await db.query(`
      INSERT INTO machines 
      (name, hostname, ip_address, ssh_port, ssh_username, status, added_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, name, hostname, ip_address, ssh_port, status
    `, [name, hostname, ip_address, ssh_port, ssh_username, 'installing', req.user.id]);

    const machine = machineResult.rows[0];

    // Store SSH credentials (encrypted)
    const crypto = require('crypto');
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.JWT_SECRET).slice(0, 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted;

    // Encrypt sudo password if provided
    let encryptedSudoPassword = null;
    if (requires_sudo && sudo_password) {
      const sudoIv = crypto.randomBytes(16);
      const sudoCipher = crypto.createCipheriv(algorithm, key, sudoIv);
      let encSudo = sudoCipher.update(sudo_password, 'utf8', 'hex');
      encSudo += sudoCipher.final('hex');
      encryptedSudoPassword = sudoIv.toString('hex') + ':' + encSudo;
    }

    if (auth_method === 'password') {
      encrypted = cipher.update(password, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      await db.query(`
        INSERT INTO ssh_credentials (machine_id, auth_method, encrypted_password, encrypted_sudo_password, requires_sudo)
        VALUES ($1, $2, $3, $4, $5)
      `, [machine.id, auth_method, iv.toString('hex') + ':' + encrypted, encryptedSudoPassword, requires_sudo]);
    } else {
      encrypted = cipher.update(private_key, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      await db.query(`
        INSERT INTO ssh_credentials (machine_id, auth_method, encrypted_private_key, encrypted_sudo_password, requires_sudo)
        VALUES ($1, $2, $3, $4, $5)
      `, [machine.id, auth_method, iv.toString('hex') + ':' + encrypted, encryptedSudoPassword, requires_sudo]);
    }

    // Log audit
    await logAudit(req.user.id, machine.id, 'machine_added', { name, hostname, ip_address });

    // Start agent installation in background
    sshInstaller.installAgent(machine.id).catch(err => {
      console.error(`Agent installation failed for machine ${machine.id}:`, err);
    });

    res.status(201).json({
      message: 'Machine added successfully. Agent installation started.',
      machine
    });
  } catch (error) {
    console.error('Error adding machine:', error);
    res.status(500).json({ error: 'Failed to add machine' });
  }
});

// Delete machine (admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get machine info before deletion
    const machineResult = await db.query(
      'SELECT name FROM machines WHERE id = $1',
      [id]
    );

    if (machineResult.rows.length === 0) {
      return res.status(404).json({ error: 'Machine not found' });
    }

    const machineName = machineResult.rows[0].name;

    // Log audit BEFORE deleting
    await logAudit(req.user.id, parseInt(id), 'machine_deleted', { name: machineName });

    // Now delete the machine
    await db.query('DELETE FROM machines WHERE id = $1', [id]);

    res.json({ message: 'Machine deleted successfully' });
  } catch (error) {
    console.error('Error deleting machine:', error);
    res.status(500).json({ error: 'Failed to delete machine' });
  }
});

// Get machine metrics
router.get('/:id/metrics', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, limit = 100 } = req.query;

    let query = `
      SELECT metric_type, metric_data, timestamp
      FROM metrics
      WHERE machine_id = $1
    `;
    const params = [id];

    if (type) {
      query += ` AND metric_type = $2`;
      params.push(type);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await db.query(query, params);

    res.json({ metrics: result.rows });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Execute action on machine (admin only)
router.post('/:id/action', requireRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { action, params } = req.body;

    if (!action) {
      return res.status(400).json({ error: 'Action is required' });
    }

    const result = await agentCommunicator.executeAction(id, action, params);

    await logAudit(req.user.id, id, 'action_executed', { action, params });

    res.json({ success: true, result });
  } catch (error) {
    console.error('Error executing action:', error);
    res.status(500).json({ error: error.message || 'Failed to execute action' });
  }
});

module.exports = router;

