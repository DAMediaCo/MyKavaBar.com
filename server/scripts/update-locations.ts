import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { sql } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

if (!process.env.GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY environment variable is required");
}

const client = new Client({});

interface Progress {
  lastProcessedId: number;
  updated: number;
  failed: number;
  errors: Array<{ id: number; name: string; error: string; }>;
}

async function loadProgress(): Promise<Progress> {
  try {
    const progressFile = path.join(process.cwd(), 'location_update_progress.json');
    const data = await fs.readFile(progressFile, 'utf8');
    return JSON.parse(data);
  } catch {
    return {
      lastProcessedId: 0,
      updated: 0,
      failed: 0,
      errors: []
    };
  }
}

async function saveProgress(progress: Progress) {
  const progressFile = path.join(process.cwd(), 'location_update_progress.json');
  await fs.writeFile(progressFile, JSON.stringify(progress, null, 2));
}

async function getLocationFromAddress(address: string) {
  try {
    console.log(`Geocoding address: ${address}`);
    const response = await client.geocode({
      params: {
        address: address,
        key: process.env.GOOGLE_MAPS_API_KEY as string
      }
    });

    if (response.data.results && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return {
        lat: location.lat,
        lng: location.lng
      };
    }
    console.log(`No results found for address: ${address}`);
    return null;
  } catch (error: any) {
    console.error(`Error geocoding address ${address}:`, error.message);
    if (error.response?.data?.status === "OVER_QUERY_LIMIT") {
      console.log("Rate limit hit, pausing for 60 seconds...");
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
    return null;
  }
}

async function isValidLocation(location: any): Promise<boolean> {
  try {
    if (!location) return false;

    // If string, attempt to parse
    const parsedLocation = typeof location === 'string' ? 
      JSON.parse(location) : location;

    // Verify structure
    if (!parsedLocation || typeof parsedLocation !== 'object') return false;
    if (!('lat' in parsedLocation) || !('lng' in parsedLocation)) return false;

    // Parse coordinates as numbers
    const lat = parseFloat(parsedLocation.lat);
    const lng = parseFloat(parsedLocation.lng);

    // Validate coordinate ranges
    if (isNaN(lat) || isNaN(lng)) return false;
    if (lat < -90 || lat > 90) return false;
    if (lng < -180 || lng > 180) return false;

    return true;
  } catch (error) {
    console.error('Error validating location:', error);
    return false;
  }
}

async function updateLocations() {
  try {
    // Load previous progress
    const progress = await loadProgress();
    console.log(`Previously: Updated ${progress.updated}, Failed ${progress.failed}`);

    // Get all bars with invalid or missing location data
    const bars = await db.execute<{ id: number, name: string, address: string, location: string }>(sql`
      SELECT id, name, address, location::text
      FROM kava_bars
      WHERE location IS NULL 
         OR location::text = ''
         OR location::text = '{}'
         OR NOT (
           location::jsonb ? 'lat' 
           AND location::jsonb ? 'lng'
           AND (location->>'lat')::numeric BETWEEN -90 AND 90
           AND (location->>'lng')::numeric BETWEEN -180 AND 180
         )
      ORDER BY id
      LIMIT 50
    `);

    console.log(`Found ${bars.rows.length} bars needing location data`);

    // Process in small batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < bars.rows.length; i += batchSize) {
      const batch = bars.rows.slice(i, i + batchSize);

      for (const bar of batch) {
        try {
          // Skip if current location is valid
          if (await isValidLocation(bar.location)) {
            console.log(`- Skipping ${bar.name} - location already valid`);
            continue;
          }

          const location = await getLocationFromAddress(bar.address);
          if (location && isValidLocation(location)) {
            // Format location as a proper JSON string
            const locationJson = JSON.stringify(location);

            // Update the database with properly formatted JSON
            await db.execute(sql`
              UPDATE kava_bars 
              SET location = ${locationJson}::jsonb,
                  verification_notes = ${`Location data updated via geocoding`}
              WHERE id = ${bar.id}
            `);

            progress.updated++;
            console.log(`✓ Updated location for: ${bar.name}`);
            console.log(`  Location stored as: ${locationJson}`);
          } else {
            progress.failed++;
            progress.errors.push({
              id: bar.id,
              name: bar.name,
              error: "Failed to geocode address or invalid location data"
            });
            console.log(`✗ Failed to get valid location for: ${bar.name}`);
          }
        } catch (error: any) {
          progress.failed++;
          progress.errors.push({
            id: bar.id,
            name: bar.name,
            error: error.message
          });
          console.error(`Error updating ${bar.name}:`, error.message);
        }

        progress.lastProcessedId = bar.id;
        await saveProgress(progress);

        // Add a small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`\nProgress: ${i + batch.length}/${bars.rows.length}`);
      console.log(`Updated: ${progress.updated}, Failed: ${progress.failed}\n`);
    }

    return {
      updated: progress.updated,
      failed: progress.failed,
      errors: progress.errors
    };
  } catch (error: any) {
    console.error("Error updating locations:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateLocations()
    .then((results) => {
      console.log("\nLocation update completed:");
      console.log(`- Updated: ${results.updated}`);
      console.log(`- Failed: ${results.failed}`);
      if (results.errors.length > 0) {
        console.log("\nErrors encountered:");
        results.errors.forEach(err => 
          console.log(`- ${err.name} (ID: ${err.id}): ${err.error}`)
        );
      }
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nLocation update failed:", error);
      process.exit(1);
    });
}