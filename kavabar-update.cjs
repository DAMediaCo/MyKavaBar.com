const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const sql = neon(process.env.DATABASE_URL);

async function run() {
  const csv = fs.readFileSync('/Users/dave/clawd/kavabar-import.csv', 'utf8');
  const lines = csv.trim().split('\n');
  const csvBars = [];

  for (let i = 1; i < lines.length; i++) {
    const row = [];
    let current = '', inQuote = false;
    for (const ch of lines[i]) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { row.push(current.trim()); current = ''; continue; }
      current += ch;
    }
    row.push(current.trim());
    const bar = {
      id: parseInt(row[0]),
      name: row[1] || '',
      address: row[4] || '',
      phone: row[5] || null,
    };
    if (!isNaN(bar.id)) csvBars.push(bar);
  }

  const csvMap = new Map(csvBars.map(b => [b.id, b]));
  const csvIds = new Set(csvMap.keys());
  console.log('CSV bars:', csvBars.length);

  const dbBars = await sql`SELECT id, name, address, phone, deleted_at FROM kava_bars`;
  console.log('DB bars:', dbBars.length);

  const toUpdate = [];
  const toDeactivate = [];

  dbBars.forEach(db => {
    if (csvIds.has(db.id)) {
      toUpdate.push({ ...csvMap.get(db.id), restore: !!db.deleted_at });
    } else if (!db.deleted_at) {
      toDeactivate.push(db.id);
    }
  });

  console.log('Will update:', toUpdate.length);
  console.log('Will deactivate:', toDeactivate.length);

  let updated = 0, deactivated = 0, errors = 0;

  for (const bar of toUpdate) {
    try {
      const phoneVal = (bar.phone && bar.phone.trim()) ? bar.phone.trim() : null;
      if (bar.restore) {
        await sql`UPDATE kava_bars SET name=${bar.name}, address=${bar.address}, phone=${phoneVal}, deleted_at=NULL WHERE id=${bar.id}`;
      } else {
        await sql`UPDATE kava_bars SET name=${bar.name}, address=${bar.address}, phone=${phoneVal} WHERE id=${bar.id}`;
      }
      updated++;
      if (updated % 50 === 0) console.log('  Updated', updated, '/', toUpdate.length);
    } catch (e) {
      console.error('Update error id=' + bar.id + ':', e.message);
      errors++;
    }
  }
  console.log('Updates done:', updated);

  const now = new Date().toISOString();
  for (let i = 0; i < toDeactivate.length; i += 50) {
    const batch = toDeactivate.slice(i, i + 50);
    try {
      await sql`UPDATE kava_bars SET deleted_at=${now} WHERE id = ANY(${batch})`;
      deactivated += batch.length;
      console.log('  Deactivated', deactivated, '/', toDeactivate.length);
    } catch (e) {
      console.error('Deactivate batch error:', e.message);
      errors++;
    }
  }

  console.log('\n=== DONE ===');
  console.log('Updated:', updated);
  console.log('Deactivated:', deactivated);
  console.log('Errors:', errors);

  // Final count
  const counts = await sql`SELECT count(*) total, count(*) filter(where deleted_at is null) live, count(*) filter(where deleted_at is not null) deactivated FROM kava_bars`;
  console.log('\nDB now:', JSON.stringify(counts[0]));
}

run().catch(e => { console.error(e.message); process.exit(1); });
