/**
 * FINAL AI SEO Validation Script for MyKavaBar.com
 * 
 * Comprehensive validation of server-side SEO injection:
 * - Fetches RAW HTML (no JavaScript execution, like a bot would see)
 * - Validates JSON-LD schema with @id and geo data
 * - Validates unique meta descriptions
 * - Validates title format
 * - Compares descriptions between bars to ensure uniqueness
 * 
 * Usage: npx tsx scripts/check-ai-seo-final.ts
 */

import { db } from "../db";
import { kavaBars } from "../db/schema";
import { sql } from "drizzle-orm";
import * as cheerio from "cheerio";

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const SAMPLE_SIZE = 10;

interface BarInfo {
  id: number;
  name: string;
  address: string;
}

interface ValidationResult {
  barId: number;
  barName: string;
  url: string;
  city: string;
  state: string;
  checks: {
    rawSchema: { pass: boolean; details: string; hasId: boolean; hasGeo: boolean };
    rawMetaDescription: { pass: boolean; details: string; content: string };
    rawTitle: { pass: boolean; details: string; content: string };
  };
  allPassed: boolean;
}

/**
 * Fetches raw HTML (mimics bot/crawler behavior - NO JavaScript)
 */
async function fetchRawHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    
    if (!response.ok) {
      console.error(`  ⚠ HTTP ${response.status}`);
      return null;
    }
    
    return await response.text();
  } catch (error) {
    console.error(`  ⚠ Fetch failed:`, error);
    return null;
  }
}

/**
 * Parses address into city and state
 */
function parseAddress(address: string): { city: string; state: string } {
  const parts = address.split(',').map(s => s.trim());
  const city = parts[1] || '';
  const stateZipPart = parts[2] || '';
  const stateMatch = stateZipPart.match(/^([A-Z]{2})/);
  return { city, state: stateMatch?.[1] || '' };
}

/**
 * Validates JSON-LD schema in raw HTML
 */
function validateRawSchema(html: string, barName: string): ValidationResult['checks']['rawSchema'] {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');
  
  let found = false;
  let hasId = false;
  let hasGeo = false;
  let details = "No JSON-LD found in raw HTML";
  
  scripts.each((_, script) => {
    const content = $(script).html();
    if (!content) return;
    
    try {
      const data = JSON.parse(content);
      if (data['@type'] === 'BarOrPub') {
        found = true;
        hasId = !!data['@id'] && data['@id'].includes('#business');
        hasGeo = !!data.geo && !!data.geo.latitude && !!data.geo.longitude;
        
        details = `@type: BarOrPub, @id: ${hasId ? '✓' : '✗'}, geo: ${hasGeo ? `(${data.geo?.latitude}, ${data.geo?.longitude})` : '✗'}`;
      }
    } catch (e) {
      // Invalid JSON
    }
  });
  
  return { pass: found && hasId && hasGeo, details, hasId, hasGeo };
}

/**
 * Validates meta description in raw HTML
 */
function validateRawMetaDescription(html: string, barName: string): ValidationResult['checks']['rawMetaDescription'] {
  const $ = cheerio.load(html);
  const content = $('meta[name="description"]').attr('content') || '';
  
  // Check for placeholder/default text
  const placeholders = [
    'Discover kava bars near you',
    'Your Nationwide Kava Bar Directory',
    'Purple Lotus',
    'Lorem ipsum'
  ];
  
  const isPlaceholder = placeholders.some(p => content.includes(p));
  const containsBarName = content.includes(barName);
  const isLongEnough = content.length >= 100;
  
  const pass = !isPlaceholder && containsBarName && isLongEnough;
  const details = pass 
    ? `Unique description (${content.length} chars)` 
    : isPlaceholder 
      ? "Contains placeholder text" 
      : !containsBarName 
        ? "Doesn't contain bar name" 
        : "Too short";
  
  return { pass, details, content };
}

/**
 * Validates title tag format in raw HTML
 */
function validateRawTitle(html: string, barName: string, city: string, state: string): ValidationResult['checks']['rawTitle'] {
  const $ = cheerio.load(html);
  const content = $('title').text();
  
  // Expected format: "Top Kava Bar in City, State | Bar Name"
  const containsBarName = content.includes(barName);
  const containsCity = city ? content.includes(city) : true;
  const hasTopKavaBar = content.includes('Top Kava Bar in');
  const hasCorrectFormat = hasTopKavaBar && containsBarName;
  
  const pass = hasCorrectFormat && containsCity;
  const details = pass
    ? `Format correct: "${content.substring(0, 50)}..."`
    : !hasTopKavaBar
      ? "Missing 'Top Kava Bar in' prefix"
      : !containsBarName
        ? "Missing bar name"
        : "Missing city";
  
  return { pass, details, content };
}

/**
 * Validates a single bar page
 */
async function validateBarPage(bar: BarInfo): Promise<ValidationResult> {
  const url = `${BASE_URL}/kava-bars/${bar.id}`;
  const { city, state } = parseAddress(bar.address);
  
  console.log(`\n🔍 [${bar.id}] ${bar.name}`);
  console.log(`   📍 ${city}${state ? `, ${state}` : ''}`);
  
  const html = await fetchRawHtml(url);
  
  if (!html) {
    return {
      barId: bar.id,
      barName: bar.name,
      url,
      city,
      state,
      checks: {
        rawSchema: { pass: false, details: "Fetch failed", hasId: false, hasGeo: false },
        rawMetaDescription: { pass: false, details: "Fetch failed", content: "" },
        rawTitle: { pass: false, details: "Fetch failed", content: "" }
      },
      allPassed: false
    };
  }
  
  const rawSchema = validateRawSchema(html, bar.name);
  const rawMetaDescription = validateRawMetaDescription(html, bar.name);
  const rawTitle = validateRawTitle(html, bar.name, city, state);
  
  console.log(`   ${rawSchema.pass ? '✅' : '❌'} RAW SCHEMA: ${rawSchema.details}`);
  console.log(`   ${rawMetaDescription.pass ? '✅' : '❌'} RAW META DESC: ${rawMetaDescription.details}`);
  console.log(`   ${rawTitle.pass ? '✅' : '❌'} RAW TITLE: ${rawTitle.details}`);
  
  const allPassed = rawSchema.pass && rawMetaDescription.pass && rawTitle.pass;
  
  return {
    barId: bar.id,
    barName: bar.name,
    url,
    city,
    state,
    checks: { rawSchema, rawMetaDescription, rawTitle },
    allPassed
  };
}

/**
 * Validates that descriptions are unique across bars
 */
function validateDescriptionUniqueness(results: ValidationResult[]): { pass: boolean; details: string } {
  const descriptions = results
    .map(r => r.checks.rawMetaDescription.content)
    .filter(d => d.length > 0);
  
  const uniqueDescriptions = new Set(descriptions);
  const allUnique = uniqueDescriptions.size === descriptions.length;
  
  if (allUnique) {
    return { pass: true, details: `All ${descriptions.length} descriptions are unique` };
  }
  
  // Find duplicates
  const counts: Record<string, number> = {};
  descriptions.forEach(d => { counts[d] = (counts[d] || 0) + 1; });
  const duplicates = Object.entries(counts).filter(([_, count]) => count > 1);
  
  return { 
    pass: false, 
    details: `Found ${duplicates.length} duplicate description(s)` 
  };
}

async function main() {
  console.log('╔' + '═'.repeat(78) + '╗');
  console.log('║  FINAL AI SEO READINESS CHECK - MyKavaBar.com                               ║');
  console.log('║  Validating RAW HTML (no JavaScript execution)                              ║');
  console.log('╚' + '═'.repeat(78) + '╝');
  console.log(`\n🌐 Target: ${BASE_URL}`);
  console.log(`📊 Sample: ${SAMPLE_SIZE} random listings\n`);
  
  // Fetch random bars
  const bars = await db
    .select({ 
      id: kavaBars.id, 
      name: kavaBars.name,
      address: kavaBars.address
    })
    .from(kavaBars)
    .orderBy(sql`RANDOM()`)
    .limit(SAMPLE_SIZE);
  
  console.log(`Found ${bars.length} bars to validate`);
  console.log('─'.repeat(80));
  
  const results: ValidationResult[] = [];
  
  for (const bar of bars) {
    const result = await validateBarPage(bar);
    results.push(result);
  }
  
  // Check description uniqueness
  console.log('\n' + '─'.repeat(80));
  console.log('🔄 DYNAMIC CHECK: Comparing descriptions across bars...');
  const uniquenessCheck = validateDescriptionUniqueness(results);
  console.log(`   ${uniquenessCheck.pass ? '✅' : '❌'} UNIQUENESS: ${uniquenessCheck.details}`);
  
  // Final Summary
  console.log('\n' + '╔' + '═'.repeat(78) + '╗');
  console.log('║  FINAL REPORT                                                               ║');
  console.log('╚' + '═'.repeat(78) + '╝');
  
  const schemaPass = results.filter(r => r.checks.rawSchema.pass).length;
  const metaPass = results.filter(r => r.checks.rawMetaDescription.pass).length;
  const titlePass = results.filter(r => r.checks.rawTitle.pass).length;
  const allPass = results.filter(r => r.allPassed).length;
  
  console.log(`\n  📋 RAW HTML Checks (what bots see):`);
  console.log(`     ├── JSON-LD Schema (@id + geo):  ${schemaPass}/${results.length}`);
  console.log(`     ├── Unique Meta Description:     ${metaPass}/${results.length}`);
  console.log(`     ├── Correct Title Format:        ${titlePass}/${results.length}`);
  console.log(`     └── Description Uniqueness:      ${uniquenessCheck.pass ? '✓ PASS' : '✗ FAIL'}`);
  
  const totalValidated = allPass;
  const isFullyReady = allPass === results.length && uniquenessCheck.pass;
  
  console.log(`\n  ${'═'.repeat(60)}`);
  if (isFullyReady) {
    console.log(`  ✅ FINAL AI SEO READINESS: ${totalValidated}/${results.length} Pages Validated`);
    console.log(`  🎉 ALL CHECKS PASSED - Site is AI crawler ready!`);
  } else {
    console.log(`  ⚠️  FINAL AI SEO READINESS: ${totalValidated}/${results.length} Pages Validated`);
    if (allPass < results.length) {
      console.log(`\n  Pages needing attention:`);
      for (const r of results.filter(r => !r.allPassed)) {
        console.log(`     - [${r.barId}] ${r.barName}`);
      }
    }
  }
  console.log(`  ${'═'.repeat(60)}\n`);
  
  process.exit(isFullyReady ? 0 : 1);
}

main().catch(console.error);
