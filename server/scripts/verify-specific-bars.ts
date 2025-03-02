import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { eq, or } from "drizzle-orm";

if (!process.env.GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY environment variable is required");
}

const client = new Client({});

async function verifySpecificBar(bar: { id: number, name: string, placeId: string | null, address: string, location: any }) {
  if (!bar.placeId) {
    console.log(`❌ Cannot verify ${bar.name}: Missing place ID`);
    return false;
  }

  console.log(`\nVerifying: ${bar.name} at ${bar.address}`);

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

      // Check if business is operational
      if (place.business_status === "OPERATIONAL") {
        // Format hours data
        const formattedHours = place.opening_hours ? {
          open_now: place.opening_hours.open_now,
          periods: place.opening_hours.periods,
          weekday_text: place.opening_hours.weekday_text
        } : null;

        // Update bar details in database
        await db
          .update(kavaBars)
          .set({
            verificationStatus: 'verified_kava_bar',
            businessStatus: place.business_status,
            lastVerified: new Date(),
            name: place.name,
            address: place.formatted_address,
            phone: place.formatted_phone_number,
            rating: place.rating?.toString(),
            hours: formattedHours,
            location: place.geometry?.location,
          })
          .where(eq(kavaBars.id, bar.id));

        console.log(`✓ Verified and updated: ${place.name}`);
        return true;
      } else {
        console.log(`❌ Business is not operational: ${place.business_status}`);
        return false;
      }
    }

    console.log(`❌ Place not found: ${bar.name}`);
    return false;

  } catch (error: any) {
    console.error(`Error verifying ${bar.name}:`, error.message);
    return false;
  }
}

// Function to verify list of Jensen Beach bars
async function verifyJensenBars() {
  const barsToVerify = await db
    .select({
      id: kavaBars.id,
      name: kavaBars.name,
      placeId: kavaBars.placeId,
      address: kavaBars.address,
      location: kavaBars.location
    })
    .from(kavaBars)
    .where(
      or(
        eq(kavaBars.name, 'Island Root Jensen Beach'),
        eq(kavaBars.name, 'Euro Food'),
        eq(kavaBars.name, 'Island Vibes Kava Bar - Jensen Beach'),
        eq(kavaBars.name, 'Panama Kristi\'s Smoke Shop')
      )
    );

  console.log(`Found ${barsToVerify.length} bars to verify`);

  for (const bar of barsToVerify) {
    await verifySpecificBar(bar);
    // Add delay between API calls
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Function to verify list of Fort Pierce bars
export async function verifyFortPierceBars() {
  console.log("\nStarting Fort Pierce bars verification...");

  const barsToVerify = await db
    .select({
      id: kavaBars.id,
      name: kavaBars.name,
      placeId: kavaBars.placeId,
      address: kavaBars.address,
      location: kavaBars.location
    })
    .from(kavaBars)
    .where(
      or(
        eq(kavaBars.placeId, 'ChIJoe0TM_Lx3ogRO95yp6dgQJQ'), // Rooted Reef
        eq(kavaBars.placeId, 'ChIJr2HJSfzx3ogRdUpxYX6hQeA')  // Namaste Kava
      )
    );

  console.log(`Found ${barsToVerify.length} bars to verify`);

  for (const bar of barsToVerify) {
    await verifySpecificBar(bar);
    // Add delay between API calls
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

// Run verification if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyFortPierceBars()
    .then(() => {
      console.log("\nVerification completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nVerification failed:", error);
      process.exit(1);
    });
}

// Run verification for Jensen Beach and Fort Pierce bars
Promise.all([verifyJensenBars(), verifyFortPierceBars()])
  .then(() => {
    console.log("\nVerification completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nVerification failed:", error);
    process.exit(1);
  });