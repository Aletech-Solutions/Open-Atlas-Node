// This file is used as template for agent installation
// It will be embedded into the SSH installer script
// Keep this in sync with agent/agent.js

const express = require('express');
const axios = require('axios');
const si = require('systeminformation');
const fs = require('fs');
const path = require('path');

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

function verifyToken(req, res, next) {
  const token = req.headers['x-control-token'];
  if (!token || token !== config.agentToken) {
    return res.status(403).json({ error: 'Invalid or missing token' });
  }
  next();
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/system/info', verifyToken, async (req, res) => {
  try {
    const [cpu, mem, osInfo, disk] = await Promise.all([
      si.cpu(), si.mem(), si.osInfo(), si.fsSize()
    ]);
    res.json({ cpu, memory: mem, os: osInfo, disk });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/system/cpu', verifyToken, async (req, res) => {
  try {
    const data = await si.currentLoad();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/system/memory', verifyToken, async (req, res) => {
  try {
    const data = await si.mem();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/system/disk', verifyToken, async (req, res) => {
  try {
    const data = await si.fsSize();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/system/network', verifyToken, async (req, res) => {
  try {
    const data = await si.networkStats();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/system/gpu', verifyToken, async (req, res) => {
  try {
    const graphics = await si.graphics();
    res.json(graphics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/action/shutdown', verifyToken, (req, res) => {
  res.json({ success: true, message: 'Shutdown initiated' });
  setTimeout(() => {
    require('child_process').exec('shutdown -h now');
  }, 1000);
});

app.post('/action/reboot', verifyToken, (req, res) => {
  res.json({ success: true, message: 'Reboot initiated' });
  setTimeout(() => {
    require('child_process').exec('reboot');
  }, 1000);
});

async function sendHeartbeat() {
  try {
    const [cpu, cpuLoad, mem, osInfo, graphics] = await Promise.all([
      si.cpu(),
      si.currentLoad(),
      si.mem(),
      si.osInfo(),
      si.graphics().catch(() => ({ controllers: [] }))
    ]);

    const hardwareInfo = {
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        processors: cpu.processors,
        speed: cpu.speed,
        speedMax: cpu.speedMax,
        speedMin: cpu.speedMin
      },
      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        type: 'RAM'
      }
    };

    if (graphics.controllers && graphics.controllers.length > 0) {
      const gpu = graphics.controllers[0];
      hardwareInfo.gpu = {
        vendor: gpu.vendor,
        model: gpu.model,
        vram: gpu.vram,
        vramDynamic: gpu.vramDynamic
      };
    }

    await axios.post(
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
            load: cpuLoad.currentLoad,
            idle: cpuLoad.currentLoadIdle
          },
          memory: {
            used: mem.used,
            free: mem.free,
            available: mem.available,
            active: mem.active,
            usedPercent: (mem.used / mem.total * 100).toFixed(2)
          }
        }
      },
      { headers: { 'x-agent-token': config.agentToken }, timeout: 10000 }
    );
  } catch (error) {
    console.error('Heartbeat error:', error.message);
  }
}

const PORT = config.port || 7777;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`AtlasNode Agent running on port ${PORT}`);
  
  try {
    const systemInfo = await si.osInfo();
    await axios.post(
      `${config.controlServer}/api/agents/register`,
      {
        machine_id: config.machineId,
        agent_token: config.agentToken,
        system_info: {
          platform: systemInfo.platform,
          distro: systemInfo.distro,
          hostname: systemInfo.hostname
        }
      },
      { timeout: 10000 }
    );
    console.log('Registered with control server');
  } catch (error) {
    console.error('Registration failed:', error.message);
  }

  setInterval(sendHeartbeat, config.heartbeatInterval || 60000);
  setTimeout(sendHeartbeat, 5000);

  // Discovery functions
  async function discoverScreenSessions() {
    try {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execPromise = promisify(exec);
      const { stdout } = await execPromise('screen -ls 2>&1 || true');
      console.log('[Discovery] screen -ls output:', stdout.substring(0, 200));
      const sessions = [];
      const lines = stdout.split('\n');
      for (const line of lines) {
        const match = line.match(/\s+(\d+)\.(\S+)\s+\((\w+)\)/);
        if (match) {
          const [, screenId, name, state] = match;
          let user = null;
          try {
            const psResult = await execPromise(`ps -p ${screenId} -o user= 2>/dev/null || echo unknown`);
            user = psResult.stdout.trim();
          } catch (e) {
            user = 'unknown';
          }
          sessions.push({ screen_id: screenId, name: name, state: state.toLowerCase(), user: user, started_at: null });
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
      let stdout;
      try {
        const result = await execPromise('ss -tulpen 2>/dev/null');
        stdout = result.stdout;
        console.log('[Discovery] Using ss, found', stdout.split('\n').length, 'lines');
      } catch (e) {
        console.log('[Discovery] ss failed, trying netstat');
        const result = await execPromise('netstat -tulpen 2>/dev/null || netstat -tuln 2>/dev/null');
        stdout = result.stdout;
        console.log('[Discovery] Using netstat, found', stdout.split('\n').length, 'lines');
      }
      const ports = [];
      const lines = stdout.split('\n');
      for (const line of lines) {
        if (line.includes('State') || line.includes('Proto') || line.trim() === '') continue;
        const ssMatch = line.match(/(tcp|udp)\s+LISTEN\s+\S+\s+\S+\s+(\S+):(\d+)\s+.*users:\(\("([^"]+)",pid=(\d+)/);
        if (ssMatch) {
          const [, protocol, address, port, process, pid] = ssMatch;
          ports.push({ port: parseInt(port), protocol: protocol, address: address === '*' ? '0.0.0.0' : address, pid: parseInt(pid), process: process, user: null });
          continue;
        }
        const netstatMatch = line.match(/(tcp|udp)\s+\S+\s+\S+\s+(\S+):(\d+)\s+\S+\s+LISTEN\s+(\d+)\/(\S+)/);
        if (netstatMatch) {
          const [, protocol, address, port, pid, process] = netstatMatch;
          ports.push({ port: parseInt(port), protocol: protocol, address: address === '*' ? '0.0.0.0' : address, pid: parseInt(pid), process: process, user: null });
        }
      }
      console.log('[Discovery] Parsed', ports.length, 'listening ports');
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

  // Start discovery reporting
  async function sendDiscoveryData() {
    try {
      const screens = await discoverScreenSessions();
      console.log(`[Discovery] Found ${screens.length} screen sessions`);
      if (screens.length > 0) console.log(`[Discovery] Sessions:`, screens.map(s => `${s.screen_id}.${s.name}`).join(', '));
      if (screens.length >= 0) {
        await axios.post(`${config.controlServer}/api/discovery/screens`, { screens }, { headers: { 'x-agent-token': config.agentToken }, timeout: 10000 });
        console.log(`[Discovery] ✓ Sent ${screens.length} screen sessions`);
      }
      const ports = await discoverOpenPorts();
      console.log(`[Discovery] Found ${ports.length} open ports`);
      if (ports.length > 0) console.log(`[Discovery] Ports:`, ports.map(p => `${p.port}/${p.protocol}`).join(', '));
      if (ports.length >= 0) {
        await axios.post(`${config.controlServer}/api/discovery/ports`, { ports }, { headers: { 'x-agent-token': config.agentToken }, timeout: 10000 });
        console.log(`[Discovery] ✓ Sent ${ports.length} open ports`);
      }
    } catch (error) {
      console.error('[Discovery] Error:', error.message);
      if (error.response) console.error('[Discovery] Response:', error.response.status, error.response.data);
    }
  }

  setInterval(sendDiscoveryData, 30000);
  setTimeout(sendDiscoveryData, 10000);
});

