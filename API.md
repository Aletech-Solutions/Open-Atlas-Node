# AtlasNode - Documentação da API

Base URL: `http://localhost:5000/api`

## Autenticação

A maioria dos endpoints requer autenticação via JWT token no header:
```
Authorization: Bearer <token>
```

## Endpoints

### Auth

#### Register
```http
POST /auth/register
Content-Type: application/json

{
  "username": "admin",
  "email": "admin@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

#### Login
```http
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

#### Get Current User
```http
GET /auth/me
Authorization: Bearer <token>
```

**Response:**
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

---

### Machines

#### List All Machines
```http
GET /machines
Authorization: Bearer <token>
```

**Response:**
```json
{
  "machines": [
    {
      "id": 1,
      "name": "Main Server",
      "hostname": "server.local",
      "ip_address": "192.168.1.100",
      "ssh_port": 22,
      "agent_port": 7777,
      "status": "online",
      "os_info": {
        "platform": "linux",
        "distro": "Ubuntu",
        "release": "22.04"
      },
      "hardware_info": {
        "cpu": {
          "brand": "Intel Core i7",
          "cores": 8
        },
        "memory": {
          "total": 17179869184
        }
      },
      "last_seen": "2024-12-18T10:30:00Z",
      "created_at": "2024-12-18T09:00:00Z",
      "added_by_username": "admin"
    }
  ]
}
```

#### Get Single Machine
```http
GET /machines/:id
Authorization: Bearer <token>
```

#### Add New Machine (Admin Only)
```http
POST /machines
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Server 2",
  "hostname": "server2.local",
  "ip_address": "192.168.1.101",
  "ssh_port": 22,
  "ssh_username": "root",
  "auth_method": "password",
  "password": "ssh_password_here"
}
```

**Or with SSH key:**
```json
{
  "name": "Server 2",
  "hostname": "server2.local",
  "ip_address": "192.168.1.101",
  "ssh_port": 22,
  "ssh_username": "root",
  "auth_method": "key",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\n..."
}
```

**Response:**
```json
{
  "message": "Machine added successfully. Agent installation started.",
  "machine": {
    "id": 2,
    "name": "Server 2",
    "hostname": "server2.local",
    "ip_address": "192.168.1.101",
    "ssh_port": 22,
    "status": "installing"
  }
}
```

#### Delete Machine (Admin Only)
```http
DELETE /machines/:id
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Machine deleted successfully"
}
```

#### Get Machine Metrics
```http
GET /machines/:id/metrics?type=cpu&limit=50
Authorization: Bearer <token>
```

**Query Parameters:**
- `type` (optional): Filter by metric type (cpu, memory, disk, network)
- `limit` (optional): Number of records to return (default: 100)

**Response:**
```json
{
  "metrics": [
    {
      "metric_type": "cpu",
      "metric_data": {
        "load": 45.2,
        "idle": 54.8
      },
      "timestamp": "2024-12-18T10:30:00Z"
    }
  ]
}
```

#### Execute Action on Machine (Admin Only)
```http
POST /machines/:id/action
Authorization: Bearer <token>
Content-Type: application/json

{
  "action": "reboot"
}
```

**Available Actions:**
- `shutdown` - Shutdown machine
- `reboot` - Reboot machine
- `get_cpu` - Get current CPU info
- `get_memory` - Get current memory info
- `get_disk` - Get disk info
- `get_network` - Get network info
- `get_info` - Get all system info

**Response:**
```json
{
  "success": true,
  "result": {
    "message": "Reboot initiated"
  }
}
```

---

### Terminal

#### Create Terminal Session
```http
POST /terminal/create/:machineId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "sessionId": "a1b2c3d4e5f6...",
  "message": "Terminal session created"
}
```

#### Write to Terminal
```http
POST /terminal/write/:sessionId
Authorization: Bearer <token>
Content-Type: application/json

{
  "data": "ls -la\n"
}
```

**Response:**
```json
{
  "success": true
}
```

#### Read from Terminal (Server-Sent Events)
```http
GET /terminal/read/:sessionId
Authorization: Bearer <token>
```

**Response (SSE Stream):**
```
data: {"data":"base64_encoded_terminal_output"}

data: {"type":"close"}
```

#### Resize Terminal
```http
POST /terminal/resize/:sessionId
Authorization: Bearer <token>
Content-Type: application/json

{
  "rows": 24,
  "cols": 80
}
```

#### Close Terminal Session
```http
DELETE /terminal/:sessionId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "message": "Terminal session closed"
}
```

---

### Agents (Used by Agent, not frontend)

#### Heartbeat
```http
POST /agents/heartbeat
X-Agent-Token: <agent_token>
Content-Type: application/json

{
  "system_info": {
    "os": {
      "platform": "linux",
      "distro": "Ubuntu",
      "release": "22.04"
    },
    "hardware": {
      "cpu": { "brand": "Intel Core i7", "cores": 8 },
      "memory": { "total": 17179869184 }
    }
  },
  "metrics": {
    "cpu": { "load": 45.2, "idle": 54.8 },
    "memory": {
      "used": 8589934592,
      "free": 8589934592,
      "usedPercent": "50.00"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Heartbeat received"
}
```

#### Register Agent
```http
POST /agents/register
Content-Type: application/json

{
  "machine_id": 1,
  "agent_token": "unique_agent_token_here",
  "system_info": {
    "platform": "linux",
    "distro": "Ubuntu",
    "hostname": "server1"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Agent registered successfully",
  "machine": {
    "id": 1,
    "name": "Main Server"
  }
}
```

---

## WebSocket

### Connection
```javascript
const ws = new WebSocket('ws://localhost:5000/ws');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your_jwt_token_here'
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Message:', data);
};
```

### Message Types

#### From Client

**Authenticate:**
```json
{
  "type": "auth",
  "token": "jwt_token"
}
```

**Ping:**
```json
{
  "type": "ping"
}
```

#### From Server

**Auth Success:**
```json
{
  "type": "auth_success",
  "message": "Authenticated successfully"
}
```

**Pong:**
```json
{
  "type": "pong",
  "timestamp": 1703000000000
}
```

**Machine Status Update:**
```json
{
  "type": "machine_status",
  "machineId": 1,
  "status": "online",
  "data": {
    "name": "Main Server"
  },
  "timestamp": "2024-12-18T10:30:00Z"
}
```

**Machine Metrics:**
```json
{
  "type": "machine_metrics",
  "machineId": 1,
  "metrics": {
    "cpu": { "load": 45.2 },
    "memory": { "usedPercent": "50.00" }
  },
  "timestamp": "2024-12-18T10:30:00Z"
}
```

**Error:**
```json
{
  "type": "error",
  "message": "Error description"
}
```

---

## Error Responses

All endpoints may return error responses:

**400 Bad Request:**
```json
{
  "error": "Missing required fields"
}
```

**401 Unauthorized:**
```json
{
  "error": "Access token required"
}
```

**403 Forbidden:**
```json
{
  "error": "Insufficient permissions"
}
```

**404 Not Found:**
```json
{
  "error": "Machine not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error"
}
```

---

## Rate Limiting

Auth endpoints are rate limited to 100 requests per 15 minutes per IP.

---

## Examples with cURL

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@example.com",
    "password": "password123"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "password123"
  }'
```

### List Machines
```bash
curl http://localhost:5000/api/machines \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Add Machine
```bash
curl -X POST http://localhost:5000/api/machines \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Server 1",
    "hostname": "server1.local",
    "ip_address": "192.168.1.100",
    "ssh_port": 22,
    "ssh_username": "root",
    "auth_method": "password",
    "password": "ssh_password"
  }'
```

### Execute Action
```bash
curl -X POST http://localhost:5000/api/machines/1/action \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"action": "get_info"}'
```

---

Para mais informações sobre a arquitetura e fluxo de dados, consulte PROJECT_STRUCTURE.md

