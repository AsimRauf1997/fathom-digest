import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';

const connectionString = process.env.DATABASE_URL;
console.log('Connection string:', connectionString ? 'set' : 'not set');

const client = new Client({ connectionString });

async function runMigration() {
  try {
    console.log('Connecting...');
    await client.connect();
    console.log('✅ Connected to database');

    const sql = fs.readFileSync('./drizzle/0000_whole_excalibur.sql', 'utf-8');
    const statements = sql.split('--> statement-breakpoint')
      .map(s => s.trim())
      .filter(Boolean);

    console.log(`Running ${statements.length} SQL statements...`);
    let success = 0, skipped = 0;

    for (const [i, stmt] of statements.entries()) {
      try {
        await client.query(stmt);
        success++;
        process.stdout.write(`\r✓ ${success} applied, ${skipped} skipped (${i+1}/${statements.length})`);
      } catch (e) {
        if (e.message.includes('already exists') || e.message.includes('duplicate key')) {
          skipped++;
          process.stdout.write(`\r✓ ${success} applied, ${skipped} skipped (${i+1}/${statements.length})`);
        } else {
          console.error(`\n❌ Failed:`, stmt.substring(0, 80));
          console.error('Error:', e.message);
          throw e;
        }
      }
    }

    console.log(`\n✅ Migration completed: ${success} applied, ${skipped} skipped`);
  } catch (err) {
    console.error('❌ Migration error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
