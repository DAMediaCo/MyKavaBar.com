import { db } from '../db';
import { kavaBars } from '../db/schema';
import * as fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

// Most recent backup file
const BACKUP_FILE = path.join(rootDir, "backups/kava_bars_post-operation_2025-03-04T17-36-52.321Z.json");

// The specific bars to check
const TARGET_BARS = [
  'the nak',
  'Herb\'n Roots Exotic Tea Lounge', 
  'Kavasutra Kava Bar Boca', 
  'RipTidez Kava',
  'Delray Kava Lounge',
  'Pause Kava Lounge',
  'Pause Kava Bar and Coffee House' // Alternative name
];

// Find bars that contain any of these name parts
function matchesTargetBars(barName: string): boolean {
  if (!barName) return false;
  const lowerName = barName.toLowerCase();
  return TARGET_BARS.some(targetName => {
    const lowerTarget = targetName.toLowerCase();
    return lowerName.includes(lowerTarget) || 
           lowerTarget.includes(lowerName) ||
           // Special case for 'Pause Kava'
           (lowerTarget.includes('pause kava') && lowerName.includes('pause kava'));
  });
}

// Calculate string similarity for fuzzy matching
function calculateSimilarity(str1: string, str2: string): number {
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

async function checkSpecificPalmBeachBars() {
  console.log("Checking for specific Palm Beach County kava bars...");
  console.log("Targeted bars:", TARGET_BARS.join(", "));
  
  try {
    // Get all bars from the database
    const dbBars = await db.select({
      id: kavaBars.id,
      name: kavaBars.name,
      address: kavaBars.address,
      placeId: kavaBars.placeId,
      verificationStatus: kavaBars.verificationStatus,
      businessStatus: kavaBars.businessStatus,
      createdAt: kavaBars.createdAt
    }).from(kavaBars);
    
    console.log(`Found ${dbBars.length} total bars in database`);
    
    // Find exact and similar matches in database
    const exactMatches = dbBars.filter(bar => matchesTargetBars(bar.name));
    
    console.log(`\nFound ${exactMatches.length} exact matches in database:`);
    if (exactMatches.length > 0) {
      exactMatches.forEach((bar, i) => {
        console.log(`${i+1}. ${bar.name} - ${bar.address}`);
        console.log(`   ID: ${bar.id}, Status: ${bar.verificationStatus}, Business Status: ${bar.businessStatus}`);
        console.log(`   Created: ${bar.createdAt}`);
        
        // Find which target bar this matches
        for (const targetBar of TARGET_BARS) {
          const similarity = calculateSimilarity(bar.name, targetBar);
          if (similarity > 0.5) { // 50% similarity threshold
            console.log(`   Matches target: "${targetBar}" (${(similarity * 100).toFixed(1)}% similarity)`);
          }
        }
      });
    } else {
      console.log("No exact matches found in database.");
    }
    
    // Find similar matches (not exact but high similarity)
    const similarMatches = dbBars.filter(bar => {
      if (exactMatches.some(exactBar => exactBar.id === bar.id)) {
        return false; // Skip exact matches
      }
      
      return TARGET_BARS.some(targetBar => {
        const similarity = calculateSimilarity(bar.name, targetBar);
        return similarity > 0.6; // 60% similarity threshold
      });
    });
    
    console.log(`\nFound ${similarMatches.length} similar matches in database:`);
    if (similarMatches.length > 0) {
      similarMatches.forEach((bar, i) => {
        console.log(`${i+1}. ${bar.name} - ${bar.address}`);
        console.log(`   ID: ${bar.id}, Status: ${bar.verificationStatus}, Business Status: ${bar.businessStatus}`);
        
        // Find which target bar this matches
        for (const targetBar of TARGET_BARS) {
          const similarity = calculateSimilarity(bar.name, targetBar);
          if (similarity > 0.5) { // 50% similarity threshold
            console.log(`   Similar to target: "${targetBar}" (${(similarity * 100).toFixed(1)}% similarity)`);
          }
        }
      });
    } else {
      console.log("No similar matches found in database.");
    }
    
    // Also check backup for comparison
    const backupData = JSON.parse(await fs.readFile(BACKUP_FILE, 'utf8'));
    const backupBars = backupData.bars || [];
    
    // Find matches in backup
    const backupExactMatches = backupBars.filter((bar: any) => matchesTargetBars(bar.name));
    
    console.log(`\nFound ${backupExactMatches.length} exact matches in backup file:`);
    if (backupExactMatches.length > 0) {
      backupExactMatches.forEach((bar: any, i: number) => {
        console.log(`${i+1}. ${bar.name} - ${bar.address}`);
        console.log(`   Status: ${bar.verificationStatus}, Business Status: ${bar.businessStatus || 'Unknown'}`);
        console.log(`   Place ID: ${bar.placeId || 'N/A'}`);
        
        // Check if this backup bar is also in database
        const inDatabase = exactMatches.some(dbBar => 
          (dbBar.placeId && bar.placeId && dbBar.placeId === bar.placeId) ||
          (calculateSimilarity(dbBar.name, bar.name) > 0.8 && 
           calculateSimilarity(dbBar.address, bar.address) > 0.8)
        );
        
        console.log(`   In Database: ${inDatabase ? 'Yes' : 'No'}`);
      });
    } else {
      console.log("No exact matches found in backup.");
    }
    
    // For each target bar, check if it's found in either database or backup
    console.log("\nSTATUS BY TARGET BAR:");
    for (const targetBar of TARGET_BARS) {
      const inDb = exactMatches.some(bar => calculateSimilarity(bar.name, targetBar) > 0.7) ||
                   similarMatches.some(bar => calculateSimilarity(bar.name, targetBar) > 0.7);
      
      const inBackup = backupExactMatches.some((bar: any) => calculateSimilarity(bar.name, targetBar) > 0.7);
      
      console.log(`- "${targetBar}": ${inDb ? 'Found in Database' : 'NOT in Database'}, ${inBackup ? 'Found in Backup' : 'NOT in Backup'}`);
      
      // If found in backup but not in database, it's missing
      if (inBackup && !inDb) {
        console.log(`  WARNING: "${targetBar}" is in the backup but not in the database!`);
        
        // Find the matching backup bar for more details
        const backupBar = backupExactMatches.find((bar: any) => calculateSimilarity(bar.name, targetBar) > 0.7);
        if (backupBar) {
          console.log(`  Details from backup: ${backupBar.name} - ${backupBar.address}`);
          console.log(`  Place ID: ${backupBar.placeId || 'N/A'}`);
        }
      }
      // If not found in either place, it might be a new bar not in our dataset yet
      else if (!inBackup && !inDb) {
        console.log(`  NOTE: "${targetBar}" is not found in either database or backup - might be a new bar.`);
      }
    }
    
    return {
      dbBarsCount: dbBars.length,
      backupBarsCount: backupBars.length,
      exactMatches,
      similarMatches,
      backupExactMatches
    };
  } catch (error) {
    console.error("Error checking specific Palm Beach bars:", error);
    throw error;
  }
}

// Run the analysis
checkSpecificPalmBeachBars()
  .then(result => {
    console.log("\nAnalysis complete!");
    process.exit(0);
  })
  .catch(error => {
    console.error("Analysis failed:", error);
    process.exit(1);
  });