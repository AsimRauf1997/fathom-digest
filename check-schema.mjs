import pkg from 'pg';
const { Client } = pkg;

const connectionString = process.env.DATABASE_URL;
const client = new Client({ connectionString, ssl: true });

client.on('error', (err) => {
  console.error('Connection error:', err.message);
  process.exit(1);
});

client.connect((err) => {
  if (err) {
    console.error('Failed to connect:', err.message);
    process.exit(1);
  }
  
  client.query(`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  `, (err, res) => {
    if (err) {
      console.error('Query error:', err.message);
    } else {
      console.log('Tables in database:');
      res.rows.forEach(row => console.log('  -', row.table_name));
    }
    client.end(() => process.exit(err ? 1 : 0));
  });
});
