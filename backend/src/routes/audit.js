const express = require('express');
const { getAuditLogs } = require('../utils/audit');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Get audit logs (admin only)
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const filters = {
      userId: req.query.user_id,
      machineId: req.query.machine_id,
      action: req.query.action,
      startDate: req.query.start_date,
      endDate: req.query.end_date,
      limit: parseInt(req.query.limit) || 100
    };

    const logs = await getAuditLogs(filters);

    res.json({ logs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;

