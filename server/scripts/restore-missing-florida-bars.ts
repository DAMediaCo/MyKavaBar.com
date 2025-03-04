/**
 * Script to restore missing Florida bars from backup
 * This script will only insert bars that exist in backup but not in current database
 * It will NOT modify any existing data
 */

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "../../db";
import { kavaBars } from "../../db/schema";
import { eq } from "drizzle-orm";
import { backupDatabase } from "../utils/backup-database";

// Get directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

// Path to the backup file - using a more recent backup from March 4th
const BACKUP_FILE = path.join(rootDir, "backups/kava_bars_post-operation_2025-03-04T02-03-04.144Z.json");
console.log("Full backup file path:", path.resolve(BACKUP_FILE));

async function restoreMissingFloridaBars() {
  console.log("Starting restoration of missing Florida bars...");
  console.log("Current working directory:", process.cwd());
  console.log("Database connection status:", db ? "Connected" : "Not connected");
  
  try {
    // First create a backup of the current state
    console.log("Creating backup of current database state...");
    await backupDatabase("pre-operation");
    console.log("Backup completed successfully");
    
    // Read backup file
    const backupData = JSON.parse(await fs.readFile(BACKUP_FILE, "utf8"));
    const backupBars = backupData.bars;
    
    console.log(`Loaded ${backupBars.length} bars from backup`);
    
    // Filter for Florida bars only, with special focus on Broward and Palm Beach counties
    const floridaBars = backupBars.filter((bar: any) => {
      if (!bar.address) return false;
      
      // Check for Florida addresses
      const isFloridaBar = bar.address.includes(", FL") || bar.address.includes(", Florida");
      
      // Special focus on Broward and Palm Beach counties
      const isBrowardBar = bar.address.toLowerCase().includes("broward") || 
                           bar.address.toLowerCase().includes("fort lauderdale") ||
                           bar.address.toLowerCase().includes("hollywood, fl") ||
                           bar.address.toLowerCase().includes("pompano") ||
                           bar.address.toLowerCase().includes("deerfield") ||
                           bar.address.toLowerCase().includes("coral springs") ||
                           bar.address.toLowerCase().includes("plantation, fl") ||
                           bar.address.toLowerCase().includes("davie, fl") ||
                           bar.address.toLowerCase().includes("sunrise, fl") ||
                           bar.address.toLowerCase().includes("tamarac, fl") ||
                           bar.address.toLowerCase().includes("margate, fl");
                           
      const isPalmBeachBar = bar.address.toLowerCase().includes("palm beach") ||
                            bar.address.toLowerCase().includes("boca raton") ||
                            bar.address.toLowerCase().includes("delray") ||
                            bar.address.toLowerCase().includes("boynton") ||
                            bar.address.toLowerCase().includes("lake worth") ||
                            bar.address.toLowerCase().includes("west palm");
      
      return isFloridaBar || isBrowardBar || isPalmBeachBar;
    });
    
    console.log(`Found ${floridaBars.length} Florida bars in backup`);
    
    // Get all existing place IDs from database
    const existingBars = await db.select({ 
      id: kavaBars.id, 
      placeId: kavaBars.placeId,
      name: kavaBars.name,
      address: kavaBars.address
    }).from(kavaBars);
    
    const existingPlaceIds = new Set(
      existingBars
        .filter(bar => bar.placeId !== null)
        .map(bar => bar.placeId)
    );
    
    console.log(`Found ${existingBars.length} total bars in current database`);
    console.log(`Found ${existingPlaceIds.size} bars with place IDs in current database`);
    
    // Find missing bars - in backup but not in current database
    const missingByPlaceId = floridaBars.filter((bar: any) => {
      return bar.placeId && !existingPlaceIds.has(bar.placeId);
    });
    
    console.log(`Found ${missingByPlaceId.length} Florida bars missing by placeId`);
    
    // Create a set of existing bar names for name-based comparison
    const existingNames = new Set(
      existingBars
        .filter(bar => bar.name !== null)
        .map(bar => bar.name.toLowerCase())
    );
    
    // Find bars missing by name (may have different place IDs)
    const missingByName = floridaBars.filter((bar: any) => {
      return bar.name && !existingNames.has(bar.name.toLowerCase());
    });
    
    console.log(`Found ${missingByName.length} Florida bars missing by name`);
    
    // Check for potential duplicate entries (same name, different place IDs)
    const browardPalmBeachBars = floridaBars.filter((bar: any) => {
      if (!bar.address) return false;
      
      const addr = bar.address.toLowerCase();
      return addr.includes("broward") || 
             addr.includes("fort lauderdale") || 
             addr.includes("hollywood, fl") ||
             addr.includes("pompano") ||
             addr.includes("palm beach") ||
             addr.includes("boca raton") ||
             addr.includes("delray") || 
             addr.includes("boynton");
    });
    
    console.log(`Found ${browardPalmBeachBars.length} bars specifically in Broward and Palm Beach counties`);
    
    // Create fuzzy matching for name and address to find truly missing bars
    // First, normalize addresses by removing FL, Florida, etc.
    const normalizeAddress = (address: string) => {
      if (!address) return '';
      return address.toLowerCase()
        .replace(/, fl\b/g, '')
        .replace(/, florida\b/g, '')
        .replace(/,\s+usa\b/g, '')
        .replace(/\bsuite\s+[a-z0-9]+/g, '')
        .replace(/\bste\s+[a-z0-9]+/g, '')
        .replace(/\bunit\s+[a-z0-9]+/g, '')
        .replace(/\b(fort|ft)\.?\s+lauderdale\b/g, 'fort lauderdale')
        .replace(/\bw(\.|est)?\s+palm\s+beach\b/g, 'west palm beach')
        .trim();
    };
    
    // Create a map of normalized addresses from existing database
    const existingAddressMap = new Map();
    existingBars.forEach(bar => {
      if (bar.address) {
        const normalizedAddress = normalizeAddress(bar.address);
        existingAddressMap.set(normalizedAddress, bar);
      }
    });
    
    // Filter for truly missing bars that don't match by place ID, name, or address
    const trulyMissingBars = missingByPlaceId.filter((bar: any) => {
      if (!bar.address) return true; // Keep bars without addresses
      
      const normalizedAddress = normalizeAddress(bar.address);
      return !existingAddressMap.has(normalizedAddress);
    });
    
    console.log(`Found ${trulyMissingBars.length} Florida bars that are truly missing (no address match)`);
    
    // For now, use the truly missing bars
    const missingBars = trulyMissingBars;
    
    console.log(`Found ${missingBars.length} Florida bars missing from current database`);
    
    // Log the missing bars for review
    console.log("Missing Florida bars:");
    missingBars.forEach((bar: any, index: number) => {
      console.log(`${index + 1}. ${bar.name} - ${bar.address} (${bar.placeId})`);
    });
    
    return missingBars;
  } catch (error) {
    console.error("Error analyzing missing Florida bars:", error);
    throw error;
  }
}

// This function performs the actual restoration
async function confirmRestoreMissingFloridaBars(missingBars: any[]) {
  console.log(`Starting restoration of ${missingBars.length} missing Florida bars...`);
  
  const now = new Date();
  let restoredCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  
  for (const bar of missingBars) {
    try {
      // Double-check that bar doesn't exist in database
      const existing = await db.select({ id: kavaBars.id })
        .from(kavaBars)
        .where(eq(kavaBars.placeId, bar.placeId))
        .limit(1);
      
      if (existing.length > 0) {
        console.log(`Skipping bar ${bar.name} - already exists with ID ${existing[0].id}`);
        skippedCount++;
        continue;
      }
      
      // Prepare location data
      let location = null;
      if (bar.location) {
        if (typeof bar.location === 'string') {
          try {
            location = bar.location;
          } catch (e) {
            console.warn(`Could not parse location for ${bar.name}: ${e}`);
          }
        } else if (typeof bar.location === 'object') {
          location = JSON.stringify(bar.location);
        }
      }
      
      // Insert the missing bar
      await db.insert(kavaBars).values({
        name: bar.name || "",
        address: bar.address || "",
        placeId: bar.placeId,
        location: location,
        rating: bar.rating || 0,
        businessStatus: bar.businessStatus || "OPERATIONAL",
        verificationStatus: bar.verificationStatus || "pending",
        dataCompletenessScore: bar.dataCompletenessScore || 0,
        isVerifiedKavaBar: bar.isVerifiedKavaBar || false,
        verificationNotes: bar.verificationNotes || "Restored from backup",
        createdAt: new Date(bar.createdAt) || now,
        lastVerified: bar.lastVerified ? new Date(bar.lastVerified) : null,
        updatedAt: now,
        phone: bar.phone || null,
        website: bar.website || null,
        hours: bar.hours || null,
        googlePlaceId: bar.googlePlaceId || null,
        ownerId: null // Do not restore owner relationships
      });
      
      console.log(`Restored bar: ${bar.name}`);
      restoredCount++;
    } catch (error) {
      console.error(`Error restoring bar ${bar.name}:`, error);
      errorCount++;
    }
  }
  
  // Create a backup after restoration
  await backupDatabase("post-operation");
  
  console.log("\nRestoration summary:");
  console.log(`Restored: ${restoredCount}`);
  console.log(`Skipped: ${skippedCount}`);
  console.log(`Errors: ${errorCount}`);
  
  return {
    restored: restoredCount,
    skipped: skippedCount,
    errors: errorCount
  };
}

// Combined function for analysis and restoration with confirmation
export async function restoreFloridaBars(autoConfirm = false) {
  const missingBars = await restoreMissingFloridaBars();
  
  if (missingBars.length === 0) {
    console.log("No missing bars found. Nothing to restore.");
    return { restored: 0, skipped: 0, errors: 0 };
  }
  
  if (autoConfirm) {
    console.log("Auto-confirming restoration of missing bars...");
    return await confirmRestoreMissingFloridaBars(missingBars);
  } else {
    console.log("\nFound missing bars. To restore them, call confirmRestoreMissingFloridaBars() function.");
    return { analyzed: missingBars.length };
  }
}

// Export for use in routes or other modules
export { restoreMissingFloridaBars, confirmRestoreMissingFloridaBars };

// Direct execution
if (import.meta.url === process.argv[1]) {
  console.log("Starting Florida bars restoration script");
  const autoConfirm = process.argv.includes("--confirm");
  console.log("Auto confirm mode:", autoConfirm);
  console.log("Using backup file:", BACKUP_FILE);
  
  restoreFloridaBars(autoConfirm)
    .then(result => {
      console.log("Operation completed:", result);
      process.exit(0);
    })
    .catch(error => {
      console.error("Operation failed:", error);
      process.exit(1);
    });
}