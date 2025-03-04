import { db } from '@db';
import { kavaBars } from '@db/schema';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

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

/**
 * Check if an address is in Palm Beach County
 */
async function isInPalmBeach(address: string): Promise<boolean> {
  if (!address) return false;
  const lowerAddr = address.toLowerCase();
  return PALM_BEACH_AREAS.some(area => lowerAddr.includes(area));
}

/**
 * Restore missing Palm Beach bars from the latest backups
 */
async function restorePalmBeachBars() {
  try {
    console.log("Checking for missing Palm Beach bars from all backups...");
    
    // Get list of all backup files, sorted by date (newest first)
    const backupDir = path.join(rootDir, 'backups');
    const files = await fs.readdir(backupDir);
    const backupFiles = files
      .filter(file => file.endsWith('.json') && file.includes('kava_bars_'))
      .sort()
      .reverse(); // Newest first
    
    console.log(`Found ${backupFiles.length} backup files`);
    
    // Get all Palm Beach bars from the database
    const dbBars = await db.select({
      id: kavaBars.id,
      name: kavaBars.name,
      address: kavaBars.address,
      placeId: kavaBars.placeId
    }).from(kavaBars);
    
    const palmBeachDbBars = [];
    for (const bar of dbBars) {
      if (await isInPalmBeach(bar.address)) {
        palmBeachDbBars.push(bar);
      }
    }
    
    console.log(`Found ${palmBeachDbBars.length} Palm Beach bars in database`);
    
    // Create maps for quick lookup
    const dbPlaceIdMap = new Map();
    const dbNameAddressMap = new Map();
    
    for (const bar of palmBeachDbBars) {
      if (bar.placeId) dbPlaceIdMap.set(bar.placeId, bar);
      
      if (bar.name && bar.address) {
        const nameAddressKey = `${bar.name.toLowerCase()}-${bar.address.toLowerCase()}`;
        dbNameAddressMap.set(nameAddressKey, bar);
      }
    }
    
    // Process each backup file to find any missing bars
    let missingBarsByBackup = new Map();
    let totalMissingBars = 0;
    
    for (const backupFile of backupFiles.slice(0, 10)) { // Process the 10 newest backups
      const backupPath = path.join(backupDir, backupFile);
      try {
        const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
        const backupBars = backupData.bars || [];
        
        // Find Palm Beach bars in backup
        const palmBeachBackupBars = [];
        for (const bar of backupBars) {
          if (await isInPalmBeach(bar.address)) {
            palmBeachBackupBars.push(bar);
          }
        }
        
        // Find bars in backup but not in database
        const missingBars = [];
        
        for (const backupBar of palmBeachBackupBars) {
          let isInDb = false;
          
          // Check by placeId first (most reliable)
          if (backupBar.placeId && dbPlaceIdMap.has(backupBar.placeId)) {
            isInDb = true;
          } else {
            // Check by name+address
            const nameAddressKey = `${backupBar.name.toLowerCase()}-${backupBar.address.toLowerCase()}`;
            if (dbNameAddressMap.has(nameAddressKey)) {
              isInDb = true;
            }
          }
          
          if (!isInDb) {
            missingBars.push(backupBar);
          }
        }
        
        if (missingBars.length > 0) {
          console.log(`\nFound ${missingBars.length} missing Palm Beach bars in backup: ${backupFile}`);
          missingBarsByBackup.set(backupFile, missingBars);
          totalMissingBars += missingBars.length;
        }
      } catch (error) {
        console.error(`Error processing backup file ${backupFile}:`, error);
      }
    }
    
    if (totalMissingBars === 0) {
      console.log("\nAll Palm Beach bars are already in the database. No restoration needed.");
      return { restored: 0, failed: 0 };
    }
    
    // Combine all unique missing bars from all backups
    console.log("\nConsolidating missing bars from all backups...");
    const allMissingBars = new Map(); // Use Map to ensure uniqueness by placeId
    
    for (const [backupFile, missingBars] of missingBarsByBackup.entries()) {
      for (const bar of missingBars) {
        // Use placeId as key if available, otherwise use name+address
        const key = bar.placeId || `${bar.name.toLowerCase()}-${bar.address.toLowerCase()}`;
        
        if (!allMissingBars.has(key)) {
          allMissingBars.set(key, { 
            ...bar, 
            sourcedFrom: backupFile 
          });
        }
      }
    }
    
    const uniqueMissingBars = Array.from(allMissingBars.values());
    console.log(`\nFound ${uniqueMissingBars.length} unique missing Palm Beach bars across all backups`);
    
    if (uniqueMissingBars.length === 0) {
      return { restored: 0, failed: 0 };
    }
    
    // Display all missing bars
    uniqueMissingBars.forEach((bar, index) => {
      console.log(`\n[${index + 1}] ${bar.name}`);
      console.log(`Address: ${bar.address}`);
      console.log(`Place ID: ${bar.placeId || 'N/A'}`);
      console.log(`Verification Status: ${bar.verificationStatus || 'pending'}`);
      console.log(`Sourced From: ${bar.sourcedFrom}`);
    });
    
    // Ask for confirmation to restore
    console.log("\nWould you like to restore these bars? (Type 'yes' to confirm)");
    
    // Function to restore bars to the database
    async function restoreMissingBars() {
      console.log("Restoring missing Palm Beach bars...");
      
      let restored = 0;
      let failed = 0;
      
      for (const bar of uniqueMissingBars) {
        try {
          // Prepare bar data for insertion
          const barData = {
            name: bar.name,
            address: bar.address,
            placeId: bar.placeId,
            phone: bar.phone || null,
            website: bar.website || null,
            businessStatus: bar.businessStatus || "OPERATIONAL",
            googlePlaceId: bar.googlePlaceId || bar.placeId || null,
            rating: bar.rating || 0,
            verificationStatus: bar.verificationStatus || "pending",
            location: bar.location ? JSON.stringify(bar.location) : null,
            hours: bar.hours ? JSON.stringify(bar.hours) : null,
            dataCompletenessScore: bar.dataCompletenessScore || 0,
            isVerifiedKavaBar: bar.isVerifiedKavaBar || false,
            verificationNotes: bar.verificationNotes || null,
            lastVerified: bar.lastVerified ? new Date(bar.lastVerified) : null,
            ownerId: bar.ownerId || null,
            isSponsored: false,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          
          // Insert into database
          const result = await db.insert(kavaBars).values(barData);
          console.log(`Restored: ${bar.name} (${bar.address})`);
          restored++;
        } catch (error) {
          console.error(`Failed to restore ${bar.name}:`, error);
          failed++;
        }
      }
      
      console.log(`\nRestoration complete: ${restored} bars restored, ${failed} failed`);
      return { restored, failed };
    }
    
    return { uniqueMissingBars, restoreMissingBars };
  } catch (error) {
    console.error("Error in Palm Beach bar restoration:", error);
    throw error;
  }
}

/**
 * Execute the restoration with automatic confirmation
 */
export async function restorePalmBeachBarsWithConfirmation() {
  const result = await restorePalmBeachBars();
  
  if (result.uniqueMissingBars && result.uniqueMissingBars.length > 0) {
    console.log("Auto-confirming restoration of missing Palm Beach bars...");
    return await result.restoreMissingBars();
  }
  
  return result;
}

// Run the script only if executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  restorePalmBeachBars()
    .then(result => {
      if (result.uniqueMissingBars && result.uniqueMissingBars.length > 0) {
        console.log("Please run the restoration function with confirmation to restore the bars.");
        process.exit(0);
      } else {
        console.log("No missing bars to restore or restoration skipped");
        process.exit(0);
      }
    })
    .catch(error => {
      console.error("Script failed:", error);
      process.exit(1);
    });
}