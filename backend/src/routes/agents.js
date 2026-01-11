const express = require('express');
const db = require('../database');
const { authenticateAgent } = require('../middleware/auth');

const router = express.Router();

// Agent heartbeat endpoint
router.post('/heartbeat', authenticateAgent, async (req, res) => {
  try {
    const { system_info, metrics } = req.body;

    // Log received data for debugging
    console.log(`Heartbeat from machine ${req.machine.id}:`);
    console.log('- System Info:', system_info ? 'Present' : 'Missing');
    console.log('- Metrics:', metrics ? 'Present' : 'Missing');

    // Prepare data for JSONB storage
    const osInfo = system_info?.os ? JSON.stringify(system_info.os) : null;
    const hardwareInfo = system_info?.hardware ? JSON.stringify(system_info.hardware) : null;

    // Update machine status and info
    const result = await db.query(`
      UPDATE machines 
      SET 
        status = 'online',
        last_seen = CURRENT_TIMESTAMP,
        os_info = $1::jsonb,
        hardware_info = $2::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING name, os_info, hardware_info
    `, [osInfo, hardwareInfo, req.machine.id]);

    if (result.rows.length > 0) {
      const machine = result.rows[0];
      console.log(`✓ Machine ${machine.name} updated successfully`);
      if (system_info?.os) {
        console.log(`  - OS: ${system_info.os.platform} ${system_info.os.distro}`);
      }
      if (system_info?.hardware?.cpu) {
        console.log(`  - CPU: ${system_info.hardware.cpu.brand}`);
      }
      if (system_info?.hardware?.memory) {
        console.log(`  - RAM: ${(system_info.hardware.memory.total / 1024 / 1024 / 1024).toFixed(2)} GB`);
      }
    }

    // Optionally store metrics
    if (metrics) {
      for (const [metricType, metricData] of Object.entries(metrics)) {
        await db.query(`
          INSERT INTO metrics (machine_id, metric_type, metric_data)
          VALUES ($1, $2, $3)
        `, [req.machine.id, metricType, JSON.stringify(metricData)]);
      }
      console.log(`  - Metrics stored: ${Object.keys(metrics).join(', ')}`);
    }

    res.json({ success: true, message: 'Heartbeat received' });
  } catch (error) {
    console.error('Heartbeat error:', error);
    console.error('Heartbeat data:', JSON.stringify(req.body, null, 2));
    res.status(500).json({ error: 'Failed to process heartbeat' });
  }
});

// Agent registration confirmation
router.post('/register', async (req, res) => {
  try {
    const { machine_id, agent_token, system_info } = req.body;

    console.log(`Agent registration attempt for machine ${machine_id}`);

    if (!machine_id || !agent_token) {
      console.error('Registration failed: Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify the machine exists and token matches
    const checkResult = await db.query(`
      SELECT id, name, agent_token, status
      FROM machines 
      WHERE id = $1
    `, [machine_id]);

    if (checkResult.rows.length === 0) {
      console.error(`Registration failed: Machine ${machine_id} not found`);
      return res.status(404).json({ error: 'Machine not found' });
    }

    const machine = checkResult.rows[0];

    // Verify agent token matches
    if (machine.agent_token !== agent_token) {
      console.error(`Registration failed: Invalid agent token for machine ${machine_id}`);
      console.error(`Expected token: ${machine.agent_token?.substring(0, 8)}...`);
      console.error(`Received token: ${agent_token?.substring(0, 8)}...`);
      return res.status(403).json({ error: 'Invalid agent token' });
    }

    console.log(`✓ Token verified for machine: ${machine.name}`);

    // Prepare system_info for JSONB storage
    const osInfoJson = system_info ? JSON.stringify(system_info) : null;

    // Update machine status and info
    const result = await db.query(`
      UPDATE machines 
      SET 
        status = 'online',
        os_info = $1::jsonb,
        last_seen = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, name, status
    `, [osInfoJson, machine_id]);

    console.log(`✓ Agent registered successfully for machine: ${result.rows[0].name}`);
    if (system_info) {
      console.log(`  - OS: ${system_info.platform} ${system_info.distro}`);
    }

    res.json({ 
      success: true, 
      message: 'Agent registered successfully',
      machine: result.rows[0]
    });
  } catch (error) {
    console.error('Agent registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

module.exports = router;

