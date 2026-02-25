// Migration runner
import 'dotenv/config';
import { pool, runMigrations } from '../src/schema.js';

async function migrate() {
  try {
    console.log('🔄 Running migrations...');
    await runMigrations();
    console.log('✅ Migrations complete!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
