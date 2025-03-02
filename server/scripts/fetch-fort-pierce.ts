import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";

const googleMapsClient = new Client({});

async function addFortPierceBars() {
  console.log("Adding Fort Pierce kava bars to database...");

  try {
    // Fort Pierce kava bars details
    const bars = [
      {
        name: "Rooted Reef Kava Bar",
        address: "208 S Depot Dr, Fort Pierce, FL 34950",
        placeId: "ChIJoe0TM_Lx3ogRO95yp6dgQJQ",
        verificationStatus: "pending"
      },
      {
        name: "Namaste Kava & Botanicals",
        address: "144 N Depot Dr, Fort Pierce, FL 34950",
        placeId: "ChIJr2HJSfzx3ogRdUpxYX6hQeA",
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

    console.log("Finished adding Fort Pierce kava bars");
  } catch (error) {
    console.error("Error adding Fort Pierce bars:", error);
  }
}

async function searchFortPierceBars() {
  console.log("Searching for kava bars in Fort Pierce...");

  try {
    // Search for kava bars in Fort Pierce
    const response = await googleMapsClient.textSearch({
      params: {
        query: "kava bar in Fort Pierce, FL",
        key: process.env.GOOGLE_MAPS_API_KEY!,
      }
    });

    console.log(`Found ${response.data.results.length} potential locations`);

    for (const place of response.data.results) {
      console.log("\nPotential Location:");
      console.log(`Name: ${place.name}`);
      console.log(`Address: ${place.formatted_address}`);
      console.log(`Place ID: ${place.place_id}`);
      console.log(`Types: ${place.types.join(", ")}`);
    }

  } catch (error) {
    console.error("Error searching for Fort Pierce bars:", error);
  }
}

addFortPierceBars();
searchFortPierceBars();