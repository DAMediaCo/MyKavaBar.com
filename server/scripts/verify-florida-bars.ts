import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { sql } from 'drizzle-orm';

if (!process.env.GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY environment variable is required");
}

const client = new Client({});

async function verifyBar(placeId: string, barName: string) {
  try {
    const response = await client.placeDetails({
      params: {
        place_id: placeId,
        fields: [
          "name",
          "formatted_address",
          "formatted_phone_number",
          "business_status",
          "geometry",
          "opening_hours",
          "rating"
        ],
        key: process.env.GOOGLE_MAPS_API_KEY as string
      },
    });

    if (response.data.status === "OK" && response.data.result) {
      const place = response.data.result;
      
      // Check if business is still operational
      if (place.business_status !== "OPERATIONAL") {
        console.log(`❌ ${barName} (${placeId}) - No longer operational`);
        return false;
      }

      // Verify it's in Florida
      const address = place.formatted_address?.toLowerCase() || "";
      if (!address.includes('florida') && !address.includes(', fl')) {
        console.log(`❌ ${barName} (${placeId}) - Not in Florida: ${address}`);
        return false;
      }

      console.log(`✓ ${barName} verified - ${place.formatted_address}`);
      return true;
    } else {
      console.log(`❌ ${barName} (${placeId}) - Place not found`);
      return false;
    }
  } catch (error: any) {
    console.log(`❌ Error verifying ${barName}: ${error.message}`);
    
    // Handle rate limiting
    if (error.response?.data?.status === "OVER_QUERY_LIMIT") {
      console.log("Rate limit hit, pausing for 60 seconds...");
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
    return false;
  }
}

async function verifyFloridaBars() {
  console.log("Starting Florida kava bars verification...\n");

  try {
    // Get all Florida kava bars
    const bars = await db.execute<{ id: number, name: string, address: string, place_id: string }>(sql`
      SELECT id, name, address, place_id 
      FROM kava_bars 
      WHERE address ILIKE '%florida%' OR address ILIKE '%, fl%'
      ORDER BY name ASC;
    `);

    console.log(`Found ${bars.rows.length} bars to verify\n`);

    let verified = 0;
    let issues = 0;

    for (const bar of bars.rows) {
      // Skip if no place_id (shouldn't happen, but just in case)
      if (!bar.place_id) {
        console.log(`❌ ${bar.name} - No place_id available`);
        issues++;
        continue;
      }

      // Add delay between API calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));

      const isValid = await verifyBar(bar.place_id, bar.name);
      if (isValid) {
        verified++;
      } else {
        issues++;
      }
    }

    console.log("\nVerification Complete:");
    console.log(`✓ ${verified} bars verified`);
    console.log(`❌ ${issues} bars with issues`);

  } catch (error: any) {
    console.error("Error during verification:", error.message);
    throw error;
  }
}

// Run verification if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyFloridaBars()
    .then(() => {
      console.log("\nVerification process completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nVerification failed:", error);
      process.exit(1);
    });
}

export default verifyFloridaBars;
