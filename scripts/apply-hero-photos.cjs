#!/usr/bin/env node
/**
 * One-shot migration: Apply Google Places hero photos to kava bars.
 * Run with: node scripts/apply-hero-photos.cjs
 * Uses DATABASE_URL from environment.
 */
const { Pool } = require('pg');

const photoMappings = require('./hero-photo-mappings.json');

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  const pool = new Pool({ 
    connectionString: dbUrl, 
    ssl: dbUrl.includes('neon') ? { rejectUnauthorized: false } : undefined 
  });

  const barIds = Object.keys(photoMappings);
  console.log(`Applying hero photos to ${barIds.length} bars...`);

  let updated = 0;
  let errors = 0;

  // Process in batches of 50
  for (let i = 0; i < barIds.length; i += 50) {
    const batch = barIds.slice(i, i + 50);
    const promises = batch.map(async (barId) => {
      const photoUrl = photoMappings[barId];
      try {
        await pool.query(
          'UPDATE kava_bars SET hero_image_url = $1 WHERE id = $2 AND (hero_image_url IS NULL OR hero_image_url = $3)',
          [photoUrl, parseInt(barId), 'https://files.catbox.moe/5zgqxk.png']
        );
        updated++;
      } catch (err) {
        errors++;
        console.error(`Error updating bar ${barId}:`, err.message);
      }
    });
    await Promise.all(promises);
    if ((i + 50) % 200 === 0 || i + 50 >= barIds.length) {
      console.log(`Progress: ${Math.min(i + 50, barIds.length)}/${barIds.length} (${updated} updated, ${errors} errors)`);
    }
  }

  console.log(`\nDone! Updated: ${updated}, Errors: ${errors}`);
  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
