const axios = require('axios');
const db = require('../database');

async function executeAction(machineId, action, params = {}) {
  try {
    // Get machine details
    const result = await db.query(
      'SELECT id, name, ip_address, agent_port, agent_token, status FROM machines WHERE id = $1',
      [machineId]
    );

    if (result.rows.length === 0) {
      throw new Error('Machine not found');
    }

    const machine = result.rows[0];

    if (machine.status !== 'online') {
      throw new Error('Machine is not online');
    }

    if (!machine.agent_token) {
      throw new Error('Machine agent not configured');
    }

    const agentUrl = `http://${machine.ip_address}:${machine.agent_port}`;

    // Map action to agent endpoint
    let endpoint;
    let method = 'POST';

    switch (action) {
      case 'shutdown':
        endpoint = '/action/shutdown';
        break;
      case 'reboot':
        endpoint = '/action/reboot';
        break;
      case 'shell':
        endpoint = '/action/shell';
        break;
      case 'get_cpu':
        endpoint = '/system/cpu';
        method = 'GET';
        break;
      case 'get_memory':
        endpoint = '/system/memory';
        method = 'GET';
        break;
      case 'get_disk':
        endpoint = '/system/disk';
        method = 'GET';
        break;
      case 'get_network':
        endpoint = '/system/network';
        method = 'GET';
        break;
      case 'get_info':
        endpoint = '/system/info';
        method = 'GET';
        break;
      default:
        throw new Error('Unknown action');
    }

    // Make request to agent
    const response = await axios({
      method,
      url: agentUrl + endpoint,
      data: params,
      headers: {
        'x-control-token': machine.agent_token
      },
      timeout: 10000
    });

    return response.data;

  } catch (error) {
    console.error(`Agent communication error for machine ${machineId}:`, error);
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      // Mark machine as offline
      await db.query(
        'UPDATE machines SET status = $1 WHERE id = $2',
        ['offline', machineId]
      );
      throw new Error('Cannot reach agent - machine may be offline');
    }

    throw error;
  }
}

async function getSystemMetrics(machineId) {
  try {
    const [cpu, memory, disk, network] = await Promise.all([
      executeAction(machineId, 'get_cpu'),
      executeAction(machineId, 'get_memory'),
      executeAction(machineId, 'get_disk'),
      executeAction(machineId, 'get_network')
    ]);

    return { cpu, memory, disk, network };
  } catch (error) {
    console.error('Error fetching system metrics:', error);
    throw error;
  }
}

module.exports = {
  executeAction,
  getSystemMetrics
};

