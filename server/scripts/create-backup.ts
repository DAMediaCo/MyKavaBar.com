import { db } from "@db";
import { kavaBars } from "@db/schema";
import fs from "fs/promises";
import path from "path";

async function createBackup() {
  try {
    // Fetch all kava bars
    const bars = await db.query.kavaBars.findMany();
    
    // Create backup directory if it doesn't exist
    const backupDir = path.join(process.cwd(), "backups");
    await fs.mkdir(backupDir, { recursive: true });
    
    // Generate timestamp for the backup file
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    const backupPath = path.join(backupDir, `kava_bars_${timestamp}.json`);
    
    // Write the data to a file
    await fs.writeFile(backupPath, JSON.stringify(bars, null, 2));
    
    console.log(`Backup created successfully at: ${backupPath}`);
    console.log(`Total bars backed up: ${bars.length}`);
    
    // Create a state summary
    const stateCount = new Map();
    for (const bar of bars) {
      const address = bar.address || "";
      const stateMatch = address.match(/,\s*([A-Z]{2})\s*\d*,?\s*USA$/);
      if (stateMatch) {
        const state = stateMatch[1];
        stateCount.set(state, (stateCount.get(state) || 0) + 1);
      }
    }
    
    console.log("\nBars by state:");
    for (const [state, count] of stateCount.entries()) {
      console.log(`${state}: ${count} bars`);
    }
    
  } catch (error) {
    console.error("Error creating backup:", error);
    process.exit(1);
  }
}

createBackup().catch(console.error);
