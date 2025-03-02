import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { sql } from 'drizzle-orm';

if (!process.env.GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY environment variable is required");
}

const client = new Client({});

async function verifyLocation(placeId: string, barName: string) {
  try {
    console.log(`\nVerifying location for: ${barName}`);

    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        fields: ["name", "geometry", "formatted_address"],
        key: process.env.GOOGLE_MAPS_API_KEY as string
      },
    });

    if (response.data.status === "OK" && response.data.result) {
      const place = response.data.result;

      if (!place.geometry?.location) {
        console.log(`❌ ${barName} - No location data available`);
        return null;
      }

      console.log(`Found coordinates for ${barName}:`);
      console.log(`Lat: ${place.geometry.location.lat}`);
      console.log(`Lng: ${place.geometry.location.lng}`);
      console.log(`Address: ${place.formatted_address}`);

      return {
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng
      };
    }

    console.log(`❌ ${barName} - Place not found`);
    return null;
  } catch (error: any) {
    console.error(`Error verifying ${barName}:`, error.message);
    return null;
  }
}

async function updateLocation(id: number, location: { lat: number, lng: number }) {
  try {
    // First, let's log the current location data
    const currentLocationResult = await db.execute(sql`
      SELECT id, name, location 
      FROM kava_bars 
      WHERE id = ${id}
    `);
    console.log('Current location data:', currentLocationResult.rows[0]);

    // Update with the new location
    await db.execute(sql`
      UPDATE kava_bars 
      SET location = jsonb_build_object('lat', ${location.lat}::numeric, 'lng', ${location.lng}::numeric)
      WHERE id = ${id}
    `);

    // Verify the update
    const updatedLocationResult = await db.execute(sql`
      SELECT id, name, location 
      FROM kava_bars 
      WHERE id = ${id}
    `);
    console.log('Updated location data:', updatedLocationResult.rows[0]);

    return true;
  } catch (error) {
    console.error('Error updating location:', error);
    return false;
  }
}

async function verifyAndUpdateLocations() {
  // Get both Twin Flames and Aura Kava bars
  const bars = await db.execute<{ id: number, name: string, address: string, place_id: string, location: any }>(sql`
    SELECT id, name, address, place_id, location
    FROM kava_bars 
    WHERE LOWER(name) LIKE '%twin%flame%' 
       OR name ILIKE '%Aura%Kava%'
    ORDER BY name ASC;
  `);

  console.log(`Found ${bars.rows.length} bars to verify`);
  console.log('Current locations:', bars.rows);

  for (const bar of bars.rows) {
    console.log(`\nProcessing: ${bar.name}`);
    console.log(`Current stored address: ${bar.address}`);
    console.log(`Current stored location:`, bar.location);

    const location = await verifyLocation(bar.place_id, bar.name);

    if (location) {
      console.log(`Updating location for ${bar.name}`);
      const success = await updateLocation(bar.id, location);
      if (success) {
        console.log(`✓ Successfully updated location for ${bar.name}`);
      }
    }

    // Add delay between API calls
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyAndUpdateLocations()
    .then(() => {
      console.log("\nLocation verification completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nVerification failed:", error);
      process.exit(1);
    });
}

export default verifyAndUpdateLocations;