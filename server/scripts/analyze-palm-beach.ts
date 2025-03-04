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

async function analyzePalmBeach() {
  console.log("Analyzing Palm Beach County kava bars...");
  
  try {
    // Read bars from database and backup
    // 1. Get database bars first
    const dbBars = await db.select({
      id: kavaBars.id,
      name: kavaBars.name,
      address: kavaBars.address,
      placeId: kavaBars.placeId
    }).from(kavaBars);
    
    console.log(`Found ${dbBars.length} total bars in database`);
    
    // 2. Read from backup file
    console.log(`Reading backup file: ${BACKUP_FILE}`);
    const backupData = JSON.parse(await fs.readFile(BACKUP_FILE, 'utf8'));
    const backupBars = backupData.bars || [];
    
    console.log(`Found ${backupBars.length} total bars in backup`);
    
    // 3. Extract Palm Beach bars from database
    const dbPalmBeachBars = dbBars.filter(bar => {
      if (!bar.address) return false;
      
      const addr = bar.address.toLowerCase();
      return PALM_BEACH_AREAS.some(area => addr.includes(area));
    });
    
    console.log(`Found ${dbPalmBeachBars.length} Palm Beach bars in database`);
    console.log("Database Palm Beach bars:");
    dbPalmBeachBars.forEach((bar, i) => {
      console.log(`${i+1}. ${bar.name} - ${bar.address} (ID: ${bar.id}, Place ID: ${bar.placeId || 'N/A'})`);
    });
    
    // 4. Extract Palm Beach bars from backup
    const backupPalmBeachBars = backupBars.filter((bar: any) => {
      if (!bar.address) return false;
      
      const addr = bar.address.toLowerCase();
      return PALM_BEACH_AREAS.some(area => addr.includes(area)); 
    });
    
    console.log(`Found ${backupPalmBeachBars.length} Palm Beach bars in backup`);
    console.log("Backup Palm Beach bars:");
    backupPalmBeachBars.forEach((bar: any, i: number) => {
      console.log(`${i+1}. ${bar.name} - ${bar.address} (Place ID: ${bar.placeId || 'N/A'})`);
    });
    
    // 5. Find bars in backup but not in database (by place ID)
    const dbPlaceIds = new Set(dbPalmBeachBars.filter(bar => bar.placeId).map(bar => bar.placeId));
    
    const missingByPlaceId = backupPalmBeachBars.filter((bar: any) => {
      return bar.placeId && !dbPlaceIds.has(bar.placeId);
    });
    
    console.log(`Found ${missingByPlaceId.length} Palm Beach bars missing by place ID`);
    if (missingByPlaceId.length > 0) {
      console.log("Missing by Place ID:");
      missingByPlaceId.forEach((bar: any, i: number) => {
        console.log(`${i+1}. ${bar.name} - ${bar.address} (Place ID: ${bar.placeId || 'N/A'})`);
      });
    }
    
    // 6. Also find bars by exact name comparison
    const dbNames = new Set(dbPalmBeachBars.filter(bar => bar.name).map(bar => bar.name.toLowerCase()));
    
    const missingByName = backupPalmBeachBars.filter((bar: any) => {
      return bar.name && !dbNames.has(bar.name.toLowerCase());
    });
    
    console.log(`Found ${missingByName.length} Palm Beach bars missing by name`);
    if (missingByName.length > 0) {
      console.log("Missing by Name:");
      missingByName.forEach((bar: any, i: number) => {
        console.log(`${i+1}. ${bar.name} - ${bar.address} (Place ID: ${bar.placeId || 'N/A'})`);
      });
    }
    
    // 7. Find the intersection - truly missing bars
    const trulyMissingBars = missingByPlaceId.filter((bar: any) => {
      return bar.name && !dbNames.has(bar.name.toLowerCase());
    });
    
    console.log(`Found ${trulyMissingBars.length} Palm Beach bars that are truly missing`);
    console.log("Truly missing Palm Beach bars:");
    trulyMissingBars.forEach((bar: any, i: number) => {
      console.log(`${i+1}. ${bar.name} - ${bar.address} (Place ID: ${bar.placeId || 'N/A'})`);
    });
    
    return {
      dbTotal: dbBars.length,
      dbPalmBeach: dbPalmBeachBars.length,
      backupTotal: backupBars.length,
      backupPalmBeach: backupPalmBeachBars.length,
      missingByPlaceId: missingByPlaceId.length,
      missingByName: missingByName.length,
      trulyMissing: trulyMissingBars.length,
      trulyMissingBars,
      allBackupPalmBeachBars: backupPalmBeachBars
    };
  } catch (error) {
    console.error("Error analyzing Palm Beach bars:", error);
    throw error;
  }
}

// Run the analysis
analyzePalmBeach()
  .then(result => {
    console.log("Analysis completed successfully");
    console.log("Missing Palm Beach Bars to Restore:", result.trulyMissingBars.map((bar: any) => ({
      name: bar.name,
      address: bar.address,
      placeId: bar.placeId
    })));
    process.exit(0);
  })
  .catch(error => {
    console.error("Analysis failed:", error);
    process.exit(1);
  });