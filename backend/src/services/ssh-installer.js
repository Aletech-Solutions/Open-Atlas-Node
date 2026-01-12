const { Client } = require('ssh2');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../database');
const fs = require('fs').promises;
const path = require('path');

// Agent installation script template
// Note: This script will be run with sudo, so internal sudo commands are not needed
const AGENT_INSTALL_SCRIPT = `#!/bin/bash
set -e

echo "=== AtlasNode Agent Installer ==="

# Detect OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
else
    echo "Cannot detect OS"
    exit 1
fi

echo "Detected OS: $OS"

# Check Node.js version and install/upgrade if needed
REQUIRED_NODE_VERSION=14
CURRENT_NODE_VERSION=0

if command -v node &> /dev/null; then
    CURRENT_NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    echo "Current Node.js version: v$CURRENT_NODE_VERSION"
fi

# Install or upgrade Node.js if version is less than 14
if [ "$CURRENT_NODE_VERSION" -lt "$REQUIRED_NODE_VERSION" ]; then
    echo "Node.js version $REQUIRED_NODE_VERSION or higher is required"
    echo "Installing Node.js 18.x..."
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        # Aggressive cleanup of old Node.js
        echo "Performing complete removal of old Node.js..."
        
        # Stop any Node.js services
        systemctl stop atlasnode-agent 2>/dev/null || true
        
        # Remove ALL Node.js related packages
        apt-get purge -y nodejs npm node 2>&1 || true
        apt-get purge -y 'nodejs*' 'node-*' 'npm*' 'libnode*' 2>&1 || true
        apt-get autoremove -y 2>&1 || true
        apt-get autoclean -y 2>&1 || true
        
        # Remove Node.js binaries manually
        rm -rf /usr/bin/node /usr/bin/nodejs /usr/bin/npm /usr/bin/npx 2>/dev/null || true
        rm -rf /usr/local/bin/node /usr/local/bin/nodejs /usr/local/bin/npm /usr/local/bin/npx 2>/dev/null || true
        rm -rf /usr/lib/node_modules 2>/dev/null || true
        rm -rf /usr/local/lib/node_modules 2>/dev/null || true
        
        # Remove old NodeSource repository if exists
        rm -f /etc/apt/sources.list.d/nodesource.list 2>/dev/null || true
        
        echo "Old Node.js completely removed"
        
        # Install prerequisites
        echo "Installing prerequisites..."
        apt-get update -y --allow-releaseinfo-change 2>&1 || true
        apt-get install -y curl ca-certificates gnupg apt-transport-https 2>&1 || true
        
        # Add NodeSource GPG key
        echo "Adding NodeSource GPG key..."
        mkdir -p /etc/apt/keyrings
        curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg 2>&1 || true
        
        # Add NodeSource repository
        echo "Adding NodeSource repository..."
        NODE_MAJOR=18
        echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_$NODE_MAJOR.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
        
        # Update package list with only NodeSource
        echo "Updating package lists (ignoring broken repos)..."
        apt-get update -y 2>&1 || true
        
        # Install Node.js 18.x
        echo "Installing Node.js 18.x from NodeSource..."
        apt-get install -y nodejs 2>&1 || {
            echo "First attempt failed, trying with --fix-broken..."
            apt-get install -y --fix-broken nodejs 2>&1 || {
                echo "Second attempt failed, trying with dpkg configure..."
                dpkg --configure -a 2>&1 || true
                apt-get install -y -f nodejs 2>&1
            }
        }
        
        echo "Node.js installation completed"
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "rocky" ] || [ "$OS" = "almalinux" ]; then
        # Remove old Node.js if present
        if command -v node &> /dev/null; then
            echo "Removing old Node.js version..."
            yum remove -y nodejs npm || true
        fi
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        yum install -y nodejs
    elif [ "$OS" = "arch" ]; then
        pacman -Sy --noconfirm nodejs npm
    else
        echo "ERROR: Unsupported OS for automatic Node.js installation"
        exit 1
    fi
    
    echo "Node.js installation completed"
else
    echo "Node.js version is sufficient (v$CURRENT_NODE_VERSION >= v$REQUIRED_NODE_VERSION)"
fi

# Verify Node.js is available and correct version
if ! command -v node &> /dev/null; then
    echo "ERROR: Node.js is not available after installation"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✓ Node version: $NODE_VERSION"

# Verify npm is available (should come with nodejs from NodeSource)
if ! command -v npm &> /dev/null; then
    echo "WARNING: npm not found after Node.js installation"
    echo "This should not happen with NodeSource Node.js"
    echo "Attempting to install npm separately..."
    
    if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
        # Try to reinstall nodejs which should include npm
        apt-get install --reinstall -y nodejs 2>&1 || apt-get install -y npm 2>&1
    elif [ "$OS" = "centos" ] || [ "$OS" = "rhel" ] || [ "$OS" = "rocky" ] || [ "$OS" = "almalinux" ]; then
        yum reinstall -y nodejs 2>&1 || yum install -y npm 2>&1
    elif [ "$OS" = "arch" ]; then
        pacman -S --noconfirm npm
    fi
    
    # Final npm check
    if ! command -v npm &> /dev/null; then
        echo "ERROR: npm is still not available"
        echo "Node.js was installed but npm is missing"
        echo "This is unusual - please check Node.js installation manually"
        exit 1
    fi
fi

NPM_VERSION=$(npm --version)
echo "✓ NPM version: $NPM_VERSION"

# Final summary
echo ""
echo "================================================"
echo "Node.js Environment Ready:"
echo "  Node.js: $(node --version)"
echo "  NPM: $(npm --version)"
echo "================================================"
echo ""

# Verify Node.js version one more time before proceeding
FINAL_NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$FINAL_NODE_VERSION" -lt "$REQUIRED_NODE_VERSION" ]; then
    echo "ERROR: Node.js version is still too old ($FINAL_NODE_VERSION < $REQUIRED_NODE_VERSION)"
    echo "Please manually install Node.js 14 or higher"
    exit 1
fi

echo "✓ Node.js version check passed (v$FINAL_NODE_VERSION)"

# Create agent directory
AGENT_DIR="/opt/atlasnode-agent"
echo "Creating agent directory at $AGENT_DIR..."
mkdir -p $AGENT_DIR

# Download and extract agent bundle
echo "Installing AtlasNode Agent..."

echo "Creating package.json..."
cat > $AGENT_DIR/package.json << 'PACKAGE_JSON_EOF'
__PACKAGE_JSON__
PACKAGE_JSON_EOF

echo "Creating agent.js..."
cat > $AGENT_DIR/agent.js << 'AGENT_JS_EOF'
__AGENT_JS__
AGENT_JS_EOF

echo "Creating config.json..."
cat > $AGENT_DIR/config.json << 'CONFIG_JSON_EOF'
__CONFIG_JSON__
CONFIG_JSON_EOF

cd $AGENT_DIR

# Install dependencies
echo "Installing npm dependencies..."
npm install --production

# Find the correct node path
NODE_PATH=$(which node)
if [ -z "$NODE_PATH" ]; then
    # Fallback paths where NodeSource installs node
    if [ -f /usr/bin/node ]; then
        NODE_PATH="/usr/bin/node"
    elif [ -f /usr/local/bin/node ]; then
        NODE_PATH="/usr/local/bin/node"
    else
        echo "ERROR: Cannot find node binary"
        exit 1
    fi
fi

echo "Using Node.js at: $NODE_PATH"
echo "Node version: $($NODE_PATH --version)"

# Verify it's the correct version
NODE_MAJOR=$($NODE_PATH --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 14 ]; then
    echo "ERROR: Node at $NODE_PATH is version $NODE_MAJOR (< 14)"
    echo "systemd would use the wrong version"
    exit 1
fi

echo "✓ Correct Node.js version will be used in systemd service"

# Create systemd service with absolute path and environment variables
echo "Creating systemd service..."
cat > /etc/systemd/system/atlasnode-agent.service << SERVICE_EOF
[Unit]
Description=AtlasNode Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/atlasnode-agent
ExecStart=$NODE_PATH agent.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
Environment="PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
Environment="NODE_ENV=production"

# Restart limits
StartLimitInterval=60
StartLimitBurst=3

[Install]
WantedBy=multi-user.target
SERVICE_EOF

echo "✓ Systemd service created with Node.js at: $NODE_PATH"

# Stop any existing service first
echo "Stopping any existing atlasnode-agent service..."
systemctl stop atlasnode-agent 2>/dev/null || true
systemctl disable atlasnode-agent 2>/dev/null || true

# Reload systemd to pick up new service file
echo "Reloading systemd daemon..."
systemctl daemon-reload

# Enable and start service
echo "Enabling and starting service..."
systemctl enable atlasnode-agent
systemctl start atlasnode-agent

# Wait a moment for service to start
sleep 2

echo ""
echo "=== AtlasNode Agent installed successfully ==="
echo ""
echo "Service status:"
systemctl status atlasnode-agent --no-pager || true
echo ""
echo "Recent logs:"
journalctl -u atlasnode-agent -n 10 --no-pager || true
`;

async function logInstallationStep(machineId, stage, output, error, success) {
  try {
    await db.query(`
      INSERT INTO installation_logs (machine_id, stage, log_output, error_output, success)
      VALUES ($1, $2, $3, $4, $5)
    `, [machineId, stage, output || null, error || null, success]);
  } catch (err) {
    console.error('Failed to log installation step:', err);
  }
}

async function installAgent(machineId) {
  let conn = null;

  try {
    console.log(`Starting agent installation for machine ${machineId}`);
    await logInstallationStep(machineId, 'START', 'Beginning agent installation', null, true);

    // Get machine details
    const machineResult = await db.query(`
      SELECT m.*, sc.auth_method, sc.encrypted_password, sc.encrypted_private_key, 
             sc.encrypted_sudo_password, sc.requires_sudo
      FROM machines m
      LEFT JOIN ssh_credentials sc ON m.id = sc.machine_id
      WHERE m.id = $1
    `, [machineId]);

    if (machineResult.rows.length === 0) {
      await logInstallationStep(machineId, 'ERROR', null, 'Machine not found in database', false);
      throw new Error('Machine not found');
    }

    const machine = machineResult.rows[0];
    await logInstallationStep(machineId, 'MACHINE_INFO', `Retrieved machine: ${machine.name} (${machine.ip_address})`, null, true);

    // Decrypt credentials
    await logInstallationStep(machineId, 'CREDENTIALS', 'Decrypting SSH credentials', null, true);
    const credentials = decryptCredentials(machine);
    
    if (!credentials.password && !credentials.privateKey) {
      await logInstallationStep(machineId, 'ERROR', null, 'Failed to decrypt credentials', false);
      throw new Error('Failed to decrypt credentials');
    }

    // Generate agent token
    const agentToken = crypto.randomBytes(32).toString('hex');
    const agentPort = machine.agent_port || 7777;
    await logInstallationStep(machineId, 'TOKEN', `Generated agent token and assigned port ${agentPort}`, null, true);

    // IMPORTANT: Save agent token to database BEFORE installation
    // This prevents race condition where agent starts and tries to register before token is saved
    await logInstallationStep(machineId, 'UPDATE_DATABASE', 'Saving agent token to database (before installation)', null, true);
    await db.query(`
      UPDATE machines 
      SET agent_token = $1, agent_port = $2, status = 'installing'
      WHERE id = $3
    `, [agentToken, agentPort, machineId]);
    await logInstallationStep(machineId, 'UPDATE_DATABASE', 'Agent token saved to database', null, true);

    // Prepare agent files
    const agentPackage = {
      name: 'atlasnode-agent',
      version: '1.0.0',
      description: 'AtlasNode Agent',
      main: 'agent.js',
      engines: {
        node: '>=14.0.0'
      },
      dependencies: {
        express: '^4.18.2',
        axios: '^1.6.2',
        'systeminformation': '^5.21.22'
      }
    };

    // Get control server URL from machine configuration (provided by user in frontend)
    let controlServerUrl = machine.control_server_url;
    
    if (!controlServerUrl || controlServerUrl.trim() === '') {
      const errorMsg = 
        '❌ CRITICAL ERROR: Control server URL not configured!\n\n' +
        'The control server URL is required for agents to connect back.\n' +
        'This should have been provided when adding the machine.\n\n' +
        `Target agent IP: ${machine.ip_address}\n` +
        'Please remove this machine and add it again with the correct control server URL.';
      
      await logInstallationStep(
        machineId, 
        'CONFIG_ERROR', 
        null,
        errorMsg,
        false
      );
      
      throw new Error('Control server URL is required. Please remove and re-add this machine with the URL configured.');
    }
    
    // Validate the URL doesn't contain obvious issues
    if (controlServerUrl.includes('localhost') || controlServerUrl.includes('127.0.0.1')) {
      const warningMsg = 
        `⚠️ WARNING: Control server URL contains localhost: ${controlServerUrl}\n\n` +
        'Agents on remote machines will NOT be able to connect to localhost!\n\n' +
        `The agent machine (${machine.ip_address}) cannot reach "localhost" or "127.0.0.1".\n` +
        'This will likely fail. Please use your server\'s actual IP address or hostname.';
      
      await logInstallationStep(
        machineId, 
        'CONFIG_WARNING', 
        null,
        warningMsg,
        false
      );
    }
    
    // Log the control server URL
    await logInstallationStep(
      machineId, 
      'CONFIG', 
      `Control server URL: ${controlServerUrl}`, 
      null, 
      true
    );
    
    const agentConfig = {
      machineId,
      agentToken,
      controlServer: controlServerUrl,
      port: agentPort,
      heartbeatInterval: 60000 // 1 minute
    };

    // Read agent source code
    const agentSource = await fs.readFile(
      path.join(__dirname, '../../agent-template/agent.js'),
      'utf-8'
    ).catch(() => generateAgentSource());

    // Replace placeholders in install script
    let installScript = AGENT_INSTALL_SCRIPT
      .replace('__PACKAGE_JSON__', JSON.stringify(agentPackage, null, 2))
      .replace('__AGENT_JS__', agentSource)
      .replace('__CONFIG_JSON__', JSON.stringify(agentConfig, null, 2));

    // Connect via SSH
    await logInstallationStep(machineId, 'SSH_CONNECT', `Attempting SSH connection to ${machine.ip_address}:${machine.ssh_port}`, null, true);
    try {
      conn = await connectSSH(machine, credentials);
      await logInstallationStep(machineId, 'SSH_CONNECT', 'SSH connection established successfully', null, true);
    } catch (sshError) {
      await logInstallationStep(machineId, 'SSH_CONNECT', null, `SSH connection failed: ${sshError.message}`, false);
      throw sshError;
    }

    // Upload and execute install script
    await logInstallationStep(machineId, 'UPLOAD_SCRIPT', 'Uploading installation script to /tmp/atlasnode-install.sh', null, true);
    try {
      await executeSSHCommand(conn, 'cat > /tmp/atlasnode-install.sh', installScript);
      await logInstallationStep(machineId, 'UPLOAD_SCRIPT', `✓ Installation script uploaded successfully (${(installScript.length / 1024).toFixed(2)} KB)`, null, true);
    } catch (uploadError) {
      await logInstallationStep(machineId, 'UPLOAD_SCRIPT', null, `Failed to upload script: ${uploadError.message}`, false);
      throw uploadError;
    }

    await logInstallationStep(machineId, 'CHMOD', 'Making installation script executable (chmod +x)', null, true);
    try {
      await executeSSHCommand(conn, 'chmod +x /tmp/atlasnode-install.sh');
      await logInstallationStep(machineId, 'CHMOD', '✓ Script is now executable', null, true);
    } catch (chmodError) {
      await logInstallationStep(machineId, 'CHMOD', null, `chmod failed: ${chmodError.message}`, false);
      throw chmodError;
    }

    await logInstallationStep(machineId, 'EXECUTE', 'Executing installation script...', null, true);
    let installOutput;
    try {
      // Execute with sudo if required
      if (credentials.requiresSudo) {
        if (credentials.sudoPassword) {
          await logInstallationStep(machineId, 'EXECUTE', 'Using sudo with password for installation', null, true);
          
          // Create a wrapper script that handles sudo with password
          const sudoWrapper = `#!/bin/bash
echo '${credentials.sudoPassword.replace(/'/g, "'\\''")}' | sudo -S bash /tmp/atlasnode-install.sh 2>&1`;
          
          await executeSSHCommand(conn, 'cat > /tmp/atlasnode-sudo-wrapper.sh', sudoWrapper);
          await executeSSHCommand(conn, 'chmod +x /tmp/atlasnode-sudo-wrapper.sh');
          
          installOutput = await executeSSHCommand(conn, 'bash /tmp/atlasnode-sudo-wrapper.sh');
          
          // Cleanup wrapper
          await executeSSHCommand(conn, 'rm -f /tmp/atlasnode-sudo-wrapper.sh').catch(() => {});
        } else {
          await logInstallationStep(machineId, 'EXECUTE', 'Using passwordless sudo for installation', null, true);
          installOutput = await executeSSHCommand(conn, 'sudo bash /tmp/atlasnode-install.sh 2>&1');
        }
      } else {
        await logInstallationStep(machineId, 'EXECUTE', 'Running without sudo', null, true);
        installOutput = await executeSSHCommand(conn, 'bash /tmp/atlasnode-install.sh 2>&1');
      }
      
      await logInstallationStep(machineId, 'EXECUTE', installOutput, null, true);
      console.log('Agent installation completed successfully');
    } catch (execError) {
      await logInstallationStep(machineId, 'EXECUTE', null, `Installation script failed: ${execError.message}`, false);
      throw execError;
    }

    // Update machine status to online (token already saved earlier)
    await logInstallationStep(machineId, 'UPDATE_DATABASE', 'Updating machine status to online', null, true);
    await db.query(`
      UPDATE machines 
      SET status = 'online'
      WHERE id = $1
    `, [machineId]);
    await logInstallationStep(machineId, 'UPDATE_DATABASE', 'Machine status updated to online', null, true);

    // Verify agent is responding
    await logInstallationStep(machineId, 'VERIFY_AGENT', 'Verifying agent is responding...', null, true);
    try {
      const verifyCommand = `curl -s http://localhost:${agentPort}/health`;
      const healthCheck = await executeSSHCommand(conn, verifyCommand);
      await logInstallationStep(machineId, 'VERIFY_AGENT', `Agent health check: ${healthCheck}`, null, true);
    } catch (healthError) {
      await logInstallationStep(machineId, 'VERIFY_AGENT', 'Health check failed (this may be normal if firewall is blocking)', healthError.message, true);
    }

    await logInstallationStep(
      machineId, 
      'SUCCESS', 
      `✓ Agent installation completed successfully!\n\n` +
      `Machine ID: ${machineId}\n` +
      `Agent Port: ${agentPort}\n` +
      `Agent Token: ${agentToken.substring(0, 8)}...\n\n` +
      `The agent will now send heartbeats to the control server every 60 seconds.\n` +
      `System information will be updated automatically.`,
      null, 
      true
    );
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✓ AGENT INSTALLATION SUCCESS`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Machine ID: ${machineId}`);
    console.log(`Agent Port: ${agentPort}`);
    console.log(`Status: Online`);
    console.log(`${'='.repeat(60)}\n`);

    // Cleanup
    await logInstallationStep(machineId, 'CLEANUP', 'Removing temporary installation script', null, true);
    await executeSSHCommand(conn, 'rm -f /tmp/atlasnode-install.sh /tmp/atlasnode-sudo-wrapper.sh 2>&1').catch(() => {
      console.log('Cleanup warning: Could not remove temporary files (this is not critical)');
    });
    conn.end();

    return { success: true, agentToken };

  } catch (error) {
    console.error(`Agent installation failed for machine ${machineId}:`, error);
    
    await logInstallationStep(
      machineId, 
      'FATAL_ERROR', 
      null, 
      `Installation failed: ${error.message}\n\nStack trace:\n${error.stack}`,
      false
    );

    // Update machine status to error
    await db.query(
      'UPDATE machines SET status = $1 WHERE id = $2',
      ['error', machineId]
    );

    if (conn) conn.end();
    throw error;
  }
}

function connectSSH(machine, credentials) {
  return new Promise((resolve, reject) => {
    const conn = new Client();

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
      console.log(`SSH connection established to ${machine.ip_address}`);
      resolve(conn);
    });

    conn.on('error', (err) => {
      console.error(`SSH connection error to ${machine.ip_address}:`, err);
      reject(err);
    });

    conn.connect(config);
  });
}

function executeSSHCommand(conn, command, stdin = null) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);

      let stdout = '';
      let stderr = '';

      stream.on('close', (code) => {
        if (code !== 0) {
          const errorMsg = stderr || stdout || 'No error output available';
          reject(new Error(`Command failed with code ${code}: ${errorMsg.trim()}`));
        } else {
          resolve(stdout);
        }
      });

      stream.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        // Also log in real-time for debugging
        console.log('[SSH stdout]', output);
      });

      stream.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        // Also log in real-time for debugging
        console.error('[SSH stderr]', output);
      });

      if (stdin) {
        stream.write(stdin);
        stream.end();
      }
    });
  });
}

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

  // Decrypt sudo password if provided
  if (machine.encrypted_sudo_password) {
    const parts = machine.encrypted_sudo_password.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    credentials.sudoPassword = decrypted;
  } else if (machine.requires_sudo) {
    // Use SSH password as sudo password if not provided separately
    credentials.sudoPassword = credentials.password;
  }

  credentials.requiresSudo = machine.requires_sudo !== false;

  return credentials;
}

function generateAgentSource() {
  // Fallback agent source if template file doesn't exist
  return `
const express = require('express');
const axios = require('axios');
const si = require('systeminformation');
const fs = require('fs');

const config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const app = express();

app.use(express.json());

// Middleware to verify requests from control server
function verifyToken(req, res, next) {
  const token = req.headers['x-control-token'];
  if (token !== config.agentToken) {
    return res.status(403).json({ error: 'Invalid token' });
  }
  next();
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// System info
app.get('/system/info', verifyToken, async (req, res) => {
  try {
    const [cpu, mem, os, disk] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.osInfo(),
      si.fsSize()
    ]);
    res.json({ cpu, memory: mem, os, disk });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CPU info
app.get('/system/cpu', verifyToken, async (req, res) => {
  try {
    const data = await si.currentLoad();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Memory info
app.get('/system/memory', verifyToken, async (req, res) => {
  try {
    const data = await si.mem();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Disk info
app.get('/system/disk', verifyToken, async (req, res) => {
  try {
    const data = await si.fsSize();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Network info
app.get('/system/network', verifyToken, async (req, res) => {
  try {
    const data = await si.networkStats();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actions
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

// Heartbeat function
async function sendHeartbeat() {
  try {
    const [cpu, mem, os] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.osInfo()
    ]);

    await axios.post(
      config.controlServer + '/api/agents/heartbeat',
      {
        system_info: { os, hardware: { cpu, memory: mem } },
        metrics: {
          cpu: await si.currentLoad(),
          memory: mem
        }
      },
      {
        headers: { 'x-agent-token': config.agentToken }
      }
    );
    console.log('Heartbeat sent successfully');
  } catch (error) {
    console.error('Heartbeat error:', error.message);
  }
}

// Start server
app.listen(config.port, () => {
  console.log('AtlasNode Agent running on port', config.port);
  
  // Send initial registration
  axios.post(
    config.controlServer + '/api/agents/register',
    {
      machine_id: config.machineId,
      agent_token: config.agentToken
    }
  ).catch(console.error);

  // Start heartbeat
  setInterval(sendHeartbeat, config.heartbeatInterval);
});
`;
}

module.exports = {
  installAgent
};

