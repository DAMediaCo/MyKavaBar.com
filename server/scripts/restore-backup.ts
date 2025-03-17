
import { db } from "../../db";
import { kavaBars } from "../../db/schema";
import fs from "fs/promises";
import path from "path";
import { executeWithRetry } from "../../db/connection";
import { sql } from "drizzle-orm";

async function restoreBackup() {
  const backupPath = path.resolve(process.cwd(), 'backups/kava_bars_pre-operation_2025-02-23T18-24-54.277Z.json');
  
  try {
    console.log('Reading backup file...');
    const backupData = JSON.parse(await fs.readFile(backupPath, 'utf8'));
    
    if (!backupData.bars || !Array.isArray(backupData.bars)) {
      throw new Error('Invalid backup format');
    }

    console.log(`Found ${backupData.bars.length} bars to restore`);

    // Clear the existing table
    console.log('Clearing existing table...');
    await db.execute(sql`TRUNCATE TABLE public.kava_bars`);

    for (const bar of backupData.bars) {
      // Preserve the original ID and convert dates
      const barData = {
        ...bar,
        bar_id: bar.id, // Map id to bar_id
        createdAt: bar.createdAt ? new Date(bar.createdAt) : new Date(),
        updatedAt: bar.updatedAt ? new Date(bar.updatedAt) : null,
        lastVerified: bar.lastVerified ? new Date(bar.lastVerified) : null
      };

      await executeWithRetry(
        async () => {
          await db.insert(kavaBars).values(barData);
        },
        { priority: 'high' }
      );
    }

    console.log('Restore completed successfully');
  } catch (error) {
    console.error('Restore failed:', error);
    process.exit(1);
  }
}

// Run the restore
restoreBackup()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Restore failed:', error);
    process.exit(1);
  });
