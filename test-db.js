const { Pool } = require('@neondatabase/serverless');

const connectionString = process.env.DATABASE_URL;
console.log('Connection string:', connectionString ? '✓ Set' : '✗ Not set');

const pool = new Pool({ connectionString });

pool.query('SELECT 1 as test', (err, res) => {
  if (err) {
    console.error('Connection failed:', err.code, err.message);
  } else {
    console.log('✅ Database connection successful');
  }
  process.exit(err ? 1 : 0);
});
