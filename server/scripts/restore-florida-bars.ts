import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { eq } from "drizzle-orm";
import fs from 'fs/promises';
import path from 'path';

if (!process.env.GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY environment variable is required");
}

const client = new Client({});
const backupDir = path.join(process.cwd(), 'backups', '20250127_191717');
const progressFilePath = path.join(backupDir, 'florida_progress.json');

async function getPlaceDetails(placeId: string) {
  try {
    console.log(`\nFetching details for place ID: ${placeId}`);

    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        fields: [
          "name",
          "formatted_address",
          "formatted_phone_number",
          "geometry",
          "rating",
          "opening_hours",
          "business_status",
          "types"
        ],
        key: process.env.GOOGLE_MAPS_API_KEY as string
      },
    });

    if (response.data.status === "OK" && response.data.result) {
      console.log(`Successfully fetched details for: ${response.data.result.name}`);
      return response.data.result;
    }

    console.log(`Failed to fetch details for place ID ${placeId}`);
    return null;
  } catch (error: any) {
    console.error(`Error fetching details for place ID ${placeId}:`, error.message);

    if (error.response?.data?.status === "OVER_QUERY_LIMIT") {
      console.log("Rate limit hit, pausing for 60 seconds...");
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
    return null;
  }
}

async function restoreFloridaBars() {
  console.log("Starting Florida kava bars restoration...\n");

  try {
    // Load progress file from backup
    const data = await fs.readFile(progressFilePath, 'utf8');
    const progress = JSON.parse(data);
    const placeIds = progress.processedPlaceIds as string[];

    console.log(`Found ${placeIds.length} place IDs to restore\n`);

    let restored = 0;
    let failed = 0;
    let updated = 0;

    // Process in larger batches to complete faster
    const batchSize = 10;
    for (let i = 0; i < placeIds.length; i += batchSize) {
      const batch = placeIds.slice(i, Math.min(i + batchSize, placeIds.length));

      for (const placeId of batch) {
        try {
          // Check if already exists
          const existing = await db.select()
            .from(kavaBars)
            .where(eq(kavaBars.placeId, placeId))
            .limit(1);

          // Add small delay between API calls
          await new Promise(resolve => setTimeout(resolve, 1000));

          const details = await getPlaceDetails(placeId);
          if (!details) {
            failed++;
            continue;
          }

          // Format location data
          const locationData = {
            lat: details.geometry?.location.lat || 0,
            lng: details.geometry?.location.lng || 0
          };

          // Verify the address is in Florida
          const address = details.formatted_address?.toLowerCase() || '';
          if (!address.includes('florida') && !address.includes(', fl')) {
            console.log(`Skipping non-Florida bar: ${details.name} (${address})`);
            continue;
          }

          const barData = {
            name: details.name || '',
            address: details.formatted_address || '',
            phone: details.formatted_phone_number || null,
            placeId: placeId,
            rating: details.rating?.toString() || null,
            location: locationData,
            hours: details.opening_hours?.weekday_text || null,
            businessStatus: details.business_status || 'OPERATIONAL',
            isVerifiedKavaBar: true,
            verificationStatus: 'verified_kava_bar',
            verificationNotes: 'Restored from Florida Jan 27 backup',
            isSponsored: false,
            dataCompletenessScore: "0.8",
            createdAt: new Date(),
            lastVerified: new Date()
          };

          if (existing.length > 0) {
            console.log(`Updating bar: ${details.name}`);
            await db
              .update(kavaBars)
              .set(barData)
              .where(eq(kavaBars.placeId, placeId));
            updated++;
          } else {
            console.log(`Creating new bar: ${details.name}`);
            await db
              .insert(kavaBars)
              .values(barData);
            restored++;
          }

        } catch (error: any) {
          console.error(`Error processing place ${placeId}:`, error.message);
          failed++;
        }
      }

      console.log(`\nProgress: ${restored} restored, ${updated} updated, ${failed} failed`);
      console.log(`Processed ${i + batch.length} of ${placeIds.length}`);
    }

    console.log("\nRestoration Complete:");
    console.log(`✓ ${restored} bars restored`);
    console.log(`✓ ${updated} bars updated`);
    console.log(`❌ ${failed} bars failed`);

    return { restored, updated, failed };
  } catch (error: any) {
    console.error("Error during restoration:", error.message);
    throw error;
  }
}

// Run restoration if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  restoreFloridaBars()
    .then(() => {
      console.log("\nRestoration process completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nRestoration failed:", error);
      process.exit(1);
    });
}

export default restoreFloridaBars;