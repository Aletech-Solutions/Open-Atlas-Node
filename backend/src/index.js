require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { initWebSocket } = require('./websocket');
const db = require('./database');
const authRoutes = require('./routes/auth');
const machineRoutes = require('./routes/machines');
const agentRoutes = require('./routes/agents');
const terminalRoutes = require('./routes/terminal');
const auditRoutes = require('./routes/audit');
const migrateRoutes = require('./routes/migrate');
const discoveryRoutes = require('./routes/discovery');
const { authenticateToken } = require('./middleware/auth');

const app = express();
const httpServer = createServer(app);

// Trust proxy (required when behind nginx/docker)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting if no IP can be determined
  skip: (req) => !req.ip
});
app.use('/api/auth', limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check (public)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/machines', authenticateToken, machineRoutes);
// Agent routes use their own authentication (not JWT)
app.use('/api/agents', agentRoutes);

// Terminal routes - SSE and write endpoints need special handling
app.use('/api/terminal', (req, res, next) => {
  // Allow read, write, and resize without JWT (sessionId is the security token)
  const sessionRoutes = ['/read/', '/write/', '/resize/'];
  const needsSessionAuth = sessionRoutes.some(route => req.path.startsWith(route));
  
  if (needsSessionAuth) {
    return next(); // sessionId validates access
  }
  
  // Create and delete require authentication
  return authenticateToken(req, res, next);
}, terminalRoutes);

app.use('/api/audit', authenticateToken, auditRoutes);
app.use('/api/migrate', authenticateToken, migrateRoutes);
app.use('/api/discovery', discoveryRoutes); // Mixed auth: agents use token, UI uses JWT

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize database and start server
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    // Initialize database
    await db.initialize();
    console.log('✓ Database initialized');

    // Initialize WebSocket
    initWebSocket(httpServer);
    console.log('✓ WebSocket server initialized');

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`✓ AtlasNode Control Server running on port ${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    db.close();
    process.exit(0);
  });
});

start();

