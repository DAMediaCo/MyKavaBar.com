/**
 * AI SEO Validation Script for MyKavaBar.com
 * 
 * Checks that kava bar listings are optimized for AI search by validating:
 * - JSON-LD Schema (BarOrPub with geo coordinates)
 * - Unique content (not placeholder text)
 * - Meta title format
 * - SameAs social links
 * 
 * Usage: npx tsx scripts/check-ai-seo.ts
 */

import { db } from "../db";
import { kavaBars } from "../db/schema";
import { sql } from "drizzle-orm";
import * as cheerio from "cheerio";

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const SAMPLE_SIZE = 10;

interface CheckResult {
  barId: number;
  name: string;
  url: string;
  checks: {
    schema: { pass: boolean; details: string };
    uniqueContent: { pass: boolean; details: string };
    metaTitle: { pass: boolean; details: string };
    sameAs: { pass: boolean; details: string };
  };
  passed: boolean;
}

/**
 * Fetches HTML from a URL
 */
async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MyKavaBar-SEO-Checker/1.0'
      }
    });
    if (!response.ok) {
      console.error(`  ⚠ HTTP ${response.status} for ${url}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    console.error(`  ⚠ Failed to fetch ${url}:`, error);
    return null;
  }
}

/**
 * Extracts JSON-LD data from HTML
 */
function extractJsonLd(html: string): any | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]');
  
  for (let i = 0; i < scripts.length; i++) {
    try {
      const content = $(scripts[i]).html();
      if (content) {
        const data = JSON.parse(content);
        if (data['@type'] === 'BarOrPub' || data['@type'] === 'LocalBusiness') {
          return data;
        }
      }
    } catch (e) {
      // Continue to next script
    }
  }
  return null;
}

/**
 * Checks if JSON-LD schema is valid for AI search
 */
function checkSchema(jsonLd: any): { pass: boolean; details: string } {
  if (!jsonLd) {
    return { pass: false, details: "No JSON-LD schema found" };
  }
  
  if (jsonLd['@type'] !== 'BarOrPub') {
    return { pass: false, details: `Wrong @type: ${jsonLd['@type']} (expected BarOrPub)` };
  }
  
  if (!jsonLd.geo || !jsonLd.geo.latitude || !jsonLd.geo.longitude) {
    return { pass: false, details: "Missing geo coordinates" };
  }
  
  if (!jsonLd['@id']) {
    return { pass: false, details: "Missing @id" };
  }
  
  return { pass: true, details: `Valid BarOrPub with geo (${jsonLd.geo.latitude}, ${jsonLd.geo.longitude})` };
}

/**
 * Checks if page has unique content (not placeholder)
 */
function checkUniqueContent(html: string, barName: string): { pass: boolean; details: string } {
  const $ = cheerio.load(html);
  
  // Look for description text in the About section
  const aboutSection = $('h2:contains("About")').parent().find('p').text();
  const bodyText = $('body').text();
  
  // Check for placeholder patterns
  const placeholders = [
    'Purple Lotus',
    'Welcome to [Name]',
    'We are a new addition',
    'Lorem ipsum',
    'placeholder'
  ];
  
  for (const placeholder of placeholders) {
    if (bodyText.toLowerCase().includes(placeholder.toLowerCase())) {
      return { pass: false, details: `Contains placeholder text: "${placeholder}"` };
    }
  }
  
  // Check if description contains bar name and is long enough
  if (aboutSection.length < 100) {
    return { pass: false, details: `Description too short (${aboutSection.length} chars)` };
  }
  
  if (!aboutSection.includes(barName)) {
    return { pass: false, details: "Description doesn't include bar name" };
  }
  
  return { pass: true, details: `Unique content found (${aboutSection.length} chars)` };
}

/**
 * Checks if meta title follows the correct pattern
 */
function checkMetaTitle(html: string): { pass: boolean; details: string } {
  const $ = cheerio.load(html);
  const title = $('title').text();
  
  if (!title) {
    return { pass: false, details: "No <title> tag found" };
  }
  
  // Check for pattern: "Top Kava Bar in [City], [State] | [Name]" or similar
  const patterns = [
    /Top Kava Bar in .+\|.+/i,
    /Kava Bar in .+\|.+/i,
    /.+\| .+ Kava Bar/i
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(title)) {
      return { pass: true, details: `Valid title: "${title.substring(0, 60)}..."` };
    }
  }
  
  return { pass: false, details: `Title doesn't match pattern: "${title.substring(0, 60)}..."` };
}

/**
 * Checks if JSON-LD includes sameAs array for social media
 */
function checkSameAs(jsonLd: any): { pass: boolean; details: string } {
  if (!jsonLd) {
    return { pass: false, details: "No JSON-LD schema found" };
  }
  
  if (!jsonLd.sameAs || !Array.isArray(jsonLd.sameAs)) {
    return { pass: false, details: "No sameAs array found" };
  }
  
  if (jsonLd.sameAs.length === 0) {
    return { pass: false, details: "sameAs array is empty" };
  }
  
  const socialLinks = jsonLd.sameAs.filter((url: string) => 
    url.includes('facebook') || url.includes('instagram') || url.includes('yelp')
  );
  
  return { 
    pass: true, 
    details: `Found ${jsonLd.sameAs.length} social link(s): ${jsonLd.sameAs.map((u: string) => new URL(u).hostname).join(', ')}` 
  };
}

/**
 * Validates a single bar listing
 */
async function validateBar(bar: { id: number; name: string }): Promise<CheckResult> {
  const url = `${BASE_URL}/kava-bars/${bar.id}`;
  console.log(`\n📍 Checking: ${bar.name}`);
  console.log(`   URL: ${url}`);
  
  const html = await fetchPage(url);
  
  if (!html) {
    return {
      barId: bar.id,
      name: bar.name,
      url,
      checks: {
        schema: { pass: false, details: "Failed to fetch page" },
        uniqueContent: { pass: false, details: "Failed to fetch page" },
        metaTitle: { pass: false, details: "Failed to fetch page" },
        sameAs: { pass: false, details: "Failed to fetch page" }
      },
      passed: false
    };
  }
  
  const jsonLd = extractJsonLd(html);
  
  const checks = {
    schema: checkSchema(jsonLd),
    uniqueContent: checkUniqueContent(html, bar.name),
    metaTitle: checkMetaTitle(html),
    sameAs: checkSameAs(jsonLd)
  };
  
  // Log individual checks
  console.log(`   ${checks.schema.pass ? '✅' : '❌'} SCHEMA: ${checks.schema.details}`);
  console.log(`   ${checks.uniqueContent.pass ? '✅' : '❌'} CONTENT: ${checks.uniqueContent.details}`);
  console.log(`   ${checks.metaTitle.pass ? '✅' : '❌'} TITLE: ${checks.metaTitle.details}`);
  console.log(`   ${checks.sameAs.pass ? '✅' : '❌'} SAMEAS: ${checks.sameAs.details}`);
  
  const passed = checks.schema.pass && checks.uniqueContent.pass && checks.metaTitle.pass;
  
  return { barId: bar.id, name: bar.name, url, checks, passed };
}

async function main() {
  console.log('═'.repeat(80));
  console.log('  AI SEO VALIDATION SCRIPT - MyKavaBar.com');
  console.log('═'.repeat(80));
  console.log(`\nFetching ${SAMPLE_SIZE} random bars from database...\n`);
  
  // Fetch random sample of bars
  const bars = await db
    .select({ id: kavaBars.id, name: kavaBars.name })
    .from(kavaBars)
    .orderBy(sql`RANDOM()`)
    .limit(SAMPLE_SIZE);
  
  console.log(`Found ${bars.length} bars to check against ${BASE_URL}\n`);
  console.log('─'.repeat(80));
  
  const results: CheckResult[] = [];
  
  for (const bar of bars) {
    const result = await validateBar(bar);
    results.push(result);
  }
  
  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log('  SUMMARY');
  console.log('═'.repeat(80));
  
  const passedCount = results.filter(r => r.passed).length;
  const schemaPass = results.filter(r => r.checks.schema.pass).length;
  const contentPass = results.filter(r => r.checks.uniqueContent.pass).length;
  const titlePass = results.filter(r => r.checks.metaTitle.pass).length;
  const sameAsPass = results.filter(r => r.checks.sameAs.pass).length;
  
  console.log(`\n  📊 Individual Checks:`);
  console.log(`     SCHEMA (BarOrPub + geo): ${schemaPass}/${results.length} passed`);
  console.log(`     UNIQUE CONTENT:          ${contentPass}/${results.length} passed`);
  console.log(`     META TITLE:              ${titlePass}/${results.length} passed`);
  console.log(`     SAMEAS (social links):   ${sameAsPass}/${results.length} passed`);
  
  console.log(`\n  ${'─'.repeat(40)}`);
  console.log(`  🤖 AI SEO Check: ${passedCount}/${results.length} Pages Fully Passed`);
  console.log(`  ${'─'.repeat(40)}\n`);
  
  // List failures
  const failures = results.filter(r => !r.passed);
  if (failures.length > 0) {
    console.log('  ⚠️  Pages needing attention:');
    for (const f of failures) {
      console.log(`     - [${f.barId}] ${f.name}`);
    }
  }
  
  console.log('');
  process.exit(passedCount === results.length ? 0 : 1);
}

main().catch(console.error);
