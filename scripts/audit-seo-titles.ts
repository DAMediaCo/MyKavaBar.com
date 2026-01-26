/**
 * Database Audit Script for MyKavaBar.com
 * 
 * This script:
 * 1. Parses and normalizes City (Title Case), State (Uppercase), Zip (5-digit)
 * 2. Generates unique SEO titles: "Top Kava Bar in {{City}}, {{State}} | {{Name}}"
 * 3. Updates the seo_title column in the database
 * 
 * Usage: npx tsx scripts/audit-seo-titles.ts
 */

import { db } from "../db";
import { kavaBars } from "../db/schema";
import { sql } from "drizzle-orm";

interface ParsedAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

/**
 * Converts a string to Title Case
 */
function toTitleCase(str: string): string {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Parses an address string into normalized components
 * Expected format: "Street Address, City, State ZIP, Country"
 */
function parseAddress(address: string | null): ParsedAddress {
  if (!address) {
    return { street: '', city: '', state: '', zip: '' };
  }

  const parts = address.split(',').map(s => s.trim());
  const street = parts[0] || '';
  const city = toTitleCase(parts[1] || '');
  const stateZipPart = parts[2] || '';
  
  // Extract state (2 uppercase letters) and zip (5 digits)
  const stateMatch = stateZipPart.match(/([A-Za-z]{2})/);
  const zipMatch = stateZipPart.match(/(\d{5})/);
  
  const state = (stateMatch?.[1] || '').toUpperCase();
  const zip = (zipMatch?.[1] || '').padStart(5, '0').slice(0, 5);
  
  return { street, city, state, zip };
}

/**
 * Generates an SEO title for a kava bar
 */
function generateSeoTitle(name: string, city: string, state: string): string {
  if (!city && !state) {
    return `${name} | Kava Bar`;
  }
  if (!state) {
    return `Top Kava Bar in ${city} | ${name}`;
  }
  if (!city) {
    return `Top Kava Bar in ${state} | ${name}`;
  }
  return `Top Kava Bar in ${city}, ${state} | ${name}`;
}

async function auditDatabase() {
  console.log('🔍 Starting database audit for MyKavaBar.com...\n');

  // Fetch all bars
  const bars = await db.select().from(kavaBars);
  console.log(`📊 Found ${bars.length} kava bars to process\n`);

  const updates: { id: number; name: string; seoTitle: string; parsed: ParsedAddress }[] = [];
  const issues: { id: number; name: string; issue: string }[] = [];

  for (const bar of bars) {
    const parsed = parseAddress(bar.address);
    const seoTitle = generateSeoTitle(bar.name, parsed.city, parsed.state);
    
    updates.push({
      id: bar.id,
      name: bar.name,
      seoTitle,
      parsed
    });

    // Track issues
    if (!parsed.city) {
      issues.push({ id: bar.id, name: bar.name, issue: 'Missing city' });
    }
    if (!parsed.state) {
      issues.push({ id: bar.id, name: bar.name, issue: 'Missing state' });
    }
    if (!parsed.zip || parsed.zip === '00000') {
      issues.push({ id: bar.id, name: bar.name, issue: 'Missing/invalid zip' });
    }
  }

  // Print sample of generated titles
  console.log('📝 Sample SEO Titles (first 10):');
  console.log('─'.repeat(80));
  for (const update of updates.slice(0, 10)) {
    console.log(`  ID ${update.id}: ${update.seoTitle}`);
    console.log(`    City: "${update.parsed.city}" | State: "${update.parsed.state}" | Zip: "${update.parsed.zip}"`);
  }
  console.log('─'.repeat(80));

  // Print issues
  if (issues.length > 0) {
    console.log(`\n⚠️  Found ${issues.length} data issues:`);
    for (const issue of issues.slice(0, 20)) {
      console.log(`  - [${issue.id}] ${issue.name}: ${issue.issue}`);
    }
    if (issues.length > 20) {
      console.log(`  ... and ${issues.length - 20} more issues`);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  Total bars: ${bars.length}`);
  console.log(`  Data issues: ${issues.length}`);
  console.log(`  Ready to update: ${updates.length}`);

  return { updates, issues };
}

async function updateSeoTitles() {
  console.log('\n🚀 Updating SEO titles in database...\n');

  const bars = await db.select().from(kavaBars);
  let updated = 0;
  let failed = 0;

  for (const bar of bars) {
    const parsed = parseAddress(bar.address);
    const seoTitle = generateSeoTitle(bar.name, parsed.city, parsed.state);

    try {
      await db
        .update(kavaBars)
        .set({ seoTitle })
        .where(sql`id = ${bar.id}`);
      updated++;
      
      if (updated % 100 === 0) {
        console.log(`  ✓ Updated ${updated}/${bars.length} bars...`);
      }
    } catch (error) {
      failed++;
      console.error(`  ✗ Failed to update bar ${bar.id}: ${error}`);
    }
  }

  console.log(`\n✅ Complete! Updated ${updated} bars, ${failed} failed.`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');

  if (dryRun) {
    console.log('═'.repeat(80));
    console.log('  DRY RUN MODE - No changes will be made');
    console.log('  Run with --execute flag to apply updates');
    console.log('═'.repeat(80));
    console.log('');
  }

  try {
    await auditDatabase();

    if (!dryRun) {
      await updateSeoTitles();
    } else {
      console.log('\n💡 To apply these updates, run:');
      console.log('   npx tsx scripts/audit-seo-titles.ts --execute');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }

  process.exit(0);
}

main();
