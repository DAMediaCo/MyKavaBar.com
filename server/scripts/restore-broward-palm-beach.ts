import { db } from '@db';
import { kavaBars } from '@db/schema';
import { eq } from 'drizzle-orm';
import { backupDatabase } from '../utils/backup-database';
import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

// Path to the backup file - using a more recent backup
const BACKUP_FILE = path.join(rootDir, "backups/kava_bars_post-operation_2025-03-04T02-03-04.144Z.json");

// Missing bars to restore (from our analysis)
const MISSING_PLACE_IDS = [
  'ChIJK7aepRsG2YgRCXHB63USFeA', // Vapor Buy + CBD + Smoke + Kratom + Kava
  'ChIJxwlPNV8H2YgRbGNSQVZDfJ0'  // Davie Kava
];

async function restoreBrowardPalmBeach() {
  console.log("Restoring missing Broward and Palm Beach kava bars...");
  console.log("Missing Place IDs:", MISSING_PLACE_IDS);
  
  try {
    // First create a backup
    console.log("Creating backup of current database state...");
    await backupDatabase("pre-operation");
    console.log("Backup created successfully");
    
    // Read from backup file
    console.log(`Reading backup file: ${BACKUP_FILE}`);
    const backupData = JSON.parse(await fs.readFile(BACKUP_FILE, 'utf8'));
    const backupBars = backupData.bars || [];
    
    console.log(`Found ${backupBars.length} total bars in backup`);
    
    // Find the bars to restore
    const barsToRestore = backupBars.filter((bar: any) => 
      MISSING_PLACE_IDS.includes(bar.placeId)
    );
    
    console.log(`Found ${barsToRestore.length} bars to restore:`);
    barsToRestore.forEach((bar: any, index: number) => {
      console.log(`${index + 1}. ${bar.name} - ${bar.address} (Place ID: ${bar.placeId})`);
    });
    
    // Check if they're really missing
    for (const bar of barsToRestore) {
      const existing = await db.select({ id: kavaBars.id, name: kavaBars.name })
        .from(kavaBars)
        .where(eq(kavaBars.placeId, bar.placeId));
      
      if (existing.length > 0) {
        console.log(`Bar already exists: ${bar.name} (ID: ${existing[0].id})`);
        continue;
      }
      
      console.log(`Restoring bar: ${bar.name}`);
      
      // Prepare location
      let location = null;
      if (bar.location) {
        location = typeof bar.location === 'string' 
          ? bar.location 
          : JSON.stringify(bar.location);
      }
      
      // Convert rating to number if it's a string
      const ratingValue = typeof bar.rating === 'string' ? parseFloat(bar.rating) : (bar.rating || 0);
      
      // Handle dataCompletenessScore which could be a string
      const completenessScore = typeof bar.dataCompletenessScore === 'string' 
        ? parseFloat(bar.dataCompletenessScore) 
        : (bar.dataCompletenessScore || 0);
      
      // Insert the bar - using a type that matches the schema
      const insertValues = {
        name: bar.name || "",
        address: bar.address || "",
        placeId: bar.placeId,
        location: location,
        rating: ratingValue,
        businessStatus: bar.businessStatus || "OPERATIONAL",
        verificationStatus: bar.verificationStatus || "pending",
        dataCompletenessScore: completenessScore,
        isVerifiedKavaBar: bar.isVerifiedKavaBar || false,
        verificationNotes: bar.verificationNotes || "Restored from March 4 backup",
        createdAt: new Date(bar.createdAt || new Date()),
        lastVerified: bar.lastVerified ? new Date(bar.lastVerified) : null,
        updatedAt: new Date(),
        phone: bar.phone || null,
        website: bar.website || null,
        hours: bar.hours || null,
        googlePlaceId: bar.googlePlaceId || null,
        ownerId: null // Do not restore owner relationships
      };
      
      const result = await db.insert(kavaBars).values(insertValues);
      
      console.log(`Successfully restored bar: ${bar.name}`);
    }
    
    // Create backup after restoration
    console.log("Creating backup after restoration...");
    await backupDatabase("post-operation");
    console.log("Post-restoration backup created successfully");
    
    return {
      success: true,
      restored: barsToRestore.length,
      barsRestored: barsToRestore.map((bar: any) => ({
        name: bar.name,
        address: bar.address,
        placeId: bar.placeId
      }))
    };
  } catch (error: any) {
    console.error("Error restoring Broward/Palm Beach bars:", error);
    return {
      success: false,
      error: error?.message || String(error)
    };
  }
}

// Run the restoration
restoreBrowardPalmBeach()
  .then(result => {
    console.log("Restoration completed:", result);
    process.exit(0);
  })
  .catch(error => {
    console.error("Restoration failed:", error);
    process.exit(1);
  });