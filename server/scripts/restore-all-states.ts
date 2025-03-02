import { Client } from "@googlemaps/google-maps-services-js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { eq } from "drizzle-orm";
import { setTimeout } from "timers/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY environment variable not set");
}

const mapsClient = new Client({});

async function getPlaceDetails(placeId: string) {
  try {
    const response = await mapsClient.placeDetails({
      params: {
        key: GOOGLE_MAPS_API_KEY!,
        place_id: placeId,
        fields: [
          "name",
          "formatted_address",
          "geometry",
          "place_id",
          "rating",
          "formatted_phone_number",
          "website",
          "opening_hours",
          "photos",
          "business_status"
        ]
      }
    });

    return response.data.result;
  } catch (error: any) {
    if (error.response?.data?.status === "OVER_QUERY_LIMIT") {
      console.log("Rate limit hit, pausing for 2 minutes...");
      await setTimeout(120000); // 2 minute pause
      return null;
    }
    console.error(`Error fetching details for place ${placeId}:`, error.message);
    return null;
  }
}

async function findProgressFiles(): Promise<Map<string, string>> {
  const progressFiles = new Map<string, string>();
  const searchDirs = [
    process.cwd(),
    path.join(process.cwd(), 'server', 'scripts'),
    path.join(process.cwd(), 'scripts'),
    __dirname
  ];

  for (const dir of searchDirs) {
    try {
      const files = await fs.readdir(dir);
      for (const file of files) {
        if (file.endsWith('_progress.json')) {
          const state = file.replace('_progress.json', '');
          if (!state.includes('verification') && 
              !state.includes('auto_fetch') && 
              !state.includes('worker') && 
              !progressFiles.has(state)) {
            progressFiles.set(state, path.join(dir, file));
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
    }
  }

  return progressFiles;
}

interface StateProgress {
  lastProcessedIndex: number;
  restored: number;
  failed: number;
  skipped: number;
  rateLimited: number;
  lastUpdated: string;
}

async function loadStateProgress(state: string): Promise<StateProgress> {
  const progressPath = path.join(process.cwd(), `${state.toLowerCase()}_restore_progress.json`);
  try {
    const data = await fs.readFile(progressPath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {
      lastProcessedIndex: 0,
      restored: 0,
      failed: 0,
      skipped: 0,
      rateLimited: 0,
      lastUpdated: new Date().toISOString()
    };
  }
}

async function saveStateProgress(state: string, progress: StateProgress) {
  const progressPath = path.join(process.cwd(), `${state.toLowerCase()}_restore_progress.json`);
  progress.lastUpdated = new Date().toISOString();
  await fs.writeFile(progressPath, JSON.stringify(progress, null, 2));
}

async function restoreState(state: string) {
  console.log(`\nStarting ${state} kava bars restoration...`);

  // Find progress file for this state
  const progressFiles = await findProgressFiles();
  const progressPath = progressFiles.get(state);

  if (!progressPath) {
    console.error(`No progress file found for ${state}`);
    return null;
  }

  // Load progress data
  const progressData = JSON.parse(await fs.readFile(progressPath, 'utf8'));
  const stateProgress = await loadStateProgress(state);

  console.log(`Found ${progressData.processedPlaceIds.length} place IDs to restore from ${state}`);
  console.log(`Resuming from index ${stateProgress.lastProcessedIndex}\n`);

  const batchSize = 3; // Small batch size to avoid timeouts
  for (let i = stateProgress.lastProcessedIndex; i < progressData.processedPlaceIds.length; i += batchSize) {
    const batch = progressData.processedPlaceIds.slice(i, Math.min(i + batchSize, progressData.processedPlaceIds.length));

    for (const placeId of batch) {
      try {
        const existingBar = await db.query.kavaBars.findFirst({
          where: eq(kavaBars.placeId, placeId)
        });

        if (existingBar) {
          console.log(`Bar with place ID ${placeId} already exists, skipping...`);
          stateProgress.skipped++;
          continue;
        }

        console.log(`\nFetching details for place ID: ${placeId}`);
        const placeDetails = await getPlaceDetails(placeId);

        if (!placeDetails) {
          stateProgress.rateLimited++;
          i -= batchSize; // Retry this batch
          break;
        }

        if (placeDetails.geometry?.location) {
          const barData = {
            name: placeDetails.name || 'Unknown',
            placeId: placeDetails.place_id,
            address: placeDetails.formatted_address || '',
            phone: placeDetails.formatted_phone_number || null,
            website: placeDetails.website || null,
            rating: placeDetails.rating ? placeDetails.rating.toString() : "0.00",
            location: JSON.stringify({
              lat: placeDetails.geometry.location.lat,
              lng: placeDetails.geometry.location.lng
            }),
            businessStatus: placeDetails.business_status || 'OPERATIONAL',
            verificationStatus: 'pending',
            dataCompletenessScore: "0.5",
            isSponsored: false,
            isVerifiedKavaBar: false,
            createdAt: new Date(),
            lastVerified: new Date()
          };

          await db.insert(kavaBars).values(barData);
          console.log(`✓ Restored: ${placeDetails.name}`);
          stateProgress.restored++;
        }
      } catch (error: any) {
        console.error(`Error processing place ID ${placeId}:`, error.message);
        stateProgress.failed++;
      }
    }

    // Update progress after each batch
    stateProgress.lastProcessedIndex = i + batch.length;
    await saveStateProgress(state, stateProgress);

    // Print progress
    console.log(`\nProgress:`);
    console.log(`- Processed: ${stateProgress.lastProcessedIndex} of ${progressData.processedPlaceIds.length}`);
    console.log(`- Restored: ${stateProgress.restored}`);
    console.log(`- Failed: ${stateProgress.failed}`);
    console.log(`- Skipped: ${stateProgress.skipped}`);
    console.log(`- Rate Limited: ${stateProgress.rateLimited}\n`);

    // Small delay between batches
    await setTimeout(1000);
  }

  console.log(`\n${state} Restoration Complete:`);
  console.log(`- Restored: ${stateProgress.restored}`);
  console.log(`- Failed: ${stateProgress.failed}`);
  console.log(`- Skipped: ${stateProgress.skipped}`);
  console.log(`- Rate Limited: ${stateProgress.rateLimited}`);
  console.log(`- Total Processed: ${progressData.processedPlaceIds.length}`);

  return stateProgress;
}

// Update the listStates function to handle Map iteration properly
async function listStates() {
  const progressFiles = await findProgressFiles();
  console.log("\nAvailable states to restore:");
  // Convert Map keys to array before iteration
  Array.from(progressFiles.keys()).forEach(state => {
    console.log(`- ${state}`);
  });
}

// Run the restoration for a specific state
if (import.meta.url === `file://${process.argv[1]}`) {
  const state = process.argv[2];
  if (!state) {
    console.log("Please provide a state name as argument");
    listStates().then(() => {
      console.log("\nUsage: tsx server/scripts/restore-all-states.ts <state_name>");
      process.exit(1);
    });
  } else {
    console.log(`Starting restoration for ${state}...`);
    restoreState(state)
      .then((result) => {
        if (result) {
          console.log("\nRestoration completed successfully");
        } else {
          console.error("\nRestoration failed");
          process.exit(1);
        }
      })
      .catch((error) => {
        console.error("\nRestoration failed:", error);
        process.exit(1);
      });
  }
}

export { restoreState, listStates };