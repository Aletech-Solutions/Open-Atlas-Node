# AtlasNode Agent - Installation Guide

This guide explains how to install the AtlasNode Agent so it starts automatically after system reboot.

## 📋 Prerequisites

- **Node.js** v14 or higher
- **Root/Administrator access** to the system
- Configured `config.json` file

## 🐧 Linux Installation (Recommended)

The agent uses systemd for automatic startup on Linux.

### 1. Configure config.json

```bash
cd agent/
cp config.example.json config.json
nano config.json  # or vim, or your preferred editor
```

Edit the following settings:
- `controlServer`: Control server URL
- `machineId`: Machine unique ID
- `agentToken`: Authentication token
- `port`: Agent port (default: 7777)

### 2. Run the installation script

```bash
sudo chmod +x install.sh
sudo ./install.sh
```

The script will:
- ✓ Check dependencies
- ✓ Copy files to `/opt/atlasnode-agent`
- ✓ Install Node.js dependencies
- ✓ Create and enable systemd service
- ✓ Start the agent automatically

### 3. Check status

```bash
sudo systemctl status atlasnode-agent
```

### 4. View logs

```bash
# Live logs
sudo journalctl -u atlasnode-agent -f

# Last 50 lines
sudo journalctl -u atlasnode-agent -n 50
```

## 🔧 Useful Commands (Linux)

```bash
# Start service
sudo systemctl start atlasnode-agent

# Stop service
sudo systemctl stop atlasnode-agent

# Restart service
sudo systemctl restart atlasnode-agent

# View status
sudo systemctl status atlasnode-agent

# Disable auto-start
sudo systemctl disable atlasnode-agent

# Enable auto-start
sudo systemctl enable atlasnode-agent

# View logs
sudo journalctl -u atlasnode-agent -f
```

## 🗑️ Uninstallation (Linux)

```bash
cd agent/
sudo chmod +x uninstall.sh
sudo ./uninstall.sh
```

## 🪟 Windows Installation

### Option 1: Using NSSM (Recommended)

1. **Download NSSM** (Non-Sucking Service Manager)
   - https://nssm.cc/download
   - Extract and add to system PATH

2. **Configure config.json**
   ```cmd
   cd agent
   copy config.example.json config.json
   notepad config.json
   ```

3. **Run installer** (as Administrator)
   ```cmd
   install.bat
   ```

4. **Install service with NSSM**
   ```cmd
   cd agent
   nssm install AtlasNodeAgent "C:\Program Files\nodejs\node.exe" "%CD%\agent.js"
   nssm set AtlasNodeAgent AppDirectory "%CD%"
   nssm set AtlasNodeAgent DisplayName "AtlasNode Agent"
   nssm set AtlasNodeAgent Description "AtlasNode System Monitor and Control Agent"
   nssm set AtlasNodeAgent Start SERVICE_AUTO_START
   nssm set AtlasNodeAgent AppExit Default Restart
   nssm set AtlasNodeAgent AppRestartDelay 10000
   nssm start AtlasNodeAgent
   ```

### Option 2: Using Windows Task Scheduler

1. Open **Task Scheduler**
2. Click **Create Basic Task**
3. Configure:
   - **Name**: AtlasNode Agent
   - **Trigger**: When computer starts
   - **Action**: Start a program
   - **Program**: `C:\path\to\agent\start-agent.bat`
   - Check: **Run with highest privileges**

## 🔄 Restart Behavior

The service is configured to:

### Linux (systemd)
- **Restart=always**: Restarts whenever the process terminates
- **RestartSec=10**: Waits 10 seconds before restarting
- **StartLimitBurst=3**: Tries to restart up to 3 times in 60 seconds
- **After=network-online.target**: Waits for network to be available
- **WantedBy=multi-user.target**: Starts on system boot

### Windows (NSSM)
- **SERVICE_AUTO_START**: Starts automatically with Windows
- **AppExit Default Restart**: Restarts on failure
- **AppRestartDelay 10000**: Waits 10 seconds before restarting

## 📊 Verifying Auto-Start is Working

### Linux
```bash
# Check if service is enabled
systemctl is-enabled atlasnode-agent

# Should return: enabled
```

### Windows
```cmd
# Using NSSM
nssm status AtlasNodeAgent

# Or check service
sc query AtlasNodeAgent
```

## 🐛 Troubleshooting

### Service doesn't start after reboot

**Linux:**
```bash
# Check status
sudo systemctl status atlasnode-agent

# Check logs
sudo journalctl -u atlasnode-agent -n 100

# Check if enabled
systemctl is-enabled atlasnode-agent
```

**Windows:**
```cmd
# Check Windows Event Log
eventvwr.msc
```

### Error: "Cannot reach control server"

Check if:
- `controlServer` in `config.json` is correct
- Machine has internet/network access
- Control server is running
- Firewall is not blocking the connection

### Permission errors

**Linux:**
```bash
# Check file permissions
ls -la /opt/atlasnode-agent/

# Fix if needed
sudo chown -R root:root /opt/atlasnode-agent/
sudo chmod -R 755 /opt/atlasnode-agent/
```

## 🔒 Security Considerations

- Agent runs as **root** on Linux for full system access
- Protect `agentToken` in `config.json`
- Use HTTPS for `controlServer` in production
- Configure firewall to allow only authorized IPs on agent port

## 📝 Additional Notes

- Agent sends heartbeat every 60 seconds (configurable)
- Port/screen discovery every 30 seconds
- Logs stored via journald (Linux) or Event Viewer (Windows)
- Service waits for network availability before starting

## 🆘 Support

For issues or questions:
1. Check logs first
2. Consult main documentation
3. Open an issue on GitHub repository
