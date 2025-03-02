import { log } from '../utils/logger';
import { db } from '@db';
import { kavaBars } from '@db/schema';
import { sql } from 'drizzle-orm';
import path from 'path';
import fs from 'fs/promises';

// Progress tracking
interface WorkerProgress {
  currentState: string;
  currentCity: string;
  completedStates: string[];
  completedCities: string[];
  errors: Array<{
    state: string;
    city: string;
    error: string;
    timestamp: string;
  }>;
  lastUpdated: string;
  processedPlaceIds: string[];
  totalProcessed: number;
}

const progressPath = path.join(process.cwd(), 'worker_progress.json');

async function loadProgress(): Promise<WorkerProgress> {
  try {
    const data = await fs.readFile(progressPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {
      currentState: '',
      currentCity: '',
      completedStates: [],
      completedCities: [],
      errors: [],
      lastUpdated: new Date().toISOString(),
      processedPlaceIds: [],
      totalProcessed: 0
    };
  }
}

async function saveProgress(progress: WorkerProgress) {
  await fs.writeFile(progressPath, JSON.stringify(progress, null, 2));
}

// States to process in order of priority
const STATES_TO_PROCESS = [
  'Florida',
  'Arizona', 
  'Nevada',
  'Colorado',
  'Texas',
  'California'
];

// Worker function
async function runWorker() {
  let progress = await loadProgress();

  try {
    // Log worker start
    log('Data collection worker started');

    // Get current counts
    const counts = await db.execute(sql`
      SELECT 
        COUNT(*) as count,
        CASE 
          WHEN address ILIKE '%florida%' OR address ILIKE '%, fl%' THEN 'Florida'
          WHEN address ILIKE '%arizona%' OR address ILIKE '%, az%' THEN 'Arizona'
          WHEN address ILIKE '%nevada%' OR address ILIKE '%, nv%' THEN 'Nevada'
          WHEN address ILIKE '%colorado%' OR address ILIKE '%, co%' THEN 'Colorado'
          WHEN address ILIKE '%texas%' OR address ILIKE '%, tx%' THEN 'Texas'
          WHEN address ILIKE '%california%' OR address ILIKE '%, ca%' THEN 'California'
          ELSE 'Other'
        END as state
      FROM kava_bars
      GROUP BY state
      ORDER BY count DESC
    `);

    log('Current kava bar counts:');
    counts.rows.forEach(row => {
      log(`${row.state}: ${row.count} bars`);
    });

    // Process each state
    for (const state of STATES_TO_PROCESS) {
      if (progress.completedStates.includes(state)) {
        log(`Skipping completed state: ${state}`);
        continue;
      }

      try {
        log(`Processing state: ${state}`);
        progress.currentState = state;
        await saveProgress(progress);

        // Import and run the fetch script for this state
        const { default: fetchKavaBars } = await import('./fetch-kava-bars');
        process.env.STATE_TO_PROCESS = state;
        await fetchKavaBars();

        // Mark state as complete
        progress.completedStates.push(state);
        progress.currentState = '';
        progress.lastUpdated = new Date().toISOString();
        await saveProgress(progress);

        // Log completion of state
        log(`Completed processing ${state}`);

        // Get updated counts for this state
        const stateCount = await db.execute(sql`
          SELECT COUNT(*) as count
          FROM kava_bars
          WHERE address ILIKE ${`%${state}%`} 
             OR address ILIKE ${`%, ${state.slice(0,2).toLowerCase()}%`}
        `);

        log(`Updated count for ${state}: ${stateCount.rows[0].count} bars`);

      } catch (error: any) {
        log(`Error processing ${state}: ${error.message}`);
        progress.errors.push({
          state,
          city: progress.currentCity,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        await saveProgress(progress);
      }

      // Wait between states to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    log('Worker completed successfully');
  } catch (error: any) {
    log(`Worker failed: ${error.message}`);
    progress.errors.push({
      state: progress.currentState,
      city: progress.currentCity,
      error: error.message,
      timestamp: new Date().toISOString()
    });
    await saveProgress(progress);
    throw error;
  }
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runWorker()
    .then(() => {
      log('✓ Worker completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      log(`⨯ Worker failed: ${error.message}`);
      process.exit(1);
    });
}

export { runWorker, loadProgress };