import { db } from '@db';
import { kavaBars } from '@db/schema';
import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

// Most recent backup file
const BACKUP_FILE = path.join(rootDir, "backups/kava_bars_post-operation_2025-03-04T17-36-52.321Z.json");

// County area keywords
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

const BROWARD_AREAS = [
  'broward',
  'fort lauderdale',
  'davie',
  'plantation',
  'sunrise',
  'dania',
  'hallandale',
  'pompano',
  'coral springs',
  'deerfield',
  'hollywood',
  'miramar',
  'pembroke',
  'coconut creek',
  'lighthouse point',
  'lauderdale-by-the-sea',
  'lauderdale lakes',
  'lauderhill',
  'margate',
  'north lauderdale',
  'oakland park',
  'parkland',
  'southwest ranches',
  'tamarac',
  'west park',
  'weston',
  'wilton manors',
  'cooper city'
];

// Helper functions to check county
function isInPalmBeach(address: string): boolean {
  if (!address) return false;
  const lowerAddr = address.toLowerCase();
  return PALM_BEACH_AREAS.some(area => lowerAddr.includes(area));
}

function isInBroward(address: string): boolean {
  if (!address) return false;
  const lowerAddr = address.toLowerCase();
  return BROWARD_AREAS.some(area => lowerAddr.includes(area));
}

async function analyzeBrowardPalmBeach() {
  console.log("Analyzing Broward and Palm Beach County kava bars...");
  
  try {
    // Read from backup file
    console.log(`Reading backup file: ${BACKUP_FILE}`);
    const backupData = JSON.parse(await fs.readFile(BACKUP_FILE, 'utf8'));
    const backupBars = backupData.bars || [];
    
    // Get all bars from database
    const dbBars = await db.select({
      id: kavaBars.id,
      name: kavaBars.name,
      address: kavaBars.address,
      placeId: kavaBars.placeId,
      verificationStatus: kavaBars.verificationStatus,
      businessStatus: kavaBars.businessStatus
    }).from(kavaBars);
    
    // Categorize database bars
    const dbPalmBeachBars = dbBars.filter(bar => isInPalmBeach(bar.address));
    const dbBrowardBars = dbBars.filter(bar => isInBroward(bar.address));
    
    // Categorize backup bars
    const backupPalmBeachBars = backupBars.filter((bar: any) => isInPalmBeach(bar.address));
    const backupBrowardBars = backupBars.filter((bar: any) => isInBroward(bar.address));
    
    // Create lookup maps for database
    const dbPalmBeachPlaceIdMap = new Map();
    const dbPalmBeachNameAddressMap = new Map();
    const dbBrowardPlaceIdMap = new Map();
    const dbBrowardNameAddressMap = new Map();
    
    for (const bar of dbPalmBeachBars) {
      if (bar.placeId) dbPalmBeachPlaceIdMap.set(bar.placeId, bar);
      if (bar.name && bar.address) {
        const nameAddressKey = `${bar.name.toLowerCase()}-${bar.address.toLowerCase()}`;
        dbPalmBeachNameAddressMap.set(nameAddressKey, bar);
      }
    }
    
    for (const bar of dbBrowardBars) {
      if (bar.placeId) dbBrowardPlaceIdMap.set(bar.placeId, bar);
      if (bar.name && bar.address) {
        const nameAddressKey = `${bar.name.toLowerCase()}-${bar.address.toLowerCase()}`;
        dbBrowardNameAddressMap.set(nameAddressKey, bar);
      }
    }
    
    // Find missing bars in each county
    const missingPalmBeachBars = [];
    const missingBrowardBars = [];
    
    for (const bar of backupPalmBeachBars) {
      let found = false;
      
      // Check by place ID
      if (bar.placeId && dbPalmBeachPlaceIdMap.has(bar.placeId)) {
        found = true;
      } else {
        // Check by name+address
        const nameAddressKey = `${bar.name.toLowerCase()}-${bar.address.toLowerCase()}`;
        if (dbPalmBeachNameAddressMap.has(nameAddressKey)) {
          found = true;
        }
      }
      
      if (!found) {
        missingPalmBeachBars.push(bar);
      }
    }
    
    for (const bar of backupBrowardBars) {
      let found = false;
      
      // Check by place ID
      if (bar.placeId && dbBrowardPlaceIdMap.has(bar.placeId)) {
        found = true;
      } else {
        // Check by name+address
        const nameAddressKey = `${bar.name.toLowerCase()}-${bar.address.toLowerCase()}`;
        if (dbBrowardNameAddressMap.has(nameAddressKey)) {
          found = true;
        }
      }
      
      if (!found) {
        missingBrowardBars.push(bar);
      }
    }
    
    // Summary statistics
    console.log("\n===== SUMMARY =====");
    console.log(`Total database bars: ${dbBars.length}`);
    console.log(`Total backup bars: ${backupBars.length}`);
    console.log("\nPALM BEACH COUNTY:");
    console.log(`Database: ${dbPalmBeachBars.length} bars`);
    console.log(`Backup: ${backupPalmBeachBars.length} bars`);
    console.log(`Missing: ${missingPalmBeachBars.length} bars`);
    
    console.log("\nBROWARD COUNTY:");
    console.log(`Database: ${dbBrowardBars.length} bars`);
    console.log(`Backup: ${backupBrowardBars.length} bars`);
    console.log(`Missing: ${missingBrowardBars.length} bars`);
    
    console.log("\nSOUTH FLORIDA TOTAL (Broward + Palm Beach):");
    console.log(`Database: ${dbPalmBeachBars.length + dbBrowardBars.length} bars`);
    console.log(`Backup: ${backupPalmBeachBars.length + backupBrowardBars.length} bars`);
    console.log(`Missing: ${missingPalmBeachBars.length + missingBrowardBars.length} bars`);
    
    // Display missing bars
    if (missingPalmBeachBars.length > 0) {
      console.log("\nMISSING PALM BEACH BARS:");
      missingPalmBeachBars.forEach((bar, i) => {
        console.log(`${i+1}. ${bar.name} - ${bar.address} (Place ID: ${bar.placeId || 'N/A'})`);
      });
    }
    
    if (missingBrowardBars.length > 0) {
      console.log("\nMISSING BROWARD BARS:");
      missingBrowardBars.forEach((bar, i) => {
        console.log(`${i+1}. ${bar.name} - ${bar.address} (Place ID: ${bar.placeId || 'N/A'})`);
      });
    }
    
    // Verification status breakdown
    const palmBeachStatusCount = {
      verified: dbPalmBeachBars.filter(bar => bar.verificationStatus === 'verified').length,
      pending: dbPalmBeachBars.filter(bar => bar.verificationStatus === 'pending').length,
      not_kava_bar: dbPalmBeachBars.filter(bar => bar.verificationStatus === 'not_kava_bar').length
    };
    
    const browardStatusCount = {
      verified: dbBrowardBars.filter(bar => bar.verificationStatus === 'verified').length,
      pending: dbBrowardBars.filter(bar => bar.verificationStatus === 'pending').length,
      not_kava_bar: dbBrowardBars.filter(bar => bar.verificationStatus === 'not_kava_bar').length
    };
    
    console.log("\nVERIFICATION STATUS BREAKDOWN:");
    console.log("\nPalm Beach:");
    console.log(`- Verified: ${palmBeachStatusCount.verified} bars`);
    console.log(`- Pending: ${palmBeachStatusCount.pending} bars`);
    console.log(`- Not kava bars: ${palmBeachStatusCount.not_kava_bar} bars`);
    
    console.log("\nBroward:");
    console.log(`- Verified: ${browardStatusCount.verified} bars`);
    console.log(`- Pending: ${browardStatusCount.pending} bars`);
    console.log(`- Not kava bars: ${browardStatusCount.not_kava_bar} bars`);
    
    return {
      palmBeach: {
        dbCount: dbPalmBeachBars.length,
        backupCount: backupPalmBeachBars.length,
        missingCount: missingPalmBeachBars.length,
        missingBars: missingPalmBeachBars,
        status: palmBeachStatusCount
      },
      broward: {
        dbCount: dbBrowardBars.length,
        backupCount: backupBrowardBars.length,
        missingCount: missingBrowardBars.length,
        missingBars: missingBrowardBars,
        status: browardStatusCount
      },
      total: {
        dbCount: dbPalmBeachBars.length + dbBrowardBars.length,
        backupCount: backupPalmBeachBars.length + backupBrowardBars.length,
        missingCount: missingPalmBeachBars.length + missingBrowardBars.length
      }
    };
  } catch (error) {
    console.error("Error analyzing Broward and Palm Beach bars:", error);
    throw error;
  }
}

// Run the analysis
analyzeBrowardPalmBeach()
  .then(result => {
    console.log("\nAnalysis complete!");
    process.exit(0);
  })
  .catch(error => {
    console.error("Analysis failed:", error);
    process.exit(1);
  });