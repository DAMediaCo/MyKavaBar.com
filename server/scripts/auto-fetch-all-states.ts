import fetchKavaBars from './fetch-kava-bars';
import fs from 'fs/promises';
import path from 'path';

const states = [
  'Florida',
  'Arizona',
  'Nevada',
  'Colorado',
  'Texas',
  'California'
];

interface AutoFetchProgress {
  completedStates: string[];
  currentState: string | null;
  lastRunTimestamp: string;
  errors: Array<{
    state: string;
    error: string;
    timestamp: string;
  }>;
}

const progressFilePath = path.join(process.cwd(), 'auto_fetch_progress.json');

async function loadProgress(): Promise<AutoFetchProgress> {
  try {
    const data = await fs.readFile(progressFilePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {
      completedStates: [],
      currentState: null,
      lastRunTimestamp: new Date().toISOString(),
      errors: []
    };
  }
}

async function saveProgress(progress: AutoFetchProgress) {
  await fs.writeFile(progressFilePath, JSON.stringify(progress, null, 2));
}

async function processAllStates() {
  console.log('Starting automated kava bar search across all states...\n');

  const progress = await loadProgress();

  // Get remaining states that haven't been processed
  const remainingStates = states.filter(state => 
    !progress.completedStates.includes(state)
  );

  // If all states are done, start fresh
  if (remainingStates.length === 0) {
    console.log('All states have been processed. Starting fresh cycle...');
    progress.completedStates = [];
    progress.errors = [];
    await saveProgress(progress);
  }

  // Use remaining states if available, otherwise use all states
  const statesToProcess = remainingStates.length ? remainingStates : states;

  console.log('States to process:', statesToProcess.join(', '), '\n');

  for (const state of statesToProcess) {
    try {
      console.log(`\nProcessing state: ${state}`);

      // Update progress before processing
      progress.currentState = state;
      progress.lastRunTimestamp = new Date().toISOString();
      await saveProgress(progress);

      // Set environment variable for the state
      process.env.STATE_TO_PROCESS = state;

      // Process the state
      await fetchKavaBars();

      // Update progress after successful processing
      if (!progress.completedStates.includes(state)) {
        progress.completedStates.push(state);
      }
      progress.currentState = null;
      await saveProgress(progress);

      console.log(`✓ Completed processing ${state}\n`);

      // Add delay between states to avoid rate limiting
      if (statesToProcess.indexOf(state) < statesToProcess.length - 1) {
        console.log('Waiting before processing next state...');
        await new Promise(resolve => setTimeout(resolve, 15000));
      }
    } catch (error: any) {
      console.error(`Error processing ${state}:`, error.message);

      // Log error in progress
      progress.errors.push({
        state,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      // Save current progress before exiting
      progress.currentState = null;
      await saveProgress(progress);

      throw error;
    }
  }

  console.log('\nCompleted processing all states!');
  return progress;
}

// Export for use in other modules
export default processAllStates;

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  processAllStates()
    .then((finalProgress) => {
      console.log('✓ All states processed successfully');
      console.log('Final state counts:', finalProgress.completedStates.length);
      if (finalProgress.errors.length > 0) {
        console.log('Errors encountered:', finalProgress.errors);
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error('✗ Script failed:', error.message);
      process.exit(1);
    });
}