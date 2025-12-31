const express = require('express');
const db = require('../database');
const { authenticateAgent, authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Agent reports screen sessions
router.post('/screens', authenticateAgent, async (req, res) => {
  try {
    const { screens } = req.body;
    const machineId = req.machine.id;

    if (!Array.isArray(screens)) {
      return res.status(400).json({ error: 'screens must be an array' });
    }

    console.log(`✓ Received ${screens.length} screen sessions from machine ${machineId} (${req.machine.name})`);
    if (screens.length > 0) {
      console.log('  Screen sessions:', screens.map(s => `${s.screen_id}.${s.name} (${s.state})`).join(', '));
    }

    // Mark all sessions as stale first
    await db.query(`
      UPDATE screen_sessions 
      SET last_seen = NOW() - INTERVAL '5 minutes'
      WHERE machine_id = $1
    `, [machineId]);

    // Insert or update each screen session
    for (const screen of screens) {
      await db.query(`
        INSERT INTO screen_sessions 
        (machine_id, screen_id, name, state, owner_user, started_at, last_seen)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (machine_id, screen_id)
        DO UPDATE SET
          name = EXCLUDED.name,
          state = EXCLUDED.state,
          owner_user = EXCLUDED.owner_user,
          started_at = EXCLUDED.started_at,
          last_seen = NOW()
      `, [
        machineId,
        screen.screen_id,
        screen.name || null,
        screen.state || 'unknown',
        screen.user || null,
        screen.started_at || null
      ]);
    }

    // Delete stale sessions (not seen in this update)
    const deleteResult = await db.query(`
      DELETE FROM screen_sessions
      WHERE machine_id = $1 
      AND last_seen < NOW() - INTERVAL '2 minutes'
      RETURNING screen_id
    `, [machineId]);

    if (deleteResult.rows.length > 0) {
      console.log(`Removed ${deleteResult.rows.length} stale screen sessions from machine ${machineId}`);
    }

    res.json({ 
      success: true, 
      received: screens.length,
      removed: deleteResult.rows.length
    });
  } catch (error) {
    console.error('Screen sessions update error:', error);
    res.status(500).json({ error: 'Failed to update screen sessions' });
  }
});

// Agent reports open ports
router.post('/ports', authenticateAgent, async (req, res) => {
  try {
    const { ports } = req.body;
    const machineId = req.machine.id;

    if (!Array.isArray(ports)) {
      return res.status(400).json({ error: 'ports must be an array' });
    }

    console.log(`✓ Received ${ports.length} open ports from machine ${machineId} (${req.machine.name})`);
    if (ports.length > 0) {
      console.log('  Open ports:', ports.map(p => `${p.port}/${p.protocol} (${p.process})`).join(', '));
    }

    // Mark all ports as stale first
    await db.query(`
      UPDATE open_ports 
      SET last_seen = NOW() - INTERVAL '5 minutes'
      WHERE machine_id = $1
    `, [machineId]);

    // Insert or update each port
    for (const port of ports) {
      await db.query(`
        INSERT INTO open_ports 
        (machine_id, port, protocol, address, pid, process, owner_user, last_seen)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (machine_id, port, protocol, address)
        DO UPDATE SET
          pid = EXCLUDED.pid,
          process = EXCLUDED.process,
          owner_user = EXCLUDED.owner_user,
          last_seen = NOW()
      `, [
        machineId,
        port.port,
        port.protocol || 'tcp',
        port.address || '0.0.0.0',
        port.pid || null,
        port.process || null,
        port.user || null
      ]);
    }

    // Delete stale ports (not seen in this update)
    const deleteResult = await db.query(`
      DELETE FROM open_ports
      WHERE machine_id = $1 
      AND last_seen < NOW() - INTERVAL '2 minutes'
      RETURNING port, protocol
    `, [machineId]);

    if (deleteResult.rows.length > 0) {
      console.log(`Removed ${deleteResult.rows.length} stale ports from machine ${machineId}`);
    }

    res.json({ 
      success: true, 
      received: ports.length,
      removed: deleteResult.rows.length
    });
  } catch (error) {
    console.error('Ports update error:', error);
    res.status(500).json({ error: 'Failed to update ports' });
  }
});

// Get screen sessions for a machine
router.get('/machines/:id/screens', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT 
        id, screen_id, name, state, owner_user, 
        started_at, last_seen, created_at
      FROM screen_sessions
      WHERE machine_id = $1
      AND last_seen > NOW() - INTERVAL '5 minutes'
      ORDER BY created_at DESC
    `, [id]);

    res.json({ screens: result.rows });
  } catch (error) {
    console.error('Error fetching screen sessions:', error);
    res.status(500).json({ error: 'Failed to fetch screen sessions' });
  }
});

// Get open ports for a machine
router.get('/machines/:id/ports', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT 
        op.id, op.port, op.protocol, op.address, 
        op.pid, op.process, op.owner_user,
        op.last_seen, op.created_at,
        pl.label
      FROM open_ports op
      LEFT JOIN port_labels pl ON op.machine_id = pl.machine_id AND op.port = pl.port
      WHERE op.machine_id = $1
      AND op.last_seen > NOW() - INTERVAL '5 minutes'
      ORDER BY op.port ASC
    `, [id]);

    res.json({ ports: result.rows });
  } catch (error) {
    console.error('Error fetching open ports:', error);
    res.status(500).json({ error: 'Failed to fetch open ports' });
  }
});

// Add or update port label
router.post('/machines/:id/ports/:port/label', requireRole('admin'), async (req, res) => {
  try {
    const { id, port } = req.params;
    const { label } = req.body;

    if (!label || label.trim() === '') {
      return res.status(400).json({ error: 'Label is required' });
    }

    await db.query(`
      INSERT INTO port_labels (machine_id, port, label, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (machine_id, port)
      DO UPDATE SET
        label = EXCLUDED.label,
        updated_at = NOW()
    `, [id, port, label.trim()]);

    res.json({ success: true, message: 'Port label updated' });
  } catch (error) {
    console.error('Error updating port label:', error);
    res.status(500).json({ error: 'Failed to update port label' });
  }
});

// Delete port label
router.delete('/machines/:id/ports/:port/label', requireRole('admin'), async (req, res) => {
  try {
    const { id, port } = req.params;

    await db.query(`
      DELETE FROM port_labels
      WHERE machine_id = $1 AND port = $2
    `, [id, port]);

    res.json({ success: true, message: 'Port label deleted' });
  } catch (error) {
    console.error('Error deleting port label:', error);
    res.status(500).json({ error: 'Failed to delete port label' });
  }
});

module.exports = router;

