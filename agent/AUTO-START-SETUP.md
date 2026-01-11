# 🚀 AtlasNode Agent Auto-Start Setup

## ✅ What Has Been Implemented

This system ensures that the AtlasNode agent **always restarts automatically** after a system reboot, avoiding connection loss.

### 📦 Files Created

```
agent/
├── atlasnode-agent.service    # systemd service (Linux)
├── install.sh                 # Automatic installer (Linux)
├── uninstall.sh               # Uninstaller (Linux)
├── install.bat                # Installer (Windows)
├── status.sh                  # Status checker (Linux)
├── status.bat                 # Status checker (Windows)
├── README-INSTALLATION.md     # Complete installation guide
└── AUTO-START-SETUP.md        # This file (summary)
```

## 🐧 Quick Installation - Linux (Recommended)

### Step 1: Configure config.json

```bash
cd agent/
cp config.example.json config.json
nano config.json
```

Edit:
- `machineId`: Unique ID (e.g., 1, 2, 3...)
- `agentToken`: Secure token (e.g., "abc123xyz...")
- `controlServer`: Server URL (e.g., "http://192.168.1.100:5000")

### Step 2: Run installer

```bash
sudo chmod +x install.sh
sudo ./install.sh
```

✨ **Done!** The agent now:
- ✓ Starts automatically on boot
- ✓ Restarts automatically if it fails
- ✓ Waits for network availability
- ✓ Logs to systemd journal

### Step 3: Check status

```bash
sudo chmod +x status.sh
sudo ./status.sh
```

## 🪟 Quick Installation - Windows

### Step 1: Configure config.json

```cmd
cd agent
copy config.example.json config.json
notepad config.json
```

### Step 2: Install NSSM

1. Download: https://nssm.cc/download
2. Extract and add to PATH

### Step 3: Run installer

```cmd
install.bat
```

Follow on-screen instructions to configure Windows service.

## 🔍 Verifying Auto-Start is Working

### Linux

```bash
# Method 1: Use status script
sudo ./status.sh

# Method 2: Manual commands
systemctl is-enabled atlasnode-agent    # Should return "enabled"
systemctl is-active atlasnode-agent     # Should return "active"
systemctl status atlasnode-agent        # Shows detailed status
```

### Windows

```cmd
# Method 1: Use status script
status.bat

# Method 2: Check service
sc query AtlasNodeAgent
nssm status AtlasNodeAgent
```

## 🔄 Restart Behavior

### When does the agent restart automatically?

1. **On system boot** - Starts automatically
2. **After failure/crash** - Restarts after 10 seconds
3. **After manual reboot** - Restarts on next boot
4. **After network loss** - Keeps trying to reconnect

### Restart Settings (Linux/systemd)

```ini
Restart=always              # Always restart
RestartSec=10              # Wait 10s before restarting
StartLimitBurst=3          # Try up to 3x in 60s
After=network-online.target # Wait for network
```

## 📊 Monitoring and Logs

### Linux

```bash
# View live logs
journalctl -u atlasnode-agent -f

# View last 50 lines
journalctl -u atlasnode-agent -n 50

# View logs since last boot
journalctl -u atlasnode-agent -b

# View logs with timestamp
journalctl -u atlasnode-agent --since "10 minutes ago"
```

### Windows

```cmd
# View Event Log
eventvwr.msc

# Or use NSSM to view logs
nssm status AtlasNodeAgent
```

## 🧪 Testing Auto-Start

### Test 1: Restart Service

**Linux:**
```bash
sudo systemctl restart atlasnode-agent
sudo systemctl status atlasnode-agent
```

**Windows:**
```cmd
nssm restart AtlasNodeAgent
nssm status AtlasNodeAgent
```

### Test 2: Simulate Crash

**Linux:**
```bash
# Kill the process
sudo pkill -9 node

# Wait 10 seconds and check
sleep 10
sudo systemctl status atlasnode-agent
# Should be running again!
```

### Test 3: Complete Reboot

```bash
# Note current agent uptime
curl http://localhost:7777/health

# Reboot machine
sudo reboot

# After reboot, check if agent is running
sudo systemctl status atlasnode-agent
curl http://localhost:7777/health
```

## ⚙️ Useful Commands

### Linux (systemd)

| Command | Description |
|---------|-------------|
| `sudo systemctl start atlasnode-agent` | Start service |
| `sudo systemctl stop atlasnode-agent` | Stop service |
| `sudo systemctl restart atlasnode-agent` | Restart service |
| `sudo systemctl status atlasnode-agent` | View status |
| `sudo systemctl enable atlasnode-agent` | Enable auto-start |
| `sudo systemctl disable atlasnode-agent` | Disable auto-start |
| `journalctl -u atlasnode-agent -f` | View live logs |
| `sudo ./status.sh` | Complete status |

### Windows (NSSM)

| Command | Description |
|---------|-------------|
| `nssm start AtlasNodeAgent` | Start service |
| `nssm stop AtlasNodeAgent` | Stop service |
| `nssm restart AtlasNodeAgent` | Restart service |
| `nssm status AtlasNodeAgent` | View status |
| `nssm install AtlasNodeAgent [...]` | Install service |
| `nssm remove AtlasNodeAgent` | Remove service |
| `status.bat` | Complete status |

## 🗑️ Uninstallation

### Linux

```bash
sudo chmod +x uninstall.sh
sudo ./uninstall.sh
```

### Windows

```cmd
nssm stop AtlasNodeAgent
nssm remove AtlasNodeAgent confirm
```

## 🛠️ Troubleshooting

### Problem: Service doesn't start after reboot

**Linux:**
```bash
# Check status
sudo systemctl status atlasnode-agent

# Check if enabled
systemctl is-enabled atlasnode-agent

# If not enabled, enable it
sudo systemctl enable atlasnode-agent

# Check logs
journalctl -u atlasnode-agent -n 100
```

### Problem: Error "Cannot reach control server"

**Solutions:**
1. Check if `controlServer` in `config.json` is correct
2. Test connectivity: `curl http://your-server:5000/api/health`
3. Check firewall: `sudo ufw status`
4. Verify control server is running

### Problem: Agent restarts in loop

**Common cause:** Invalid config.json or unreachable server

**Solution:**
```bash
# Stop service temporarily
sudo systemctl stop atlasnode-agent

# Check config.json
cat /opt/atlasnode-agent/config.json

# Test manually
cd /opt/atlasnode-agent
node agent.js

# If it works, restart service
sudo systemctl start atlasnode-agent
```

## 🔒 Security

### File Permissions

**Linux:**
```bash
# Recommended permissions
sudo chown -R root:root /opt/atlasnode-agent/
sudo chmod 755 /opt/atlasnode-agent/
sudo chmod 600 /opt/atlasnode-agent/config.json
```

### Firewall

**Linux (ufw):**
```bash
# Allow only from control server
sudo ufw allow from 192.168.1.100 to any port 7777
```

**Linux (iptables):**
```bash
# Allow only from control server
sudo iptables -A INPUT -p tcp -s 192.168.1.100 --dport 7777 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 7777 -j DROP
```

## 📈 Monitoring Metrics

The agent sends data regularly:

- **Heartbeat**: Every 60 seconds (configurable)
- **Discovery (ports/screens)**: Every 30 seconds
- **Initial registration**: On first startup

### Check Connectivity

```bash
# Local health check
curl http://localhost:7777/health

# See if heartbeat is being sent
journalctl -u atlasnode-agent -f | grep "Heartbeat sent"

# See if discovery is being sent
journalctl -u atlasnode-agent -f | grep "Discovery"
```

## 📝 Advanced Configuration

### Change Heartbeat Interval

Edit `/opt/atlasnode-agent/config.json`:

```json
{
  "heartbeatInterval": 30000
}
```

Values in milliseconds:
- 30000 = 30 seconds
- 60000 = 1 minute (default)
- 120000 = 2 minutes

After editing, restart:
```bash
sudo systemctl restart atlasnode-agent
```

### Run as Non-Root User (Linux)

⚠️ **Warning:** Some features may not work without root privileges.

1. Create dedicated user:
```bash
sudo useradd -r -s /bin/false atlasnode
```

2. Edit service:
```bash
sudo nano /etc/systemd/system/atlasnode-agent.service
```

3. Change line `User=root` to `User=atlasnode`

4. Fix permissions:
```bash
sudo chown -R atlasnode:atlasnode /opt/atlasnode-agent/
```

5. Reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart atlasnode-agent
```

## ✅ Post-Installation Checklist

- [ ] Agent installed and running
- [ ] Auto-start enabled
- [ ] Config.json configured correctly
- [ ] Connectivity with control server tested
- [ ] Logs checked without errors
- [ ] Reboot test performed
- [ ] Firewall configured (if needed)
- [ ] Machine appears online in dashboard

## 🎉 Conclusion

Your AtlasNode agent is now configured to **always restart automatically**!

In case of:
- ✅ System reboot → Agent starts automatically
- ✅ Failure/crash → Agent restarts in 10 seconds
- ✅ Network loss → Agent keeps trying to reconnect
- ✅ System update → Agent returns after reboot

For additional support, see:
- [README-INSTALLATION.md](README-INSTALLATION.md) - Detailed guide
- [README.md](../README.md) - Main documentation

---

**Built for AtlasNode** - Homelab Management System
