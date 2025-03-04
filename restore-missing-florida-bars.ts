/**
 * Script to restore missing Florida bars from backup
 * This script will only insert bars that exist in backup but not in current database
 * It will NOT modify any existing data
 */

import fs from "fs/promises";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { eq } from "drizzle-orm";

const BACKUP_FILE = "backups/kava_bars_post-operation_2025-01-27T01-43-40-300Z.json";

async function restoreMissingFloridaBars() {
  console.log("Starting restoration of missing Florida bars...");
  
  try {
    // Read backup file
    const backupData = JSON.parse(await fs.readFile(BACKUP_FILE, "utf8"));
    const backupBars = backupData.bars;
    
    console.log(`Loaded ${backupBars.length} bars from backup`);
    
    // Filter for Florida bars only
    const floridaBars = backupBars.filter((bar: any) => {
      return bar.address && bar.address.includes(", FL");
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
    const missingBars = floridaBars.filter((bar: any) => {
      return bar.placeId && !existingPlaceIds.has(bar.placeId);
    });
    
    console.log(`Found ${missingBars.length} Florida bars missing from current database`);
    
    // Log the missing bars for review
    console.log("Missing Florida bars:");
    missingBars.forEach((bar: any, index: number) => {
      console.log(`${index + 1}. ${bar.name} - ${bar.address} (${bar.placeId})`);
    });
    
    // Only proceed with restoration after confirmation
    console.log("\nReady to restore these missing bars.");
    console.log("To restore them, call the restoreMissingFloridaBarsConfirmed() function");
    
    return missingBars;
  } catch (error) {
    console.error("Error restoring missing Florida bars:", error);
    throw error;
  }
}

// This function needs to be called separately after review for safety
async function restoreMissingFloridaBarsConfirmed(missingBars: any[]) {
  console.log(`Starting confirmed restoration of ${missingBars.length} missing Florida bars...`);
  
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

// Export functions for use in other modules
export { restoreMissingFloridaBars, restoreMissingFloridaBarsConfirmed };

// Allow running from command line
if (process.argv[1] === import.meta.url) {
  restoreMissingFloridaBars()
    .then(missingBars => {
      if (process.argv.includes("--confirm")) {
        return restoreMissingFloridaBarsConfirmed(missingBars);
      }
      return { reviewed: missingBars.length };
    })
    .then(result => {
      console.log("Operation completed:", result);
      process.exit(0);
    })
    .catch(error => {
      console.error("Operation failed:", error);
      process.exit(1);
    });
}