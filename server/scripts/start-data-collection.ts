import { log } from '../utils/logger';
import { runWorker, loadProgress } from './worker';

// Track collection status
let collectionStatus = {
  isRunning: false,
  currentState: '',
  error: null as string | null,
  lastUpdated: new Date()
};

export function getCollectionStatus() {
  const workerStatus = loadProgress();
  return {
    ...collectionStatus,
    workerStatus
  };
}

async function startDataCollection() {
  if (collectionStatus.isRunning) {
    throw new Error('Data collection is already running');
  }

  try {
    collectionStatus = {
      isRunning: true,
      currentState: 'Starting',
      error: null,
      lastUpdated: new Date()
    };

    log('Starting automated data collection process...');

    // Start the worker process
    runWorker()
      .then(() => {
        log('Data collection completed successfully');
        collectionStatus = {
          isRunning: false,
          currentState: '',
          error: null,
          lastUpdated: new Date()
        };
      })
      .catch((error) => {
        log(`Data collection failed: ${error.message}`);
        collectionStatus = {
          isRunning: false,
          currentState: '',
          error: error.message,
          lastUpdated: new Date()
        };
      });

    // Return immediately since worker is running in background
    return {
      message: 'Data collection process started',
      status: 'running'
    };
  } catch (error: any) {
    log(`Error starting data collection: ${error.message}`);
    collectionStatus = {
      isRunning: false,
      currentState: '',
      error: error.message,
      lastUpdated: new Date()
    };
    throw error;
  }
}

// Export for use in API routes
export default startDataCollection;

// Only execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startDataCollection()
    .then(() => {
      log('✓ Data collection process started');
      // Keep process alive to allow worker to run
      setInterval(() => {
        const status = getCollectionStatus();
        if (!status.isRunning) {
          process.exit(0);
        }
      }, 5000);
    })
    .catch((error) => {
      log(`⨯ Failed to start data collection: ${error.message}`);
      process.exit(1);
    });
}