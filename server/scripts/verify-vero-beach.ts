import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { eq } from "drizzle-orm";
import { sql } from 'drizzle-orm';

const client = new Client({});

async function verifyVeroBeachBar(bar: { id: number, name: string, placeId: string }) {
  console.log(`\nVerifying: ${bar.name}`);

  try {
    const response = await client.placeDetails({
      params: {
        place_id: bar.placeId,
        fields: [
          "name",
          "formatted_address",
          "formatted_phone_number",
          "business_status",
          "geometry",
          "opening_hours",
          "rating",
          "types"
        ],
        key: process.env.GOOGLE_MAPS_API_KEY as string
      },
    });

    if (response.data.status === "OK" && response.data.result) {
      const place = response.data.result;
      console.log(`Place details found:`, JSON.stringify(place, null, 2));

      // Format hours data
      const formattedHours = place.opening_hours ? {
        open_now: place.opening_hours.open_now,
        periods: place.opening_hours.periods,
        weekday_text: place.opening_hours.weekday_text,
        hours_available: true
      } : {
        open_now: false,
        periods: [],
        weekday_text: [],
        hours_available: false
      };

      // Update bar details in database
      await db
        .update(kavaBars)
        .set({
          verificationStatus: 'verified',
          businessStatus: place.business_status,
          lastVerified: new Date(),
          name: place.name,
          address: place.formatted_address,
          phone: place.formatted_phone_number,
          rating: place.rating?.toString(),
          hours: formattedHours,
          location: place.geometry?.location,
          dataCompletenessScore: place.opening_hours ? 0.8 : 0.5,
        })
        .where(eq(kavaBars.id, bar.id));

      console.log(`✓ Verified and updated: ${place.name}`);
      return true;
    }

    console.log(`❌ Place not found: ${bar.name}`);
    await updateBarStatus(bar.id, 'not_found');
    return false;

  } catch (error: any) {
    console.error(`Error verifying ${bar.name}:`, error.message);

    // Handle 404 errors specifically
    if (error.response?.status === 404 || error.response?.data?.status === "NOT_FOUND") {
      console.log(`❌ Bar not found in Google Maps: ${bar.name}`);
      await updateBarStatus(bar.id, 'not_found');
    } else {
      await updateBarStatus(bar.id, 'error');
    }
    return false;
  }
}

async function updateBarStatus(barId: number, status: string) {
  await db
    .update(kavaBars)
    .set({
      verificationStatus: status,
      lastVerified: new Date()
    })
    .where(eq(kavaBars.id, barId));
}

async function verifyVeroBeachBars() {
  console.log("Starting Vero Beach kava bars verification...");

  try {
    // Get all Vero Beach bars
    const bars = await db
      .select({
        id: kavaBars.id,
        name: kavaBars.name,
        placeId: kavaBars.placeId
      })
      .from(kavaBars)
      .where(sql`${kavaBars.address} LIKE '%Vero Beach%'`);

    console.log(`Found ${bars.length} Vero Beach bars to verify`);

    for (const bar of bars) {
      if (!bar.placeId) {
        console.log(`❌ No place ID for ${bar.name}, skipping verification`);
        await updateBarStatus(bar.id, 'missing_place_id');
        continue;
      }
      await verifyVeroBeachBar(bar);
      // Add delay between API calls
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log("\nVerification complete!");

  } catch (error: any) {
    console.error("Error during verification:", error.message);
    throw error;
  }
}

// Run verification
verifyVeroBeachBars()
  .then(() => {
    console.log("\nAll Vero Beach bars verified");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nVerification failed:", error);
    process.exit(1);
  });