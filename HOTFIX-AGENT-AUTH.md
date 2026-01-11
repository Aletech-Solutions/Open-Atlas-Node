# Hotfix: Agent Authentication Issue (401 Error)

## Problem Identified

Agents were getting `401 Unauthorized` error when trying to register because:

1. **Global JWT Authentication**: All `/api/agents/*` routes were protected with `authenticateToken` middleware (expecting JWT from web users)
2. **Race Condition**: Agent token was saved to database AFTER installation, but agent tried to register IMMEDIATELY
3. **Wrong Authentication Type**: Agents use `agent_token`, not JWT tokens

## Fixes Applied

### 1. Remove Global JWT from Agent Routes (`backend/src/index.js`)

**Before:**
```javascript
app.use('/api/agents', authenticateToken, agentRoutes);
```

**After:**
```javascript
// Agent routes use their own authentication (not JWT)
app.use('/api/agents', agentRoutes);
```

### 2. Save Token BEFORE Installation (`backend/src/services/ssh-installer.js`)

**Before:**
- Generate token
- Install agent
- Save token to database ❌ (race condition!)

**After:**
- Generate token
- **Save token to database** ✅
- Install agent
- Update status to 'online'

### 3. Improve Register Endpoint (`backend/src/routes/agents.js`)

**Changes:**
- Verifies machine exists
- Verifies agent token matches database
- Allows re-registration (doesn't require `status = 'installing'`)
- Better error logging with token preview

## How to Apply Fix

### Step 1: Rebuild Backend

```bash
# Stop services
docker-compose down

# Rebuild and restart
docker-compose up -d --build backend

# Check logs
docker-compose logs -f backend
```

### Step 2: Reinstall Agent on Remote Machine

**Option A: From Dashboard (Recommended)**
1. Go to dashboard
2. Remove the failing machine
3. Re-add the machine with same SSH credentials
4. Agent will be reinstalled with fixes

**Option B: Manual Fix on Agent Machine**

If you don't want to remove/re-add:

```bash
# SSH into the agent machine
ssh user@agent-machine

# The agent and token are already there, just restart
sudo systemctl restart atlasnode-agent

# Check logs
sudo journalctl -u atlasnode-agent -f
```

The agent should now successfully register!

## Expected Results

### Before Fix
```
jan 11 20:52:52 node[880842]: AtlasNode Agent running on port 7777
jan 11 20:52:52 node[880842]: Registration failed: Request failed with status code 401
jan 11 20:52:52 node[880842]: Heartbeat error: Request failed with status code 401
jan 11 20:52:52 node[880842]: [Discovery] Response: 403 { error: 'Invalid agent token' }
```

### After Fix
```
jan 11 21:00:12 node[123456]: AtlasNode Agent running on port 7777
jan 11 21:00:12 node[123456]: ✓ Registration successful
jan 11 21:00:12 node[123456]: ✓ Heartbeat sent successfully
jan 11 21:00:42 node[123456]: ✓ Heartbeat sent successfully
jan 11 21:00:42 node[123456]: [Discovery] ✓ Sent 5 screen sessions
jan 11 21:00:42 node[123456]: [Discovery] ✓ Sent 12 open ports
```

Dashboard should show machine as **"online"** 🟢

## Verification Checklist

After applying fixes:

- [ ] Backend rebuilt and running: `docker-compose ps`
- [ ] No JWT errors in backend logs: `docker-compose logs backend | grep "authenticateToken"`
- [ ] Agent registration successful: `sudo journalctl -u atlasnode-agent -n 20`
- [ ] Heartbeats flowing: `sudo journalctl -u atlasnode-agent -f | grep "Heartbeat"`
- [ ] Machine shows "online" in dashboard
- [ ] System metrics visible in dashboard
- [ ] No 401/403 errors in agent logs

## Technical Details

### Authentication Flow (Fixed)

```
┌─────────────────────────────────────────────────────────────────┐
│ Installation Phase                                              │
├─────────────────────────────────────────────────────────────────┤
│ 1. Backend generates agent_token                                │
│ 2. Backend saves token to database (status = 'installing') ✅   │
│ 3. Backend installs agent via SSH                               │
│ 4. Backend creates config.json with token on remote machine     │
│ 5. Agent starts via systemd                                     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Registration Phase                                              │
├─────────────────────────────────────────────────────────────────┤
│ 1. Agent sends: POST /api/agents/register                       │
│    Body: { machine_id, agent_token, system_info }              │
│                                                                 │
│ 2. Backend checks:                                              │
│    - Machine exists? ✅                                         │
│    - Token matches database? ✅                                 │
│                                                                 │
│ 3. Backend updates:                                             │
│    - status = 'online'                                          │
│    - os_info = system_info                                      │
│    - last_seen = NOW                                            │
│                                                                 │
│ 4. Response: { success: true, message, machine }               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ Heartbeat Phase (Every 60s)                                     │
├─────────────────────────────────────────────────────────────────┤
│ 1. Agent sends: POST /api/agents/heartbeat                      │
│    Headers: { 'x-agent-token': agent_token }                   │
│    Body: { system_info, metrics }                              │
│                                                                 │
│ 2. Backend middleware authenticateAgent:                        │
│    - Checks x-agent-token header                                │
│    - Queries: SELECT * FROM machines WHERE agent_token = ?     │
│    - Attaches req.machine                                       │
│                                                                 │
│ 3. Backend updates:                                             │
│    - status = 'online'                                          │
│    - last_seen = NOW                                            │
│    - os_info, hardware_info                                     │
│    - Stores metrics                                             │
└─────────────────────────────────────────────────────────────────┘
```

### Why JWT Auth Was Wrong

- **JWT tokens** (`authenticateToken`): For web dashboard users
  - Format: `Authorization: Bearer eyJhbGciOiJIUzI1NiIs...`
  - Contains: userId, username, role
  - Used by: Frontend → Backend API calls

- **Agent tokens** (`authenticateAgent`): For machine agents
  - Format: `x-agent-token: abc123def456...` (simple hex string)
  - Contains: Just a random 32-byte hex string
  - Used by: Agent → Backend heartbeat/discovery

Mixing them caused authentication to fail!

## Files Modified

1. `backend/src/index.js` - Removed global JWT from agent routes
2. `backend/src/services/ssh-installer.js` - Save token before installation
3. `backend/src/routes/agents.js` - Improved register endpoint
4. `HOTFIX-AGENT-AUTH.md` - This file (documentation)

## Rollback (If Needed)

If issues occur, rollback:

```bash
git checkout HEAD~1 backend/src/index.js
git checkout HEAD~1 backend/src/services/ssh-installer.js
git checkout HEAD~1 backend/src/routes/agents.js
docker-compose up -d --build backend
```

## Support

If you still see 401/403 errors after applying fixes:

1. **Check backend logs:**
   ```bash
   docker-compose logs -f backend | grep -i "registration\|heartbeat\|agent"
   ```

2. **Check agent logs:**
   ```bash
   ssh user@agent-machine
   sudo journalctl -u atlasnode-agent -n 50 --no-pager
   ```

3. **Verify token in database:**
   ```bash
   docker-compose exec database psql -U atlasnode -d atlasnode
   SELECT id, name, agent_token, status FROM machines WHERE id = YOUR_MACHINE_ID;
   ```

4. **Verify token on agent machine:**
   ```bash
   ssh user@agent-machine
   sudo cat /opt/atlasnode-agent/config.json | grep agentToken
   ```

Tokens should match!

---

**Status**: ✅ Fixed  
**Tested**: Yes  
**Breaking Changes**: None (backward compatible)  
**Migration Required**: No (just rebuild backend and restart agents)

