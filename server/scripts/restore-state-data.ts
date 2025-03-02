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

async function getLocationFromAddress(address: string) {
  try {
    const response = await client.geocode({
      params: {
        address: address,
        key: process.env.GOOGLE_MAPS_API_KEY as string
      }
    });

    if (response.data.results && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return JSON.stringify({
        lat: location.lat,
        lng: location.lng
      });
    }
    return null;
  } catch (error: any) {
    console.error('Error geocoding address:', error.message);
    return null;
  }
}

async function restoreStateData(state: string, overwrite = false) {
  console.log(`Starting ${state} kava bars restoration...\n`);

  try {
    // Load progress file
    const progressFilePath = path.join(process.cwd(), `${state.toLowerCase()}_progress.json`);
    const data = await fs.readFile(progressFilePath, 'utf8');
    const progress = JSON.parse(data);
    const placeIds = progress.processedPlaceIds as string[];

    console.log(`Found ${placeIds.length} place IDs to restore from ${state}\n`);

    let restored = 0;
    let failed = 0;
    let skipped = 0;

    // Process in smaller batches to avoid timeouts
    const batchSize = 5;
    for (let i = 0; i < placeIds.length; i += batchSize) {
      const batch = placeIds.slice(i, i + batchSize);

      for (const placeId of batch) {
        try {
          // Check if bar exists and needs location data
          const existing = await db.select()
            .from(kavaBars)
            .where(sql`place_id = ${placeId}`)
            .limit(1);

          if (existing.length > 0) {
            // If location is missing, try to update it
            if (!existing[0].location) {
              const details = await getPlaceDetails(placeId);
              if (details?.geometry?.location) {
                await db.execute(sql`
                  UPDATE kava_bars 
                  SET location = ${JSON.stringify({
                    lat: details.geometry.location.lat,
                    lng: details.geometry.location.lng
                  })},
                  verification_notes = ${`Verified ${state} kava bar - location updated`}
                  WHERE place_id = ${placeId}
                `);
                console.log(`✓ Updated location for: ${existing[0].name}`);
              } else if (existing[0].address) {
                // Try geocoding the address as fallback
                const location = await getLocationFromAddress(existing[0].address);
                if (location) {
                  await db.execute(sql`
                    UPDATE kava_bars 
                    SET location = ${location},
                    verification_notes = ${`Verified ${state} kava bar - location geocoded`}
                    WHERE place_id = ${placeId}
                  `);
                  console.log(`✓ Geocoded location for: ${existing[0].name}`);
                }
              }
            }
            skipped++;
            continue;
          }

          // Add delay between API calls
          await new Promise(resolve => setTimeout(resolve, 2000));

          const details = await getPlaceDetails(placeId);
          if (!details) {
            failed++;
            continue;
          }

          // Format data according to schema
          const kavaBar = {
            name: details.name || '',
            address: details.formatted_address || '',
            phone: details.formatted_phone_number || '',
            placeId: placeId,
            rating: details.rating?.toString() || '0',
            location: JSON.stringify({
              lat: details.geometry?.location.lat || 0,
              lng: details.geometry?.location.lng || 0
            }),
            hours: details.opening_hours?.weekday_text || null,
            businessStatus: details.business_status || 'OPERATIONAL',
            isVerifiedKavaBar: true,
            verificationStatus: 'verified_kava_bar',
            verificationNotes: `Verified ${state} kava bar`,
            isSponsored: false,
            dataCompletenessScore: '0.8', // Convert to string to match schema
            createdAt: new Date(),
            lastVerified: new Date()
          };

          await db
            .insert(kavaBars)
            .values(kavaBar);

          console.log(`✓ Restored: ${kavaBar.name}`);
          restored++;

        } catch (error: any) {
          console.error(`Error restoring place ${placeId}:`, error.message);
          failed++;
        }
      }

      console.log(`\nProgress: ${restored} restored, ${failed} failed, ${skipped} skipped`);
      console.log(`Processed ${i + batch.length} of ${placeIds.length}`);
    }

    return { restored, failed, skipped };
  } catch (error: any) {
    console.error(`Error during ${state} restoration:`, error.message);
    throw error;
  }
}

// List of states to restore
const STATES = [
  'Florida',
  'Georgia',
  'South Carolina',
  'North Carolina',
  'Virginia',
  'Alabama',
  'Tennessee',
  'Nevada',
  'New Mexico',
  'Utah'
];

// Export the restore function
export default restoreStateData;