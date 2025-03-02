import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";

const googleMapsClient = new Client({});

async function addVeroBeachBars() {
  console.log("Adding Vero Beach kava bars to database...");

  try {
    // Known Vero Beach kava bars details
    const bars = [
      {
        name: "Island Root Kava Bar Vero Beach",
        address: "1880 Old Dixie Hwy, Vero Beach, FL 32960",
        placeId: "ChIJSbOuE4mH3ogRp0XiKyORYFE",
        verificationStatus: "pending"
      },
      {
        name: "Kava King - Vero Beach",
        address: "1904 14th Ave, Vero Beach, FL 32960",
        placeId: "ChIJH6YqpYeH3ogRq5fSLV3-3pE",
        verificationStatus: "pending"
      },
      {
        name: "Good Vibez Coffee Kava Kratom",
        address: "1185 Old Dixie Hwy a3, Vero Beach, FL 32960",
        placeId: "ChIJcx59hf9f3ogRivabXvgKgAk",
        verificationStatus: "pending"
      },
      {
        name: "Island Vibes Kava Bar - Vero Beach",
        address: "730 S U.S. 1, Vero Beach, FL 32962",
        placeId: "ChIJ88l9Bnhf3ogRfZx1NNzr3Ts",
        verificationStatus: "pending"
      }
    ];

    for (const bar of bars) {
      // Check if bar already exists
      const existing = await db.query.kavaBars.findFirst({
        where: (kavaBar, { eq }) => eq(kavaBar.placeId, bar.placeId)
      });

      if (!existing) {
        // Insert new bar
        await db.insert(kavaBars).values({
          name: bar.name,
          address: bar.address,
          placeId: bar.placeId,
          verificationStatus: bar.verificationStatus,
          createdAt: new Date()
        });
        console.log(`Added ${bar.name} to database`);
      } else {
        console.log(`${bar.name} already exists in database`);
      }
    }

    console.log("Finished adding Vero Beach kava bars");
  } catch (error) {
    console.error("Error adding Vero Beach bars:", error);
  }
}

async function searchVeroBeachBars() {
  console.log("Searching for kava bars in Vero Beach...");

  try {
    // Search for kava bars in Vero Beach
    const response = await googleMapsClient.textSearch({
      params: {
        query: "kava bar in Vero Beach, FL",
        key: process.env.GOOGLE_MAPS_API_KEY!,
      }
    });

    console.log(`Found ${response.data.results.length} potential locations`);

    for (const place of response.data.results) {
      console.log("\nPotential Location:");
      console.log(`Name: ${place.name}`);
      console.log(`Address: ${place.formatted_address}`);
      console.log(`Place ID: ${place.place_id}`);
      console.log(`Types: ${place.types?.join(", ")}`);
    }

  } catch (error) {
    console.error("Error searching for Vero Beach bars:", error);
  }
}

// Run both functions
addVeroBeachBars();
searchVeroBeachBars();