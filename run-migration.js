const fs = require('fs');
const { Pool } = require('@neondatabase/serverless');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new Pool({ connectionString });

async function runMigration() {
  try {
    const sql = fs.readFileSync('./drizzle/0000_whole_excalibur.sql', 'utf-8');
    const statements = sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
    
    console.log(`Running ${statements.length} SQL statements...`);
    let success = 0, skipped = 0;
    
    for (const [i, stmt] of statements.entries()) {
      try {
        await pool.query(stmt);
        success++;
        process.stdout.write(`\r✓ ${success} complete, ${skipped} skipped (${i+1}/${statements.length})`);
      } catch (e) {
        if (e.message.includes('already exists') || e.message.includes('duplicate key')) {
          skipped++;
          process.stdout.write(`\r✓ ${success} complete, ${skipped} skipped (${i+1}/${statements.length})`);
        } else {
          console.error(`\n❌ Failed on statement ${i+1}:`, stmt.substring(0, 80));
          console.error('Error:', e.message);
          throw e;
        }
      }
    }
    
    console.log(`\n✅ Migration completed: ${success} applied, ${skipped} skipped`);
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigration();
