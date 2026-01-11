# Agent Setup Guide - Quick Reference

## Problem Solved

**Before**: Agents tried to connect to `127.0.0.1:5000` (localhost), which failed because the control server is on a different machine.

**After**: Agents are configured with the correct IP/hostname during installation and can successfully connect to the control server.

## What Was Changed

### 1. Backend - SSH Installer (`backend/src/services/ssh-installer.js`)
- Now detects and uses `BACKEND_URL` or constructs from `BACKEND_HOST` + PORT
- Logs the control server URL being used during installation
- Agent config.json is created with the correct control server URL

### 2. Docker Compose (`docker-compose.yml`)
- Added `BACKEND_HOST` and `BACKEND_URL` environment variables
- These are passed to the backend container

### 3. Setup Script (`scripts/setup.sh`)
- Now prompts for server IP address during setup
- Auto-detects the server's IP and offers to use it
- Creates `.env` with `BACKEND_HOST` configured
- Warns if `BACKEND_HOST` is not set

### 4. Documentation
- **NEW: [CONFIGURATION.md](CONFIGURATION.md)** - Complete configuration guide
- Updated [README.md](README.md) with agent communication setup instructions
- All MD files translated to English

## Quick Start - New Installation

### Step 1: Run Setup Script

```bash
chmod +x scripts/setup.sh
./scripts/setup.sh
```

The script will:
1. Auto-detect your server's IP (e.g., `192.168.1.100`)
2. Ask if you want to use it
3. Create `.env` with `BACKEND_HOST=192.168.1.100`
4. Start all services

### Step 2: Verify Configuration

```bash
# Check .env file
cat .env | grep BACKEND_HOST

# Should show something like:
# BACKEND_HOST=192.168.1.100
```

### Step 3: Add a Machine

1. Go to dashboard: `http://localhost:3000`
2. Register/login
3. Click "Add Machine"
4. Enter SSH credentials
5. Watch the installation logs

### Step 4: Verify Agent Connected

Check the backend logs:

```bash
docker-compose logs -f backend
```

You should see:
```
[Installation Log] Using control server URL: http://192.168.1.100:5000
...
✓ Agent installation completed successfully!
```

On the agent machine:

```bash
sudo journalctl -u atlasnode-agent -f
```

You should see:
```
AtlasNode Agent running on port 7777
Registration successful
Heartbeat sent successfully
```

## Existing Installation - Fix Agent Connection

If you already have AtlasNode running but agents can't connect:

### Step 1: Add BACKEND_HOST to .env

```bash
# Edit .env file
nano .env

# Add this line (replace with your server's IP):
BACKEND_HOST=192.168.1.100
```

### Step 2: Restart Services

```bash
docker-compose down
docker-compose up -d
```

### Step 3: Reinstall Agents

For each machine that failed to connect:

1. **Remove the machine** from the dashboard
2. **Re-add the machine** with the same SSH credentials
3. The agent will be reinstalled with the correct control server URL

Or manually update the agent:

```bash
# SSH into the agent machine
ssh user@agent-machine

# Edit agent config
sudo nano /opt/atlasnode-agent/config.json

# Change:
# "controlServer": "http://localhost:5000"
# To:
# "controlServer": "http://192.168.1.100:5000"

# Restart agent
sudo systemctl restart atlasnode-agent

# Check logs
sudo journalctl -u atlasnode-agent -f
```

## Configuration Options

### Option 1: Use BACKEND_HOST (Simple)

```bash
# In .env
BACKEND_HOST=192.168.1.100
```

Will create: `http://192.168.1.100:5000`

### Option 2: Use BACKEND_URL (Full Control)

```bash
# In .env
BACKEND_URL=http://192.168.1.100:5000
```

Use this if you need:
- Custom port (not 5000)
- HTTPS: `BACKEND_URL=https://atlas.example.com`
- Domain name: `BACKEND_URL=http://atlas.local:5000`

### Priority

If both are set, `BACKEND_URL` takes priority over `BACKEND_HOST`.

## Verification Checklist

- [ ] `.env` file has `BACKEND_HOST` or `BACKEND_URL` set
- [ ] Value is NOT `localhost` or `127.0.0.1`
- [ ] Value is accessible from agent machines
- [ ] Services restarted after changing `.env`
- [ ] Installation logs show correct URL: `Using control server URL: http://YOUR_IP:5000`
- [ ] Agent logs show: `Registration successful` and `Heartbeat sent successfully`
- [ ] Machine shows "online" in dashboard

## Common Scenarios

### Local Network (All machines on same LAN)

```bash
# .env
BACKEND_HOST=192.168.1.100
```

Test from agent machine:
```bash
curl http://192.168.1.100:5000/api/health
```

### Cloud Server with Public IP

```bash
# .env
BACKEND_URL=http://203.0.113.50:5000
```

Make sure port 5000 is open in cloud firewall.

### Using Domain Name

```bash
# .env
BACKEND_URL=https://atlas.example.com
```

Make sure DNS is configured and SSL certificate is valid.

### Behind Reverse Proxy

```bash
# .env
BACKEND_URL=https://atlas.example.com
```

Nginx config example:
```nginx
server {
    listen 80;
    server_name atlas.example.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Troubleshooting

### Error: "Registration failed: connect ECONNREFUSED 127.0.0.1:5000"

**Cause**: `BACKEND_HOST` not set or set to localhost

**Fix**:
1. Set `BACKEND_HOST` in `.env` to your server's IP
2. Restart: `docker-compose down && docker-compose up -d`
3. Reinstall agent on the remote machine

### Error: "Registration failed: connect ETIMEDOUT"

**Cause**: Firewall blocking or wrong IP

**Fix**:
1. Check if backend is accessible:
   ```bash
   curl http://YOUR_IP:5000/api/health
   ```
2. Check firewall:
   ```bash
   sudo ufw status
   sudo ufw allow 5000/tcp
   ```

### Error: "Registration failed: getaddrinfo ENOTFOUND"

**Cause**: Domain name can't be resolved

**Fix**:
1. Test DNS from agent machine:
   ```bash
   nslookup your-domain.com
   ```
2. Use IP address instead if DNS fails

### Agent installed but not showing online

**Cause**: Heartbeat not reaching control server

**Fix**:
1. Check agent logs:
   ```bash
   sudo journalctl -u atlasnode-agent -n 50
   ```
2. Look for errors in heartbeat
3. Verify network connectivity
4. Check if agent token matches database

## Files Modified

1. `backend/src/services/ssh-installer.js` - Agent installation logic
2. `docker-compose.yml` - Added environment variables
3. `scripts/setup.sh` - Interactive IP configuration
4. `README.md` - Added configuration instructions
5. `CONFIGURATION.md` - New comprehensive configuration guide
6. `AGENT-SETUP-GUIDE.md` - This file (quick reference)

## Additional Resources

- [CONFIGURATION.md](CONFIGURATION.md) - Detailed configuration guide
- [agent/README-INSTALLATION.md](agent/README-INSTALLATION.md) - Manual agent installation
- [agent/AUTO-START-SETUP.md](agent/AUTO-START-SETUP.md) - Auto-start configuration
- [API.md](API.md) - API documentation

## Need Help?

1. Check logs:
   ```bash
   # Backend logs
   docker-compose logs -f backend
   
   # Agent logs (on remote machine)
   sudo journalctl -u atlasnode-agent -f
   ```

2. Verify connectivity:
   ```bash
   # From agent machine
   curl http://YOUR_SERVER_IP:5000/api/health
   curl http://localhost:7777/health
   ```

3. Check configuration:
   ```bash
   # Control server
   cat .env | grep BACKEND
   docker-compose exec backend env | grep BACKEND
   
   # Agent machine
   sudo cat /opt/atlasnode-agent/config.json
   ```

4. Open an issue on GitHub with:
   - Error messages from logs
   - Network setup (local/cloud/hybrid)
   - Output of verification commands

---

**Summary**: Always set `BACKEND_HOST` or `BACKEND_URL` in `.env` to your server's accessible IP/hostname before adding machines!

