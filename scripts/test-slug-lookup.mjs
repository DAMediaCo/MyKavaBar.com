// Test slug lookup with Neon HTTP driver (same as server uses)
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
const sqlClient = neon(DATABASE_URL);
const db = drizzle(sqlClient);

const paramId = 'green-turtle-kava-bar-daytona-beach';

console.log('Test 1: REGEXP_REPLACE via db.execute()');
try {
  const result = await db.execute(sql`
    SELECT id, name FROM kava_bars k
    WHERE LOWER(REGEXP_REPLACE(k.name, '[^a-zA-Z0-9]+', '-', 'g')) = ${paramId}
    LIMIT 1
  `);
  console.log('✅ Result:', result.rows);
} catch(e) {
  console.error('❌ Error:', e.message);
}

console.log('\nTest 2: slug column via db.execute()');
try {
  const result = await db.execute(sql`
    SELECT id, name FROM kava_bars k
    WHERE k.slug = ${paramId}
    LIMIT 1
  `);
  console.log('✅ Result:', result.rows);
} catch(e) {
  console.error('❌ Error:', e.message);
}

console.log('\nTest 3: Direct neon() query (no drizzle wrapper)');
try {
  const rows = await sqlClient`SELECT id, name FROM kava_bars WHERE slug = ${paramId} LIMIT 1`;
  console.log('✅ Result:', rows);
} catch(e) {
  console.error('❌ Error:', e.message);
}
