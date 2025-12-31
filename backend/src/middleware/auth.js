const jwt = require('jsonwebtoken');
const db = require('../database');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, payload) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    try {
      // Fetch user from database
      const result = await db.query(
        'SELECT id, username, email, role FROM users WHERE id = $1',
        [payload.userId]
      );

      if (result.rows.length === 0) {
        return res.status(403).json({ error: 'User not found' });
      }

      req.user = result.rows[0];
      next();
    } catch (error) {
      console.error('Auth middleware error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  });
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

// Authenticate agent requests
async function authenticateAgent(req, res, next) {
  const agentToken = req.headers['x-agent-token'];

  if (!agentToken) {
    return res.status(401).json({ error: 'Agent token required' });
  }

  try {
    const result = await db.query(
      'SELECT id, name, status FROM machines WHERE agent_token = $1',
      [agentToken]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Invalid agent token' });
    }

    req.machine = result.rows[0];
    next();
  } catch (error) {
    console.error('Agent auth error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
}

module.exports = {
  authenticateToken,
  requireRole,
  authenticateAgent
};

