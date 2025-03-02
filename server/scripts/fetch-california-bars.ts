import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { sql } from 'drizzle-orm';

if (!process.env.GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY environment variable is required");
}

const client = new Client({});

const CALIFORNIA_CITIES = [
  { name: "Los Angeles", location: { lat: 34.0522, lng: -118.2437 } },
  { name: "San Francisco", location: { lat: 37.7749, lng: -122.4194 } },
  { name: "San Diego", location: { lat: 32.7157, lng: -117.1611 } },
  { name: "Sacramento", location: { lat: 38.5816, lng: -121.4944 } },
  { name: "San Jose", location: { lat: 37.3382, lng: -121.8863 } },
  { name: "Oakland", location: { lat: 37.8044, lng: -122.2712 } },
  { name: "Berkeley", location: { lat: 37.8716, lng: -122.2727 } },
  { name: "Santa Monica", location: { lat: 34.0195, lng: -118.4912 } },
  { name: "Venice", location: { lat: 33.9850, lng: -118.4695 } },
  { name: "Santa Barbara", location: { lat: 34.4208, lng: -119.6982 } }
];

const SEARCH_KEYWORDS = [
  "kava bar",
  "kava lounge",
  "kava cafe",
  "kava house",
  "kava",
  "kratom bar",
  "kratom lounge"
];

async function fetchCaliforniaKavaBars() {
  console.log("Starting California kava bars search...\n");
  let totalFound = 0;
  let totalAdded = 0;

  try {
    for (const city of CALIFORNIA_CITIES) {
      console.log(`\nSearching in ${city.name}...`);

      for (const keyword of SEARCH_KEYWORDS) {
        // Add delay between searches to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
          const response = await client.placesNearby({
            params: {
              location: city.location,
              radius: 25000, // 25km radius
              keyword: keyword,
              key: process.env.GOOGLE_MAPS_API_KEY || '',
            },
          });

          const places = response.data.results;
          totalFound += places.length;

          console.log(`Found ${places.length} results for "${keyword}"`);

          for (const place of places) {
            // Check if place already exists
            const existing = await db.query.kavaBars.findFirst({
              where: (kavaBars, { eq }) => eq(kavaBars.placeId, place.place_id)
            });

            if (!existing) {
              const location = place.geometry?.location;
              if (location) {
                await db.insert(kavaBars).values({
                  name: place.name,
                  address: place.vicinity,
                  placeId: place.place_id,
                  location: JSON.stringify({
                    lat: location.lat,
                    lng: location.lng
                  }),
                  rating: place.rating,
                  googleRating: place.rating,
                  businessStatus: place.business_status,
                  googleTypes: place.types,
                  verificationStatus: 'pending',
                  dataCompletenessScore: 0.5, // Initial score
                });
                totalAdded++;
                console.log(`✓ Added: ${place.name}`);
              }
            }
          }
        } catch (error: any) {
          console.error(`Error searching for "${keyword}" in ${city.name}:`, error.message);
          continue;
        }
      }
    }

    console.log("\nSearch Complete:");
    console.log(`Total places found: ${totalFound}`);
    console.log(`New places added: ${totalAdded}`);

    return { totalFound, totalAdded };

  } catch (error: any) {
    console.error("Error during California search:", error.message);
    throw error;
  }
}

// Run search if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchCaliforniaKavaBars()
    .then(() => {
      console.log("\nCalifornia search process completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nCalifornia search failed:", error);
      process.exit(1);
    });
}

export default fetchCaliforniaKavaBars;