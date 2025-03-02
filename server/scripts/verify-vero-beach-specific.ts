import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { eq } from "drizzle-orm";
import { sql } from 'drizzle-orm';

if (!process.env.GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY environment variable is required");
}

const client = new Client({});

// Vero Beach center coordinates
const VERO_BEACH_LOCATION = {
  lat: 27.6386434,
  lng: -80.3972736
};

async function searchAndUpdateBar(bar: { id: number; name: string; }) {
  try {
    console.log(`\nSearching for ${bar.name} in Vero Beach...`);

    // Try text search first
    const textSearchResponse = await client.textSearch({
      params: {
        query: `${bar.name} Vero Beach`,
        location: VERO_BEACH_LOCATION,
        radius: 5000, // 5km radius
        key: process.env.GOOGLE_MAPS_API_KEY || ''
      }
    });

    const results = textSearchResponse.data.results;

    if (results.length > 0) {
      const match = results[0];
      console.log('Found potential match:');
      console.log(`Name: ${match.name}`);
      console.log(`Address: ${match.formatted_address}`);
      console.log(`Place ID: ${match.place_id}`);
      if (match.types) {
        console.log(`Types: ${match.types.join(', ')}`);
      }

      // Update the bar with new place ID
      await db.update(kavaBars)
        .set({
          placeId: match.place_id,
          address: match.formatted_address,
          location: match.geometry?.location,
          verificationStatus: 'pending'
        })
        .where(eq(kavaBars.id, bar.id));

      console.log(`✓ Updated ${bar.name} with new Place ID`);
      return true;
    }

    console.log(`❌ No matches found for ${bar.name}`);
    return false;

  } catch (error: any) {
    console.error(`Error searching for ${bar.name}:`, error.message);
    return false;
  }
}

async function updateVeroBeachBars() {
  console.log("Starting Vero Beach bars update...");

  try {
    // Get bars that failed verification
    const bars = await db
      .select({
        id: kavaBars.id,
        name: kavaBars.name,
        placeId: kavaBars.placeId,
        verificationStatus: kavaBars.verificationStatus
      })
      .from(kavaBars)
      .where(sql`address LIKE '%Vero Beach%' AND verification_status = 'not_found'`);

    console.log(`Found ${bars.length} bars to update`);

    for (const bar of bars) {
      await searchAndUpdateBar(bar);
      // Add delay between API calls
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log("\nUpdate complete!");

  } catch (error: any) {
    console.error("Error during update:", error.message);
    throw error;
  }
}

// Run the script
updateVeroBeachBars()
  .then(() => {
    console.log("\nUpdate process completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nUpdate failed:", error);
    process.exit(1);
  });