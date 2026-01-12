const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'atlasnode',
  user: process.env.DB_USER || 'atlasnode',
  password: process.env.DB_PASSWORD || 'atlasnode',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

async function initialize() {
  try {
    await pool.query('SELECT NOW()');
    await runMigrations();
    return true;
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  }
}

async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Migration tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get current version
    const versionResult = await client.query('SELECT MAX(version) as version FROM schema_migrations');
    const currentVersion = versionResult.rows[0].version || 0;

    // Migration 1: Initial schema
    if (currentVersion < 1) {
      console.log('Running migration 1: Initial schema');

      // Users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('admin', 'viewer')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Machines table
      await client.query(`
        CREATE TABLE IF NOT EXISTS machines (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          hostname VARCHAR(255) NOT NULL,
          ip_address VARCHAR(45) NOT NULL,
          ssh_port INTEGER DEFAULT 22,
          ssh_username VARCHAR(50) NOT NULL,
          agent_token VARCHAR(255) UNIQUE,
          agent_port INTEGER DEFAULT 7777,
          status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'error', 'installing')),
          os_info JSONB,
          hardware_info JSONB,
          last_seen TIMESTAMP,
          added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // SSH credentials table (encrypted)
      await client.query(`
        CREATE TABLE IF NOT EXISTS ssh_credentials (
          id SERIAL PRIMARY KEY,
          machine_id INTEGER UNIQUE REFERENCES machines(id) ON DELETE CASCADE,
          auth_method VARCHAR(20) CHECK (auth_method IN ('password', 'key')),
          encrypted_password TEXT,
          encrypted_private_key TEXT,
          requires_sudo BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Audit logs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          machine_id INTEGER REFERENCES machines(id) ON DELETE SET NULL,
          action VARCHAR(100) NOT NULL,
          details JSONB,
          ip_address VARCHAR(45),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Metrics table (optional, for historical data)
      await client.query(`
        CREATE TABLE IF NOT EXISTS metrics (
          id SERIAL PRIMARY KEY,
          machine_id INTEGER REFERENCES machines(id) ON DELETE CASCADE,
          metric_type VARCHAR(50) NOT NULL,
          metric_data JSONB NOT NULL,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Installation logs table
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

      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_machines_agent_token ON machines(agent_token)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_metrics_machine_timestamp ON metrics(machine_id, timestamp DESC)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_installation_logs_machine ON installation_logs(machine_id, created_at DESC)');

      await client.query('INSERT INTO schema_migrations (version) VALUES (1)');
      console.log('✓ Migration 1 completed');
    }

    // Migration 2: Add encrypted_sudo_password column
    if (currentVersion < 2) {
      console.log('Running migration 2: Add encrypted_sudo_password column');
      
      // Check if column already exists
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'ssh_credentials' 
        AND column_name = 'encrypted_sudo_password'
      `);

      if (columnCheck.rows.length === 0) {
        await client.query(`
          ALTER TABLE ssh_credentials 
          ADD COLUMN encrypted_sudo_password TEXT
        `);
        console.log('✓ Added encrypted_sudo_password column');
      } else {
        console.log('✓ encrypted_sudo_password column already exists');
      }

      await client.query('INSERT INTO schema_migrations (version) VALUES (2)');
      console.log('✓ Migration 2 completed');
    }

    // Migration 3: Add requires_sudo column
    if (currentVersion < 3) {
      console.log('Running migration 3: Add requires_sudo column');
      
      // Check if column already exists
      const columnCheck = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'ssh_credentials' 
        AND column_name = 'requires_sudo'
      `);

      if (columnCheck.rows.length === 0) {
        await client.query(`
          ALTER TABLE ssh_credentials 
          ADD COLUMN requires_sudo BOOLEAN DEFAULT true
        `);
        console.log('✓ Added requires_sudo column');
      } else {
        console.log('✓ requires_sudo column already exists');
      }

      await client.query('INSERT INTO schema_migrations (version) VALUES (3)');
      console.log('✓ Migration 3 completed');
    }

    // Migration 4: Add screen sessions and ports tables
    if (currentVersion < 4) {
      console.log('Running migration 4: Add screen sessions and ports tracking');

      // Screen sessions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS screen_sessions (
          id SERIAL PRIMARY KEY,
          machine_id INTEGER REFERENCES machines(id) ON DELETE CASCADE,
          screen_id VARCHAR(50) NOT NULL,
          name VARCHAR(255),
          state VARCHAR(20),
          owner_user VARCHAR(50),
          started_at TIMESTAMP,
          last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(machine_id, screen_id)
        )
      `);

      // Open ports table
      await client.query(`
        CREATE TABLE IF NOT EXISTS open_ports (
          id SERIAL PRIMARY KEY,
          machine_id INTEGER REFERENCES machines(id) ON DELETE CASCADE,
          port INTEGER NOT NULL,
          protocol VARCHAR(10) NOT NULL,
          address VARCHAR(45),
          pid INTEGER,
          process VARCHAR(255),
          owner_user VARCHAR(50),
          last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(machine_id, port, protocol, address)
        )
      `);

      // Port labels table
      await client.query(`
        CREATE TABLE IF NOT EXISTS port_labels (
          id SERIAL PRIMARY KEY,
          machine_id INTEGER REFERENCES machines(id) ON DELETE CASCADE,
          port INTEGER NOT NULL,
          label VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(machine_id, port)
        )
      `);

      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_screen_sessions_machine ON screen_sessions(machine_id, last_seen DESC)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_open_ports_machine ON open_ports(machine_id, port)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_port_labels_machine ON port_labels(machine_id, port)');

      await client.query('INSERT INTO schema_migrations (version) VALUES (4)');
      console.log('✓ Migration 4 completed');
    }

    // Migration 5: Add control_server_url to machines table
    if (currentVersion < 5) {
      console.log('Running migration 5: Add control_server_url to machines table');

      // Add control_server_url column
      await client.query(`
        ALTER TABLE machines 
        ADD COLUMN IF NOT EXISTS control_server_url VARCHAR(255)
      `);

      console.log('✓ Added control_server_url column to machines table');

      await client.query('INSERT INTO schema_migrations (version) VALUES (5)');
      console.log('✓ Migration 5 completed');
    }

    await client.query('COMMIT');
    console.log('✓ All database migrations completed');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration error:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 100) {
      console.warn(`Slow query (${duration}ms):`, text);
    }
    return res;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

async function close() {
  await pool.end();
}

module.exports = {
  initialize,
  query,
  close,
  pool
};

