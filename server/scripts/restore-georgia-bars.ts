import { db } from "@db";
import { kavaBars } from "@db/schema";
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql } from 'drizzle-orm';

const STATE = 'Georgia';
const progressFilePath = path.join(process.cwd(), `${STATE.toLowerCase()}_restore_progress.json`);

async function restoreGeorgiaData() {
  console.log(`Starting restore for ${STATE} bars...`);

  try {
    // Read backup file from the correct location (root/backups)
    const backupFilePath = path.resolve(process.cwd(), 'backups', 'kava_bars_manual_2025-01-27T17-54-08-888Z.json');
    const backupData = JSON.parse(
      await fs.readFile(backupFilePath, 'utf-8')
    );

    const georgiaBars = backupData.bars.filter((bar: any) => 
      bar.address?.includes(', GA') || 
      bar.address?.includes(', Georgia')
    );

    console.log(`Found ${georgiaBars.length} bars in Georgia`);

    // Insert bars one by one to avoid conflicts
    let restoredCount = 0;
    for (const bar of georgiaBars) {
      try {
        // Convert timestamp strings to Date objects and ensure location is properly formatted
        const processedBar = {
          ...bar,
          id: undefined, // Let the database assign new IDs
          createdAt: bar.createdAt ? new Date(bar.createdAt) : new Date(),
          updatedAt: bar.updatedAt ? new Date(bar.updatedAt) : new Date(),
          lastVerified: bar.lastVerified ? new Date(bar.lastVerified) : null,
          verificationExpires: bar.verificationExpires ? new Date(bar.verificationExpires) : null,
          location: typeof bar.location === 'string' ? bar.location : JSON.stringify(bar.location)
        };

        // Check if bar already exists
        const existing = await db
          .select()
          .from(kavaBars)
          .where(sql`place_id = ${bar.placeId}`)
          .limit(1);

        if (existing.length === 0) {
          await db.insert(kavaBars).values(processedBar);
          console.log(`Restored: ${bar.name}`);
          restoredCount++;
        } else {
          console.log(`Skipped duplicate: ${bar.name}`);
        }
      } catch (err) {
        console.error(`Error restoring ${bar.name}:`, err);
      }
    }

    // Save progress
    await fs.writeFile(
      progressFilePath,
      JSON.stringify({ 
        completed: true, 
        restoredCount,
        totalFound: georgiaBars.length,
        lastUpdate: new Date().toISOString()
      })
    );

    console.log(`Successfully restored ${restoredCount} out of ${georgiaBars.length} bars in Georgia`);
  } catch (error: any) {
    console.error('Error during restore:', error);
    throw error;
  }
}

// Only run if this file is being executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  restoreGeorgiaData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Failed to restore Georgia bars:', error);
      process.exit(1);
    });
}