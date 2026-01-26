/**
 * AI SEO Validation Script for MyKavaBar.com
 * 
 * Validates that server-side SEO injection is working by:
 * - Fetching raw HTML from live server (no JS execution)
 * - Checking for title, JSON-LD schema, and meta description in raw response
 * 
 * Usage: npx tsx scripts/check-ai-seo.ts
 */

import { db } from "../db";
import { kavaBars } from "../db/schema";
import { sql } from "drizzle-orm";
import * as cheerio from "cheerio";

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";
const SAMPLE_SIZE = 5;

interface BarInfo {
  id: number;
  name: string;
  address: string;
}

interface ValidationResult {
  barId: number;
  barName: string;
  url: string;
  checks: {
    titleContainsBarName: { pass: boolean; details: string };
    titleContainsCity: { pass: boolean; details: string };
    jsonLdPresent: { pass: boolean; details: string };
    metaDescriptionUnique: { pass: boolean; details: string };
  };
  allPassed: boolean;
}

/**
 * Fetches raw HTML from URL (mimics AI crawler behavior)
 */
async function fetchRawHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html'
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
 * Extracts city from address string
 */
function extractCity(address: string): string {
  const parts = address.split(',').map(s => s.trim());
  return parts[1] || '';
}

/**
 * Validates a single bar listing page
 */
async function validateBarPage(bar: BarInfo): Promise<ValidationResult> {
  const url = `${BASE_URL}/kava-bars/${bar.id}`;
  const city = extractCity(bar.address);
  
  console.log(`\n🔍 Checking: ${bar.name}`);
  console.log(`   URL: ${url}`);
  console.log(`   Expected city: "${city}"`);
  
  const html = await fetchRawHtml(url);
  
  if (!html) {
    return {
      barId: bar.id,
      barName: bar.name,
      url,
      checks: {
        titleContainsBarName: { pass: false, details: "Failed to fetch page" },
        titleContainsCity: { pass: false, details: "Failed to fetch page" },
        jsonLdPresent: { pass: false, details: "Failed to fetch page" },
        metaDescriptionUnique: { pass: false, details: "Failed to fetch page" }
      },
      allPassed: false
    };
  }
  
  const $ = cheerio.load(html);
  
  // Check 1: Title contains bar name
  const title = $('title').text();
  const titleContainsBarName = title.includes(bar.name);
  
  // Check 2: Title contains city
  const titleContainsCity = city ? title.includes(city) : true;
  
  // Check 3: JSON-LD is present in raw HTML
  let jsonLdPresent = false;
  let jsonLdDetails = "No JSON-LD found";
  const jsonLdScripts = $('script[type="application/ld+json"]');
  
  jsonLdScripts.each((_, script) => {
    const content = $(script).html();
    if (content) {
      try {
        const data = JSON.parse(content);
        if (data['@type'] === 'BarOrPub' && data.name === bar.name) {
          jsonLdPresent = true;
          jsonLdDetails = `Found BarOrPub schema with geo: ${data.geo ? 'yes' : 'no'}`;
        }
      } catch (e) {
        // Invalid JSON, skip
      }
    }
  });
  
  // Check 4: Meta description is unique (not default, contains bar name)
  const metaDescription = $('meta[name="description"]').attr('content') || '';
  const isDefaultDescription = metaDescription.includes('Discover kava bars near you') || 
                               metaDescription.includes('Your Nationwide Kava Bar Directory');
  const metaDescriptionUnique = !isDefaultDescription && 
                                 metaDescription.length > 100 && 
                                 metaDescription.includes(bar.name);
  
  // Log results
  console.log(`   ${titleContainsBarName ? '✅' : '❌'} TITLE HAS BAR NAME: "${title.substring(0, 50)}..."`);
  console.log(`   ${titleContainsCity ? '✅' : '❌'} TITLE HAS CITY: ${city ? `looking for "${city}"` : 'N/A'}`);
  console.log(`   ${jsonLdPresent ? '✅' : '❌'} JSON-LD IN RAW HTML: ${jsonLdDetails}`);
  console.log(`   ${metaDescriptionUnique ? '✅' : '❌'} UNIQUE META DESC: ${metaDescription.substring(0, 60)}...`);
  
  const allPassed = titleContainsBarName && titleContainsCity && jsonLdPresent && metaDescriptionUnique;
  
  return {
    barId: bar.id,
    barName: bar.name,
    url,
    checks: {
      titleContainsBarName: { 
        pass: titleContainsBarName, 
        details: title.substring(0, 60) 
      },
      titleContainsCity: { 
        pass: titleContainsCity, 
        details: city || 'No city found' 
      },
      jsonLdPresent: { 
        pass: jsonLdPresent, 
        details: jsonLdDetails 
      },
      metaDescriptionUnique: { 
        pass: metaDescriptionUnique, 
        details: metaDescription.substring(0, 100) 
      }
    },
    allPassed
  };
}

async function main() {
  console.log('═'.repeat(80));
  console.log('  AI SEO VALIDATION - Server-Side Injection Check');
  console.log('  Verifying raw HTML contains SEO data (no JavaScript execution)');
  console.log('═'.repeat(80));
  console.log(`\nTarget: ${BASE_URL}`);
  console.log(`Sample size: ${SAMPLE_SIZE} random listings\n`);
  
  // Fetch random sample of bars with addresses
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
  
  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log('  SUMMARY - RAW HTML SEO VALIDATION');
  console.log('═'.repeat(80));
  
  const titleNamePass = results.filter(r => r.checks.titleContainsBarName.pass).length;
  const titleCityPass = results.filter(r => r.checks.titleContainsCity.pass).length;
  const jsonLdPass = results.filter(r => r.checks.jsonLdPresent.pass).length;
  const metaDescPass = results.filter(r => r.checks.metaDescriptionUnique.pass).length;
  const allPassedCount = results.filter(r => r.allPassed).length;
  
  console.log(`\n  📊 Individual Checks (in raw HTML, no JS):`);
  console.log(`     Title contains bar name:  ${titleNamePass}/${results.length}`);
  console.log(`     Title contains city:      ${titleCityPass}/${results.length}`);
  console.log(`     JSON-LD schema present:   ${jsonLdPass}/${results.length}`);
  console.log(`     Unique meta description:  ${metaDescPass}/${results.length}`);
  
  console.log(`\n  ${'─'.repeat(50)}`);
  
  if (allPassedCount === results.length) {
    console.log(`  ✅ SUCCESS: ${allPassedCount}/${results.length} Pages Fully Passed`);
    console.log(`  AI crawlers will see complete SEO data in raw HTML!`);
  } else {
    console.log(`  ⚠️  PARTIAL: ${allPassedCount}/${results.length} Pages Fully Passed`);
    console.log(`\n  Pages needing attention:`);
    for (const r of results.filter(r => !r.allPassed)) {
      console.log(`     - [${r.barId}] ${r.barName}`);
    }
  }
  
  console.log(`  ${'─'.repeat(50)}\n`);
  
  process.exit(allPassedCount === results.length ? 0 : 1);
}

main().catch(console.error);
