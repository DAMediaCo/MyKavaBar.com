import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { sql } from 'drizzle-orm';

if (!process.env.GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY environment variable is required");
}

const client = new Client({});

async function findPlaceId(name: string, address: string) {
  try {
    console.log(`\nSearching for: ${name}`);
    console.log(`Address: ${address}`);

    // First try to find by name + address
    const response = await client.findPlaceFromText({
      params: {
        input: `${name} ${address}`,
        inputtype: "textquery",
        fields: ["place_id", "formatted_address", "name", "business_status"],
        key: process.env.GOOGLE_MAPS_API_KEY as string
      }
    });

    if (response.data.status === "OK" && response.data.candidates.length > 0) {
      const place = response.data.candidates[0];
      console.log(`Found match: ${place.formatted_address}`);
      
      // Verify it's in Florida
      const foundAddress = place.formatted_address?.toLowerCase() || "";
      if (!foundAddress.includes('florida') && !foundAddress.includes(', fl')) {
        console.log('❌ Found location is not in Florida');
        return null;
      }

      return {
        placeId: place.place_id,
        formattedAddress: place.formatted_address,
      };
    }

    // If not found, try just the name in Florida
    const fallbackResponse = await client.findPlaceFromText({
      params: {
        input: `${name} florida`,
        inputtype: "textquery",
        fields: ["place_id", "formatted_address", "name", "business_status"],
        key: process.env.GOOGLE_MAPS_API_KEY as string
      }
    });

    if (fallbackResponse.data.status === "OK" && fallbackResponse.data.candidates.length > 0) {
      const place = fallbackResponse.data.candidates[0];
      console.log(`Found potential match: ${place.formatted_address}`);
      
      // Verify it's in Florida
      const foundAddress = place.formatted_address?.toLowerCase() || "";
      if (!foundAddress.includes('florida') && !foundAddress.includes(', fl')) {
        console.log('❌ Found location is not in Florida');
        return null;
      }

      return {
        placeId: place.place_id,
        formattedAddress: place.formatted_address,
      };
    }

    console.log('❌ No matches found');
    return null;

  } catch (error: any) {
    console.error(`Error searching for ${name}:`, error.message);
    
    // Handle rate limiting
    if (error.response?.data?.status === "OVER_QUERY_LIMIT") {
      console.log("Rate limit hit, pausing for 60 seconds...");
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
    return null;
  }
}

async function updateMissingPlaceIds() {
  try {
    // Get all Florida kava bars without place_ids
    const bars = await db.execute<{ id: number, name: string, address: string }>(sql`
      SELECT id, name, address
      FROM kava_bars 
      WHERE (address ILIKE '%florida%' OR address ILIKE '%, fl%')
      AND (place_id IS NULL OR place_id = '')
      ORDER BY name ASC;
    `);

    console.log(`Found ${bars.rows.length} bars missing place_ids\n`);

    const results: {
      success: { id: number, name: string, placeId: string, address: string }[];
      failed: { id: number, name: string }[];
    } = {
      success: [],
      failed: []
    };

    for (const bar of bars.rows) {
      // Add delay between API calls
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result = await findPlaceId(bar.name, bar.address);
      
      if (result) {
        results.success.push({
          id: bar.id,
          name: bar.name,
          placeId: result.placeId,
          address: result.formattedAddress
        });
      } else {
        results.failed.push({
          id: bar.id,
          name: bar.name
        });
      }
    }

    // Print results
    console.log("\nResults:");
    console.log("✓ Successfully found place_ids for:");
    results.success.forEach(bar => {
      console.log(`${bar.name} - ${bar.placeId}`);
      console.log(`New address: ${bar.address}\n`);
    });

    console.log("\n❌ Could not find place_ids for:");
    results.failed.forEach(bar => {
      console.log(bar.name);
    });

    return results;

  } catch (error: any) {
    console.error("Error updating place_ids:", error.message);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  updateMissingPlaceIds()
    .then(() => {
      console.log("\nProcess completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nProcess failed:", error);
      process.exit(1);
    });
}

export default updateMissingPlaceIds;
