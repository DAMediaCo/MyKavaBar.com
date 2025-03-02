import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

// List of all states to process
const STATES = [
  'arizona', 
  'arkansas',
  'district of columbia',
  'florida',
  'georgia',
  'idaho',
  'louisiana',
  'mississippi',
  'north carolina',
  'south carolina',
  'texas',
  'virginia',
  'west virginia',
  'california',
  'colorado',
  'nevada'
];

async function processState(state: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`\nStarting restoration for ${state}...`);

    const process = spawn('tsx', ['server/scripts/restore-all-states.ts', state], {
      stdio: 'inherit'
    });

    process.on('close', (code) => {
      if (code === 0) {
        console.log(`\n✓ Successfully processed ${state}`);
        resolve(true);
      } else {
        console.error(`\n✗ Failed to process ${state} (exit code: ${code})`);
        resolve(false);
      }
    });
  });
}

async function processAllStates() {
  console.log('Starting batch state restoration process...\n');
  console.log('States to process:', STATES.join(', '), '\n');

  const results = new Map<string, boolean>();

  for (const state of STATES) {
    // Process the state
    const success = await processState(state);
    results.set(state, success);

    // Add a delay between states to avoid rate limiting
    if (STATES.indexOf(state) < STATES.length - 1) {
      console.log('\nWaiting 30 seconds before processing next state...');
      await setTimeout(30000);
    }
  }

  // Print final summary
  console.log('\n=== Final Processing Summary ===');
  let succeeded = 0;
  let failed = 0;

  for (const [state, success] of results) {
    if (success) {
      succeeded++;
      console.log(`✓ ${state}: Success`);
    } else {
      failed++;
      console.log(`✗ ${state}: Failed`);
    }
  }

  console.log('\nTotal Results:');
  console.log(`- Succeeded: ${succeeded}`);
  console.log(`- Failed: ${failed}`);
  console.log(`- Total: ${STATES.length}`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  processAllStates()
    .then(() => {
      console.log('\nBatch processing complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nBatch processing failed:', error);
      process.exit(1);
    });
}

export { processAllStates, processState };