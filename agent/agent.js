const express = require('express');
const axios = require('axios');
const si = require('systeminformation');
const fs = require('fs');
const path = require('path');

// Load configuration
const configPath = path.join(__dirname, 'config.json');
let config;

try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('Failed to load config.json:', error);
  process.exit(1);
}

const app = express();
app.use(express.json());

// Middleware to verify requests from control server
function verifyToken(req, res, next) {
  const token = req.headers['x-control-token'];
  
  if (!token || token !== config.agentToken) {
    console.warn('Unauthorized access attempt');
    return res.status(403).json({ error: 'Invalid or missing token' });
  }
  
  next();
}

// Public health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// System information endpoints (all require auth)
app.get('/system/info', verifyToken, async (req, res) => {
  try {
    const [cpu, cpuLoad, mem, osInfo, disk, network] = await Promise.all([
      si.cpu(),
      si.currentLoad(),
      si.mem(),
      si.osInfo(),
      si.fsSize(),
      si.networkInterfaces()
    ]);

    // Enrich CPU data with current load
    const cpuData = {
      ...cpu,
      load: cpuLoad.currentLoad || 0,
      loadIdle: cpuLoad.currentLoadIdle || 0
    };

    // Enrich memory data with calculated percentage
    const memoryData = {
      ...mem,
      used: mem.used || 0,
      total: mem.total || 0,
      free: mem.free || 0,
      usedPercent: mem.total > 0 ? ((mem.used / mem.total) * 100).toFixed(2) : '0'
    };

    // Ensure disk data has proper structure
    const diskData = disk.map(d => ({
      ...d,
      used: d.used || 0,
      size: d.size || 0,
      use: d.use || 0
    }));

    res.json({ 
      cpu: cpuData, 
      memory: memoryData, 
      os: osInfo, 
      disk: diskData, 
      network 
    });
  } catch (error) {
    console.error('System info error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/system/cpu', verifyToken, async (req, res) => {
  try {
    const [currentLoad, cpuTemp] = await Promise.all([
      si.currentLoad(),
      si.cpuTemperature().catch(() => ({ main: null }))
    ]);

    res.json({ 
      load: {
        currentLoad: currentLoad.currentLoad || 0,
        currentLoadIdle: currentLoad.currentLoadIdle || 0,
        currentLoadUser: currentLoad.currentLoadUser || 0,
        currentLoadSystem: currentLoad.currentLoadSystem || 0
      },
      temperature: cpuTemp
    });
  } catch (error) {
    console.error('CPU info error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/system/memory', verifyToken, async (req, res) => {
  try {
    const mem = await si.mem();
    
    // Ensure all values are properly set with defaults
    const memoryData = {
      total: mem.total || 0,
      free: mem.free || 0,
      used: mem.used || 0,
      active: mem.active || 0,
      available: mem.available || 0,
      buffers: mem.buffers || 0,
      cached: mem.cached || 0,
      slab: mem.slab || 0,
      buffcache: mem.buffcache || 0,
      swaptotal: mem.swaptotal || 0,
      swapused: mem.swapused || 0,
      swapfree: mem.swapfree || 0,
      usedPercent: mem.total > 0 ? ((mem.used / mem.total) * 100).toFixed(2) : '0'
    };
    
    res.json(memoryData);
  } catch (error) {
    console.error('Memory info error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/system/disk', verifyToken, async (req, res) => {
  try {
    const [fsSize, diskLayout, blockDevices] = await Promise.all([
      si.fsSize(),
      si.diskLayout(),
      si.blockDevices()
    ]);

    // Ensure disk data has proper structure with defaults
    const filesystems = fsSize.map(fs => ({
      fs: fs.fs || 'unknown',
      type: fs.type || 'unknown',
      size: fs.size || 0,
      used: fs.used || 0,
      available: fs.available || 0,
      use: fs.use || 0,
      mount: fs.mount || 'unknown'
    }));

    res.json({ 
      filesystems, 
      layout: diskLayout,
      devices: blockDevices
    });
  } catch (error) {
    console.error('Disk info error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/system/network', verifyToken, async (req, res) => {
  try {
    const [interfaces, stats, connections] = await Promise.all([
      si.networkInterfaces(),
      si.networkStats(),
      si.networkConnections().catch(() => [])
    ]);

    res.json({ 
      interfaces, 
      stats,
      connections: connections.slice(0, 100) // Limit connections
    });
  } catch (error) {
    console.error('Network info error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/system/gpu', verifyToken, async (req, res) => {
  try {
    const graphics = await si.graphics();
    res.json(graphics);
  } catch (error) {
    console.error('GPU info error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/ports', verifyToken, async (req, res) => {
  try {
    const connections = await si.networkConnections();
    
    // Extract listening ports
    const listeningPorts = connections
      .filter(conn => conn.state === 'LISTEN')
      .map(conn => ({
        port: conn.localPort,
        protocol: conn.protocol,
        process: conn.process
      }));

    res.json({ ports: listeningPorts });
  } catch (error) {
    console.error('Ports info error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Discovery functions for screen sessions and open ports
async function discoverScreenSessions() {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execPromise = promisify(exec);

    const { stdout, stderr } = await execPromise('screen -ls 2>&1 || true');
    const sessions = [];

    console.log('[Discovery] Running: screen -ls');
    console.log('[Discovery] Screen output:', stdout.substring(0, 200));

    // Parse screen -ls output
    // Example: "1234.session-name (Detached)"
    const lines = stdout.split('\n');
    for (const line of lines) {
      const match = line.match(/\s+(\d+)\.(\S+)\s+\((\w+)\)/);
      if (match) {
        const [, screenId, name, state] = match;
        
        // Try to get owner user (usually in the line or from process)
        let user = null;
        try {
          const psResult = await execPromise(`ps -p ${screenId} -o user= 2>/dev/null || echo unknown`);
          user = psResult.stdout.trim();
        } catch (e) {
          user = 'unknown';
        }

        sessions.push({
          screen_id: screenId,
          name: name,
          state: state.toLowerCase(),
          user: user,
          started_at: null // screen -ls doesn't provide this easily
        });
      }
    }

    return sessions;
  } catch (error) {
    console.error('[Discovery] Error discovering screen sessions:', error.message);
    return [];
  }
}

async function discoverOpenPorts() {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execPromise = promisify(exec);

    // Try ss first (modern), fallback to netstat
    let stdout;
    try {
      const result = await execPromise('ss -tulpen 2>/dev/null');
      stdout = result.stdout;
      console.log('[Discovery] Using ss command, found', stdout.split('\n').length, 'lines');
    } catch (e) {
      console.log('[Discovery] ss failed, trying netstat');
      // Fallback to netstat
      const result = await execPromise('netstat -tulpen 2>/dev/null || netstat -tuln 2>/dev/null');
      stdout = result.stdout;
      console.log('[Discovery] Using netstat, found', stdout.split('\n').length, 'lines');
    }

    const ports = [];
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      // Skip header lines
      if (line.includes('State') || line.includes('Proto') || line.trim() === '') {
        continue;
      }

      // Parse ss output format
      // tcp   LISTEN 0      128          0.0.0.0:22           0.0.0.0:*    users:(("sshd",pid=1234,fd=3))
      const ssMatch = line.match(/(tcp|udp)\s+LISTEN\s+\S+\s+\S+\s+(\S+):(\d+)\s+.*users:\(\("([^"]+)",pid=(\d+)/);
      if (ssMatch) {
        const [, protocol, address, port, process, pid] = ssMatch;
        ports.push({
          port: parseInt(port),
          protocol: protocol,
          address: address === '*' ? '0.0.0.0' : address,
          pid: parseInt(pid),
          process: process,
          user: null // will try to get user from pid
        });
        continue;
      }

      // Parse netstat output format
      // tcp        0      0 0.0.0.0:22              0.0.0.0:*               LISTEN      1234/sshd
      const netstatMatch = line.match(/(tcp|udp)\s+\S+\s+\S+\s+(\S+):(\d+)\s+\S+\s+LISTEN\s+(\d+)\/(\S+)/);
      if (netstatMatch) {
        const [, protocol, address, port, pid, process] = netstatMatch;
        ports.push({
          port: parseInt(port),
          protocol: protocol,
          address: address === '*' ? '0.0.0.0' : address,
          pid: parseInt(pid),
          process: process,
          user: null
        });
      }
    }

    console.log('[Discovery] Parsed', ports.length, 'listening ports');

    // Get user for each process
    for (const port of ports) {
      if (port.pid) {
        try {
          const { stdout } = await execPromise(`ps -p ${port.pid} -o user= 2>/dev/null || echo unknown`);
          port.user = stdout.trim();
        } catch (e) {
          port.user = 'unknown';
        }
      }
    }

    return ports;
  } catch (error) {
    console.error('[Discovery] Error discovering open ports:', error.message);
    return [];
  }
}

app.get('/services', verifyToken, async (req, res) => {
  try {
    const services = await si.services('*');
    res.json({ services });
  } catch (error) {
    console.error('Services info error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Action endpoints
app.post('/action/shutdown', verifyToken, (req, res) => {
  console.log('Shutdown command received');
  res.json({ success: true, message: 'Shutdown initiated' });
  
  // Delay shutdown to allow response to be sent
  setTimeout(() => {
    require('child_process').exec('shutdown -h now', (error) => {
      if (error) {
        console.error('Shutdown error:', error);
      }
    });
  }, 1000);
});

app.post('/action/reboot', verifyToken, (req, res) => {
  console.log('Reboot command received');
  res.json({ success: true, message: 'Reboot initiated' });
  
  setTimeout(() => {
    require('child_process').exec('reboot', (error) => {
      if (error) {
        console.error('Reboot error:', error);
      }
    });
  }, 1000);
});

app.post('/action/shell', verifyToken, (req, res) => {
  const { command } = req.body;

  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  // Security: whitelist allowed commands
  const allowedCommands = ['ls', 'ps', 'df', 'free', 'uptime', 'whoami'];
  const cmdParts = command.trim().split(' ');
  const baseCommand = cmdParts[0];

  if (!allowedCommands.includes(baseCommand)) {
    return res.status(403).json({ error: 'Command not allowed' });
  }

  console.log('Executing shell command:', command);

  require('child_process').exec(command, { timeout: 5000 }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ 
        error: error.message,
        stderr: stderr 
      });
    }

    res.json({ 
      success: true,
      stdout: stdout,
      stderr: stderr
    });
  });
});

// Heartbeat function - sends regular updates to control server
async function sendHeartbeat() {
  try {
    const [cpu, cpuLoad, mem, osInfo, graphics] = await Promise.all([
      si.cpu(),
      si.currentLoad(),
      si.mem(),
      si.osInfo(),
      si.graphics().catch(() => ({ controllers: [] }))
    ]);

    // Prepare hardware info with GPU if available
    const hardwareInfo = {
      cpu: {
        manufacturer: cpu.manufacturer || 'Unknown',
        brand: cpu.brand || 'Unknown',
        cores: cpu.cores || 0,
        physicalCores: cpu.physicalCores || 0,
        processors: cpu.processors || 0,
        speed: cpu.speed || 0,
        speedMax: cpu.speedMax || 0,
        speedMin: cpu.speedMin || 0
      },
      memory: {
        total: mem.total || 0,
        used: mem.used || 0,
        free: mem.free || 0,
        type: 'RAM'
      }
    };

    // Add GPU info if available
    if (graphics.controllers && graphics.controllers.length > 0) {
      const gpu = graphics.controllers[0];
      hardwareInfo.gpu = {
        vendor: gpu.vendor,
        model: gpu.model,
        vram: gpu.vram,
        vramDynamic: gpu.vramDynamic
      };
    }

    const response = await axios.post(
      `${config.controlServer}/api/agents/heartbeat`,
      {
        system_info: {
          os: {
            platform: osInfo.platform,
            distro: osInfo.distro,
            release: osInfo.release,
            kernel: osInfo.kernel,
            arch: osInfo.arch,
            hostname: osInfo.hostname
          },
          hardware: hardwareInfo
        },
        metrics: {
          cpu: {
            load: cpuLoad.currentLoad || 0,
            idle: cpuLoad.currentLoadIdle || 0
          },
          memory: {
            used: mem.used || 0,
            free: mem.free || 0,
            available: mem.available || 0,
            active: mem.active || 0,
            total: mem.total || 0,
            usedPercent: mem.total > 0 ? ((mem.used / mem.total) * 100).toFixed(2) : '0'
          }
        }
      },
      {
        headers: { 
          'x-agent-token': config.agentToken,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    console.log('Heartbeat sent successfully');
  } catch (error) {
    console.error('Heartbeat error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('Cannot reach control server at', config.controlServer);
    }
  }
}

// Start HTTP server
const PORT = config.port || 7777;

app.listen(PORT, '0.0.0.0', async () => {
  console.log('╔═══════════════════════════════════════╗');
  console.log('║     AtlasNode Agent Started           ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(`Port: ${PORT}`);
  console.log(`Control Server: ${config.controlServer}`);
  console.log(`Machine ID: ${config.machineId}`);
  console.log('');

  // Send initial registration
  try {
    const systemInfo = await si.osInfo();
    
    const response = await axios.post(
      `${config.controlServer}/api/agents/register`,
      {
        machine_id: config.machineId,
        agent_token: config.agentToken,
        system_info: {
          platform: systemInfo.platform,
          distro: systemInfo.distro,
          release: systemInfo.release,
          hostname: systemInfo.hostname
        }
      },
      {
        timeout: 10000
      }
    );

    console.log('✓ Registered with control server:', response.data.message);
  } catch (error) {
    console.error('✗ Failed to register with control server:', error.message);
  }

  // Start heartbeat interval
  const heartbeatInterval = config.heartbeatInterval || 60000;
  console.log(`Starting heartbeat every ${heartbeatInterval / 1000}s`);
  
  setInterval(sendHeartbeat, heartbeatInterval);
  
  // Send first heartbeat after 5 seconds
  setTimeout(sendHeartbeat, 5000);

  // Start discovery reporting (every 30 seconds)
  const discoveryInterval = 30000;
  console.log(`Starting discovery reporting every ${discoveryInterval / 1000}s`);
  
  async function sendDiscoveryData() {
    try {
      // Discover and send screen sessions
      const screens = await discoverScreenSessions();
      console.log(`[Discovery] Found ${screens.length} screen sessions`);
      if (screens.length > 0) {
        console.log(`[Discovery] Sessions:`, screens.map(s => `${s.screen_id}.${s.name}`).join(', '));
      }
      if (screens.length >= 0) { // Send even if empty to mark stale sessions
        await axios.post(
          `${config.controlServer}/api/discovery/screens`,
          { screens },
          {
            headers: { 'x-agent-token': config.agentToken },
            timeout: 10000
          }
        );
        console.log(`[Discovery] ✓ Sent ${screens.length} screen sessions`);
      }

      // Discover and send open ports
      const ports = await discoverOpenPorts();
      console.log(`[Discovery] Found ${ports.length} open ports`);
      if (ports.length > 0) {
        console.log(`[Discovery] Ports:`, ports.map(p => `${p.port}/${p.protocol}`).join(', '));
      }
      if (ports.length >= 0) { // Send even if empty to mark stale ports
        await axios.post(
          `${config.controlServer}/api/discovery/ports`,
          { ports },
          {
            headers: { 'x-agent-token': config.agentToken },
            timeout: 10000
          }
        );
        console.log(`[Discovery] ✓ Sent ${ports.length} open ports`);
      }
    } catch (error) {
      console.error('[Discovery] Error:', error.message);
      if (error.response) {
        console.error('[Discovery] Response:', error.response.status, error.response.data);
      }
    }
  }

  setInterval(sendDiscoveryData, discoveryInterval);
  
  // Send first discovery after 10 seconds
  setTimeout(sendDiscoveryData, 10000);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

