const express = require('express');
const db = require('../database');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Run migrations (admin only)
router.post('/', requireRole('admin'), async (req, res) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');

    console.log('Running database migrations...');

    // Add new columns to ssh_credentials if they don't exist
    try {
      await client.query(`
        ALTER TABLE ssh_credentials 
        ADD COLUMN IF NOT EXISTS encrypted_sudo_password TEXT,
        ADD COLUMN IF NOT EXISTS requires_sudo BOOLEAN DEFAULT true
      `);
      console.log('✓ Added sudo columns to ssh_credentials');
    } catch (error) {
      console.log('Note: Columns may already exist:', error.message);
    }

    // Add installation_logs table if it doesn't exist
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS installation_logs (
          id SERIAL PRIMARY KEY,
          machine_id INTEGER REFERENCES machines(id) ON DELETE CASCADE,
          stage VARCHAR(100) NOT NULL,
          log_output TEXT,
          error_output TEXT,
          success BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('✓ Created installation_logs table');
    } catch (error) {
      console.log('Note: Table may already exist:', error.message);
    }

    // Add index for installation_logs
    try {
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_installation_logs_machine 
        ON installation_logs(machine_id, created_at DESC)
      `);
      console.log('✓ Created index on installation_logs');
    } catch (error) {
      console.log('Note: Index may already exist:', error.message);
    }

    await client.query('COMMIT');

    res.json({ 
      success: true, 
      message: 'Database migrations completed successfully' 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration error:', error);
    res.status(500).json({ 
      error: 'Migration failed', 
      details: error.message 
    });
  } finally {
    client.release();
  }
});

// Get migration status
router.get('/status', requireRole('admin'), async (req, res) => {
  try {
    // Check if new columns exist
    const columnsCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'ssh_credentials' 
      AND column_name IN ('encrypted_sudo_password', 'requires_sudo')
    `);

    // Check if installation_logs table exists
    const tableCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'installation_logs'
    `);

    res.json({
      sudo_columns_exist: columnsCheck.rows.length === 2,
      installation_logs_exists: tableCheck.rows.length === 1,
      columns_found: columnsCheck.rows.map(r => r.column_name)
    });

  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check migration status' });
  }
});

module.exports = router;



