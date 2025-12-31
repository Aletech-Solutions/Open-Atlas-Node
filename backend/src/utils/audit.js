const db = require('../database');

async function logAudit(userId, machineId, action, details = {}, ipAddress = null) {
  try {
    await db.query(`
      INSERT INTO audit_logs (user_id, machine_id, action, details, ip_address)
      VALUES ($1, $2, $3, $4, $5)
    `, [userId, machineId, action, JSON.stringify(details), ipAddress]);
  } catch (error) {
    console.error('Audit logging error:', error);
    // Don't throw - logging should not break the main flow
  }
}

async function getAuditLogs(filters = {}) {
  try {
    let query = `
      SELECT 
        al.id, al.action, al.details, al.ip_address, al.created_at,
        u.username, u.email,
        m.name as machine_name, m.hostname
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN machines m ON al.machine_id = m.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (filters.userId) {
      query += ` AND al.user_id = $${paramIndex}`;
      params.push(filters.userId);
      paramIndex++;
    }

    if (filters.machineId) {
      query += ` AND al.machine_id = $${paramIndex}`;
      params.push(filters.machineId);
      paramIndex++;
    }

    if (filters.action) {
      query += ` AND al.action = $${paramIndex}`;
      params.push(filters.action);
      paramIndex++;
    }

    if (filters.startDate) {
      query += ` AND al.created_at >= $${paramIndex}`;
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      query += ` AND al.created_at <= $${paramIndex}`;
      params.push(filters.endDate);
      paramIndex++;
    }

    query += ` ORDER BY al.created_at DESC LIMIT ${filters.limit || 100}`;

    const result = await db.query(query, params);
    return result.rows;
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    throw error;
  }
}

module.exports = {
  logAudit,
  getAuditLogs
};

