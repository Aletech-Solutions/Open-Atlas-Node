# ⚡ AtlasNode Agent - Quick Start Guide

## 📋 Summary

This guide shows how to install the AtlasNode agent with **automatic restart** after system reboot.

---

## 🐧 Linux (Recommended Method)

### 1️⃣ Configure

```bash
cd agent/
cp config.example.json config.json
nano config.json
```

Edit:
- `machineId`: 1 (or next available ID)
- `agentToken`: "your-secure-token-here"
- `controlServer`: "http://SERVER-IP:5000"

### 2️⃣ Install

```bash
chmod +x install.sh
sudo ./install.sh
```

### 3️⃣ Verify

```bash
chmod +x status.sh
sudo ./status.sh
```

### ✅ Done!

The agent now:
- ✓ Starts automatically on boot
- ✓ Restarts automatically if it fails
- ✓ Reconnects automatically after network loss

---

## 🪟 Windows

### 1️⃣ Configure

```cmd
cd agent
copy config.example.json config.json
notepad config.json
```

### 2️⃣ Install NSSM

Download: https://nssm.cc/download

### 3️⃣ Install Agent

```cmd
install.bat
```

Follow on-screen instructions.

### 4️⃣ Verify

```cmd
status.bat
```

---

## 🧪 Quick Test

### Check if running

**Linux:**
```bash
systemctl status atlasnode-agent
curl http://localhost:7777/health
```

**Windows:**
```cmd
nssm status AtlasNodeAgent
curl http://localhost:7777/health
```

### Restart test

```bash
# Linux
sudo systemctl restart atlasnode-agent

# Windows
nssm restart AtlasNodeAgent
```

### Reboot test

```bash
# Reboot machine
sudo reboot

# After reboot, check
systemctl status atlasnode-agent
```

---

## 📊 Useful Commands

### Linux

```bash
# Start
sudo systemctl start atlasnode-agent

# Stop
sudo systemctl stop atlasnode-agent

# Status
sudo systemctl status atlasnode-agent

# Live logs
journalctl -u atlasnode-agent -f

# Complete status
sudo ./status.sh
```

### Windows

```cmd
# Start
nssm start AtlasNodeAgent

# Stop
nssm stop AtlasNodeAgent

# Status
nssm status AtlasNodeAgent

# Complete status
status.bat
```

---

## 🛠️ Common Issues

### Can't connect to server

```bash
# Test connectivity
ping SERVER-IP
curl http://SERVER-IP:5000

# Check config.json
cat config.json
```

### Service won't start

**Linux:**
```bash
# View logs
journalctl -u atlasnode-agent -n 50

# Test manually
cd /opt/atlasnode-agent
sudo node agent.js
```

### Firewall blocking

**Linux:**
```bash
# Allow port 7777
sudo ufw allow 7777
```

---

## 📚 Complete Documentation

- [README-INSTALLATION.md](README-INSTALLATION.md) - Detailed installation guide
- [AUTO-START-SETUP.md](AUTO-START-SETUP.md) - Auto-start details
- [../README.md](../README.md) - Main AtlasNode documentation

---

## ✅ Post-Installation Checklist

- [ ] Config.json configured
- [ ] Installer executed successfully
- [ ] Service running (`status.sh` or `status.bat`)
- [ ] Auto-start enabled
- [ ] Health check working (`curl http://localhost:7777/health`)
- [ ] Machine appears online in dashboard
- [ ] Reboot test performed

---

**🎉 Installation complete! Your agent is now protected against reboots.**
