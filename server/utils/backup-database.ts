import { db } from "@db";
import { kavaBars } from "@db/schema";
import fs from 'fs';
import path from 'path';

export async function backupDatabase(operation: string = 'manual') {
  try {
    console.log(`Creating database backup for operation: ${operation}`);
    
    // Fetch all kava bars
    const bars = await db.query.kavaBars.findMany();
    
    // Create backup directory if it doesn't exist
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const filename = `kava_bars_${operation}_${timestamp}.json`;
    const backupPath = path.join(backupDir, filename);

    // Write backup file
    const backup = {
      timestamp,
      bars
    };

    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    console.log(`Backup created successfully: ${filename}`);

    return filename;
  } catch (error: any) {
    console.error('Error creating backup:', error.message);
    throw error;
  }
}
