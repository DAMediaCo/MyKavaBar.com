import { db } from '@db';
import { kavaBars } from '@db/schema';
import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

// Use the most recent backup
const BACKUP_FILE = path.join(rootDir, "backups/kava_bars_post-operation_2025-03-04T17-36-52.321Z.json");

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

async function isInPalmBeach(address: string): boolean {
  if (!address) return false;
  const lowerAddr = address.toLowerCase();
  return PALM_BEACH_AREAS.some(area => lowerAddr.includes(area));
}

async function findExtraPalmBeachBars() {
  console.log("Analyzing Palm Beach County kava bars - finding extras in database...");
  
  try {
    // Read from the latest backup file
    console.log(`Reading backup file: ${BACKUP_FILE}`);
    const backupData = JSON.parse(await fs.readFile(BACKUP_FILE, 'utf8'));
    const backupBars = backupData.bars || [];
    
    // Filter backup bars to only Palm Beach
    const palmBeachBackupBars = [];
    for (const bar of backupBars) {
      if (await isInPalmBeach(bar.address)) {
        palmBeachBackupBars.push(bar);
      }
    }
    
    console.log(`Found ${palmBeachBackupBars.length} Palm Beach bars in backup file`);
    
    // Get all bars from DB
    const dbBars = await db.select({
      id: kavaBars.id,
      name: kavaBars.name,
      address: kavaBars.address,
      placeId: kavaBars.placeId,
      businessStatus: kavaBars.businessStatus,
      verificationStatus: kavaBars.verificationStatus,
      createdAt: kavaBars.createdAt,
      lastVerified: kavaBars.lastVerified
    }).from(kavaBars);
    
    console.log(`Found ${dbBars.length} total bars in database`);
    
    // Filter database bars to only Palm Beach
    const palmBeachDbBars = [];
    for (const bar of dbBars) {
      if (await isInPalmBeach(bar.address)) {
        palmBeachDbBars.push(bar);
      }
    }
    
    console.log(`Found ${palmBeachDbBars.length} Palm Beach bars in database`);
    
    // Create lookup maps for easier comparison of backup bars
    const backupPlaceIdMap = new Map();
    const backupNameAddressMap = new Map();
    
    for (const bar of palmBeachBackupBars) {
      if (bar.placeId) backupPlaceIdMap.set(bar.placeId, bar);
      
      // Create composite key of name+address for bars without placeId
      const nameAddressKey = `${bar.name.toLowerCase()}-${bar.address.toLowerCase()}`;
      backupNameAddressMap.set(nameAddressKey, bar);
    }
    
    // Find bars in the database that aren't in the backup
    const extraBars = [];
    
    for (const dbBar of palmBeachDbBars) {
      // Check by PlaceId first (most reliable)
      if (dbBar.placeId && !backupPlaceIdMap.has(dbBar.placeId)) {
        // Also check by name+address as fallback
        const nameAddressKey = `${dbBar.name.toLowerCase()}-${dbBar.address.toLowerCase()}`;
        if (!backupNameAddressMap.has(nameAddressKey)) {
          extraBars.push({
            ...dbBar,
            reason: 'Not in backup by placeId or name+address'
          });
        }
      } else if (!dbBar.placeId) {
        // For bars without placeId, check only by name+address
        const nameAddressKey = `${dbBar.name.toLowerCase()}-${dbBar.address.toLowerCase()}`;
        if (!backupNameAddressMap.has(nameAddressKey)) {
          extraBars.push({
            ...dbBar,
            reason: 'Not in backup by name+address (no placeId)'
          });
        }
      }
    }
    
    console.log(`Found ${extraBars.length} Palm Beach bars in database that aren't in backup`);
    
    if (extraBars.length > 0) {
      console.log("\nExtra Palm Beach bars in database (not in backup):");
      extraBars.forEach((bar, index) => {
        console.log(`\n[${index + 1}] ${bar.name}`);
        console.log(`ID: ${bar.id}`);
        console.log(`Address: ${bar.address}`);
        console.log(`Place ID: ${bar.placeId || 'N/A'}`);
        console.log(`Status: ${bar.businessStatus || 'Unknown'}`);
        console.log(`Verification: ${bar.verificationStatus || 'pending'}`);
        console.log(`Created: ${bar.createdAt}`);
        console.log(`Last Verified: ${bar.lastVerified || 'Never'}`);
        console.log(`Reason: ${bar.reason}`);
      });
      
      // Check if these are potentially duplicates
      console.log("\nChecking for potential duplicates with different names/addresses...");
      for (const extraBar of extraBars) {
        // Look for similar names in backup
        const similarNameBars = palmBeachBackupBars.filter(backupBar => {
          const similarity = calculateNameSimilarity(extraBar.name, backupBar.name);
          return similarity > 0.7; // 70% similarity threshold
        });
        
        if (similarNameBars.length > 0) {
          console.log(`\nPotential matches for "${extraBar.name}":`);
          similarNameBars.forEach(match => {
            console.log(`- ${match.name} (${calculateNameSimilarity(extraBar.name, match.name).toFixed(2)} similarity)`);
            console.log(`  Address: ${match.address}`);
            console.log(`  Place ID: ${match.placeId || 'N/A'}`);
          });
        }
      }
    } else {
      console.log("No extra Palm Beach bars found in the database compared to backup.");
    }
    
    return {
      totalBackupBars: backupBars.length,
      palmBeachBackupBars: palmBeachBackupBars.length,
      totalDbBars: dbBars.length,
      palmBeachDbBars: palmBeachDbBars.length,
      extraBars
    };
  } catch (error) {
    console.error("Error analyzing extra Palm Beach bars:", error);
    throw error;
  }
}

// Calculate string similarity (Levenshtein distance based)
function calculateNameSimilarity(str1: string, str2: string): number {
  const a = str1.toLowerCase();
  const b = str2.toLowerCase();
  
  // Calculate Levenshtein distance
  const matrix = [];
  
  // Increment along the first column of each row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  // Increment each column in the first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  // Calculate similarity as 1 - normalized distance
  const maxLength = Math.max(a.length, b.length);
  return 1 - matrix[b.length][a.length] / maxLength;
}

// Run the analysis
findExtraPalmBeachBars()
  .then(result => {
    console.log("\nAnalysis complete!");
    console.log(`Found ${result.extraBars.length} extra Palm Beach bars in the database`);
    process.exit(0);
  })
  .catch(error => {
    console.error("Analysis failed:", error);
    process.exit(1);
  });