import { db } from '@db';
import { kavaBars } from '@db/schema';
import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

// Path to the backup file - using a more recent backup
const BACKUP_FILE = path.join(rootDir, "backups/kava_bars_post-operation_2025-03-04T02-03-04.144Z.json");

// Palm Beach specific cities/areas
const PALM_BEACH_AREAS = [
  'palm beach', 
  'west palm',
  'royal palm',
  'lake worth',
  'boynton',
  'delray',
  'boca raton',
  'jupiter',
  'wellington',
  'greenacres',
  'north palm',
  'palm beach gardens',
  'riviera beach'
];

async function isInPalmBeach(address: string): boolean {
  if (!address) return false;
  const lowerAddr = address.toLowerCase();
  return PALM_BEACH_AREAS.some(area => lowerAddr.includes(area));
}

async function findMissingPalmBeachBars() {
  console.log("Conducting detailed search for missing Palm Beach County kava bars...");
  
  try {
    // Read from backup file
    console.log(`Reading backup file: ${BACKUP_FILE}`);
    const backupData = JSON.parse(await fs.readFile(BACKUP_FILE, 'utf8'));
    const backupBars = backupData.bars || [];
    
    // Filter backup bars to only Palm Beach
    const palmBeachBackupBars = [];
    for (const bar of backupBars) {
      if (await isInPalmBeach(bar.address)) {
        palmBeachBackupBars.push(bar);
      }
    }
    
    console.log(`Found ${palmBeachBackupBars.length} Palm Beach bars in backup file`);
    
    // Get all bars from DB
    const dbBars = await db.select({
      id: kavaBars.id,
      name: kavaBars.name,
      address: kavaBars.address,
      placeId: kavaBars.placeId
    }).from(kavaBars);
    
    console.log(`Found ${dbBars.length} total bars in database`);
    
    // Filter database bars to only Palm Beach
    const palmBeachDbBars = [];
    for (const bar of dbBars) {
      if (await isInPalmBeach(bar.address)) {
        palmBeachDbBars.push(bar);
      }
    }
    
    console.log(`Found ${palmBeachDbBars.length} Palm Beach bars in database`);
    
    // Create lookup maps for easier comparison
    const dbPlaceIdMap = new Map();
    const dbNameMap = new Map();
    const dbAddressMap = new Map();
    
    for (const bar of palmBeachDbBars) {
      if (bar.placeId) dbPlaceIdMap.set(bar.placeId, bar);
      if (bar.name) dbNameMap.set(bar.name.toLowerCase(), bar);
      if (bar.address) dbAddressMap.set(bar.address.toLowerCase(), bar);
    }
    
    // Find missing bars (by placeId, name, and address)
    const missingBars = [];
    
    for (const backupBar of palmBeachBackupBars) {
      // Check by PlaceId (most reliable)
      if (backupBar.placeId && !dbPlaceIdMap.has(backupBar.placeId)) {
        // Also check by name as a fallback
        if (!dbNameMap.has(backupBar.name.toLowerCase())) {
          // Also check by address as a last resort
          if (!dbAddressMap.has(backupBar.address.toLowerCase())) {
            missingBars.push({
              ...backupBar,
              missingReason: 'Not found by placeId, name, or address'
            });
            continue;
          }
        }
      }
      
      // Only check by name if no placeId exists
      if (!backupBar.placeId && backupBar.name && !dbNameMap.has(backupBar.name.toLowerCase())) {
        // Also check by address as fallback
        if (!dbAddressMap.has(backupBar.address.toLowerCase())) {
          missingBars.push({
            ...backupBar,
            missingReason: 'Missing by name and address (no placeId)'
          });
          continue;
        }
      }
    }
    
    console.log(`Found ${missingBars.length} missing Palm Beach bars`);
    
    if (missingBars.length > 0) {
      console.log("Missing bars details:");
      missingBars.forEach((bar, index) => {
        console.log(`\n[${index + 1}] ${bar.name}`);
        console.log(`Address: ${bar.address}`);
        console.log(`Place ID: ${bar.placeId || 'N/A'}`);
        console.log(`Verification: ${bar.verificationStatus || 'Unknown'}`);
        console.log(`Reason: ${bar.missingReason}`);
      });
    } else {
      console.log("No missing Palm Beach bars found in the analysis.");
    }
    
    // Double check with a different approach
    console.log("\nPerforming secondary verification...");
    let secondaryMissingCount = 0;
    
    for (const backupBar of palmBeachBackupBars) {
      let found = false;
      
      for (const dbBar of palmBeachDbBars) {
        // Check by place ID if available
        if (backupBar.placeId && dbBar.placeId && backupBar.placeId === dbBar.placeId) {
          found = true;
          break;
        }
        
        // Check by name and address if place ID not available
        if (
          backupBar.name && 
          dbBar.name && 
          backupBar.name.toLowerCase() === dbBar.name.toLowerCase() &&
          backupBar.address &&
          dbBar.address && 
          backupBar.address.toLowerCase() === dbBar.address.toLowerCase()
        ) {
          found = true;
          break;
        }
      }
      
      if (!found) {
        secondaryMissingCount++;
        console.log(`Secondary verification found missing bar: ${backupBar.name} - ${backupBar.address}`);
      }
    }
    
    console.log(`Secondary verification found ${secondaryMissingCount} missing Palm Beach bars`);
    
    // List all Palm Beach bars alphabetically for reference
    console.log("\nDatabase Palm Beach bars (alphabetical):");
    palmBeachDbBars
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((bar, i) => console.log(`${i+1}. ${bar.name} - ${bar.address}`));
    
    console.log("\nBackup Palm Beach bars (alphabetical):");
    palmBeachBackupBars
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((bar, i) => console.log(`${i+1}. ${bar.name} - ${bar.address}`));
    
    return {
      totalBackupBars: backupBars.length,
      palmBeachBackupBars: palmBeachBackupBars.length,
      totalDbBars: dbBars.length,
      palmBeachDbBars: palmBeachDbBars.length,
      missingBars
    };
  } catch (error) {
    console.error("Error finding missing Palm Beach bars:", error);
    throw error;
  }
}

// Run the analysis
findMissingPalmBeachBars()
  .then(result => {
    console.log("\nAnalysis complete!");
    console.log(`Found ${result.missingBars.length} missing Palm Beach bars`);
    process.exit(0);
  })
  .catch(error => {
    console.error("Analysis failed:", error);
    process.exit(1);
  });