import fs from 'fs/promises';
import path from 'path';

async function listStatesInBackup() {
  try {
    // Read the latest backup file
    const backupFilePath = path.resolve(process.cwd(), 'backups', 'kava_bars_manual_2025-01-27T17-54-08-888Z.json');
    const backupData = JSON.parse(
      await fs.readFile(backupFilePath, 'utf-8')
    );

    // Extract states from addresses and count bars per state
    const stateCount = new Map<string, number>();
    const stateNames = new Map<string, string>([
      ['AL', 'Alabama'],
      ['AK', 'Alaska'],
      ['AZ', 'Arizona'],
      ['AR', 'Arkansas'],
      ['CA', 'California'],
      ['CO', 'Colorado'],
      ['CT', 'Connecticut'],
      ['DE', 'Delaware'],
      ['FL', 'Florida'],
      ['GA', 'Georgia'],
      ['HI', 'Hawaii'],
      ['ID', 'Idaho'],
      ['IL', 'Illinois'],
      ['IN', 'Indiana'],
      ['IA', 'Iowa'],
      ['KS', 'Kansas'],
      ['KY', 'Kentucky'],
      ['LA', 'Louisiana'],
      ['ME', 'Maine'],
      ['MD', 'Maryland'],
      ['MA', 'Massachusetts'],
      ['MI', 'Michigan'],
      ['MN', 'Minnesota'],
      ['MS', 'Mississippi'],
      ['MO', 'Missouri'],
      ['MT', 'Montana'],
      ['NE', 'Nebraska'],
      ['NV', 'Nevada'],
      ['NH', 'New Hampshire'],
      ['NJ', 'New Jersey'],
      ['NM', 'New Mexico'],
      ['NY', 'New York'],
      ['NC', 'North Carolina'],
      ['ND', 'North Dakota'],
      ['OH', 'Ohio'],
      ['OK', 'Oklahoma'],
      ['OR', 'Oregon'],
      ['PA', 'Pennsylvania'],
      ['RI', 'Rhode Island'],
      ['SC', 'South Carolina'],
      ['SD', 'South Dakota'],
      ['TN', 'Tennessee'],
      ['TX', 'Texas'],
      ['UT', 'Utah'],
      ['VT', 'Vermont'],
      ['VA', 'Virginia'],
      ['WA', 'Washington'],
      ['WV', 'West Virginia'],
      ['WI', 'Wisconsin'],
      ['WY', 'Wyoming'],
      ['DC', 'District of Columbia']
    ]);

    backupData.bars.forEach((bar: any) => {
      if (!bar.address) return;
      
      // Try to match state abbreviation first
      for (const [abbr, fullName] of stateNames) {
        if (bar.address.includes(`, ${abbr}`)) {
          stateCount.set(fullName, (stateCount.get(fullName) || 0) + 1);
          break;
        }
      }

      // Then try to match full state names
      for (const [abbr, fullName] of stateNames) {
        if (bar.address.includes(`, ${fullName}`)) {
          stateCount.set(fullName, (stateCount.get(fullName) || 0) + 1);
          break;
        }
      }
    });

    // Sort states by count
    const sortedStates = Array.from(stateCount.entries())
      .sort((a, b) => b[1] - a[1]);

    console.log('\nStates with Kava Bars in backup:');
    console.log('--------------------------------');
    sortedStates.forEach(([state, count]) => {
      console.log(`${state.padEnd(20)}: ${count} bars`);
    });
    console.log('\nTotal states:', sortedStates.length);
    console.log('Total bars:', backupData.bars.length);

  } catch (error: any) {
    console.error('Error analyzing backup:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  listStatesInBackup()
    .catch((error) => {
      console.error('Failed to list states:', error);
      process.exit(1);
    });
}
