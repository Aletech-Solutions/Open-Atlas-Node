# AtlasNode - Configuration Guide

## Environment Variables

AtlasNode uses environment variables for configuration. Create a `.env` file in the root directory.

### Required Configuration

```bash
# Database
DB_NAME=atlasnode
DB_USER=atlasnode
DB_PASSWORD=your_secure_password_here

# Security
JWT_SECRET=your_long_random_secret_generate_with_openssl_rand_hex_32
JWT_EXPIRES_IN=7d

# Ports
BACKEND_PORT=5000
FRONTEND_PORT=3000
```

### Agent Communication Configuration (CRITICAL)

**⚠️ IMPORTANT**: Before adding any machines, you MUST configure how agents will communicate with the control server.

#### Problem
When the control server installs an agent on a remote machine, the agent needs to know how to connect back to the control server. By default, it will try `localhost:5000`, which will fail because the agent is on a different machine.

#### Solution
Set one of these environment variables in your `.env` file:

**Option 1: Set BACKEND_HOST (Recommended)**
```bash
# Your server's IP address or hostname
BACKEND_HOST=192.168.1.100
```

This will automatically construct the URL as `http://192.168.1.100:5000`

**Option 2: Set BACKEND_URL (More Control)**
```bash
# Full URL with protocol and port
BACKEND_URL=http://192.168.1.100:5000

# Or with domain name
BACKEND_URL=https://atlas.example.com

# Or external IP
BACKEND_URL=http://203.0.113.1:5000
```

### Finding Your Server's IP Address

#### Linux
```bash
# Show all IPs
hostname -I

# Or more detailed
ip addr show
```

#### Docker Container
```bash
# Find the host machine's IP (not the container IP)
hostname -I
```

### Example `.env` File

Create a `.env` file in the root directory:

```bash
# Database Configuration
DB_NAME=atlasnode
DB_USER=atlasnode
DB_PASSWORD=super_secure_password_123

# Backend Configuration
NODE_ENV=production
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
JWT_EXPIRES_IN=7d
CORS_ORIGIN=*

# Ports
BACKEND_PORT=5000
FRONTEND_PORT=3000

# CRITICAL: Agent Communication
# Set YOUR server's IP address here!
BACKEND_HOST=192.168.1.100

# Alternatively, use full URL:
# BACKEND_URL=http://192.168.1.100:5000
```

### After Changing Configuration

Always restart the services after changing the `.env` file:

```bash
docker-compose down
docker-compose up -d
```

Or for development:

```bash
# Backend
cd backend
npm run dev

# Frontend
cd frontend
npm run dev
```

## Verification

### Check if BACKEND_HOST is Set

```bash
# Check your .env file
cat .env | grep BACKEND

# Check if Docker containers see it
docker-compose exec backend env | grep BACKEND
```

### Test Agent Installation

1. **Before installing an agent**, check the logs:
   ```bash
   docker-compose logs -f backend
   ```

2. **Add a machine** from the dashboard

3. **Look for this log message**:
   ```
   [Installation Log] Using control server URL: http://YOUR_IP:5000
   ```

4. **If you see** `http://localhost:5000`, the configuration is wrong!

## Common Issues

### Issue: Agent shows "Registration failed: connect ECONNREFUSED 127.0.0.1:5000"

**Cause**: BACKEND_HOST or BACKEND_URL not set, agent trying to connect to localhost

**Solution**:
1. Set `BACKEND_HOST` in `.env` file to your server's IP
2. Restart: `docker-compose down && docker-compose up -d`
3. Reinstall the agent on the remote machine

### Issue: Agent shows "connect ETIMEDOUT"

**Cause**: Firewall blocking the connection

**Solution**:
1. Check firewall on control server:
   ```bash
   sudo ufw status
   sudo ufw allow 5000/tcp
   ```

2. Check if port is open:
   ```bash
   netstat -tlnp | grep 5000
   ```

### Issue: Using domain name but agent can't resolve

**Cause**: DNS not configured or not accessible from agent machine

**Solution**:
1. Test DNS from agent machine:
   ```bash
   nslookup your-domain.com
   ping your-domain.com
   ```

2. If DNS fails, use IP address instead:
   ```bash
   BACKEND_HOST=192.168.1.100
   ```

## Network Scenarios

### Scenario 1: All on Same Local Network
```bash
# Use local IP
BACKEND_HOST=192.168.1.100
```

### Scenario 2: Control Server on Cloud, Agents on Local Network
```bash
# Use public IP or domain
BACKEND_URL=http://203.0.113.50:5000
# Or
BACKEND_URL=https://atlas.example.com
```

### Scenario 3: Behind Reverse Proxy (Nginx, Caddy)
```bash
# Use the proxy URL
BACKEND_URL=https://atlas.example.com
```

Don't forget to configure the reverse proxy to forward to `backend:5000`

### Scenario 4: Different Port
```bash
# If you changed BACKEND_PORT to 8080
BACKEND_URL=http://192.168.1.100:8080
```

## Security Considerations

1. **Use HTTPS in production**:
   ```bash
   BACKEND_URL=https://your-domain.com
   ```

2. **Restrict CORS**:
   ```bash
   CORS_ORIGIN=https://your-dashboard-domain.com
   ```

3. **Strong JWT Secret**:
   ```bash
   # Generate with:
   openssl rand -hex 32
   ```

4. **Firewall Rules**:
   ```bash
   # Only allow agent connections from known IPs
   sudo ufw allow from 192.168.1.0/24 to any port 5000
   ```

## Advanced Configuration

### Custom Agent Port
```bash
# In the "Add Machine" form, you can specify a custom agent port
# Default is 7777, but you can use any available port
```

### Custom Heartbeat Interval
The heartbeat interval is set during agent installation (default: 60 seconds). To change it, you would need to modify the agent's `config.json` on the remote machine.

### Environment Variables in Agent

The systemd service supports environment variables. To add custom variables:

1. SSH into the agent machine
2. Edit `/etc/systemd/system/atlasnode-agent.service`
3. Add environment variables:
   ```ini
   [Service]
   Environment="CUSTOM_VAR=value"
   ```
4. Reload: `sudo systemctl daemon-reload && sudo systemctl restart atlasnode-agent`

## Troubleshooting Commands

```bash
# Check environment in Docker
docker-compose config

# Check backend logs
docker-compose logs -f backend

# Check if backend can be reached from agent machine
curl http://YOUR_SERVER_IP:5000/api/health

# Test from agent machine
curl http://localhost:7777/health
```

## Summary Checklist

Before adding machines, ensure:

- [ ] `.env` file created with all required variables
- [ ] `BACKEND_HOST` or `BACKEND_URL` set to accessible IP/hostname
- [ ] JWT_SECRET is a strong random string
- [ ] DB_PASSWORD is secure
- [ ] Services restarted after configuration: `docker-compose down && docker-compose up -d`
- [ ] Backend accessible from agent machines: `curl http://YOUR_IP:5000/api/health`
- [ ] Firewall allows connections on port 5000 (backend) and 7777 (agents)

---

For more information, see:
- [README.md](README.md) - Main documentation
- [API.md](API.md) - API documentation
- [agent/README-INSTALLATION.md](agent/README-INSTALLATION.md) - Agent installation guide

