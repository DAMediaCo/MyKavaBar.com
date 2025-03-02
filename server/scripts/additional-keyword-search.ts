import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { sql } from 'drizzle-orm';

if (!process.env.GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY environment variable is required");
}

const client = new Client({});

// Arizona search areas - comprehensive coverage of major cities
const searchAreas = [
  {
    name: "Phoenix Downtown",
    location: { lat: 33.4484, lng: -112.0740 },
    radius: 15000
  },
  {
    name: "Tempe - ASU Area",
    location: { lat: 33.4255, lng: -111.9400 },
    radius: 10000
  },
  {
    name: "Scottsdale - Old Town",
    location: { lat: 33.4942, lng: -111.9261 },
    radius: 8000
  },
  {
    name: "Scottsdale - North",
    location: { lat: 33.6189, lng: -111.9098 },
    radius: 12000
  },
  {
    name: "Mesa Downtown",
    location: { lat: 33.4152, lng: -111.8315 },
    radius: 10000
  },
  {
    name: "Tucson Downtown",
    location: { lat: 32.2226, lng: -110.9747 },
    radius: 12000
  },
  {
    name: "Tucson - University Area",
    location: { lat: 32.2316, lng: -110.9555 },
    radius: 8000
  },
  {
    name: "Flagstaff Downtown",
    location: { lat: 35.1983, lng: -111.6513 },
    radius: 10000
  },
  {
    name: "Flagstaff - NAU Area",
    location: { lat: 35.1866, lng: -111.6554 },
    radius: 5000
  },
  {
    name: "Sedona",
    location: { lat: 34.8697, lng: -111.7610 },
    radius: 12000
  },
  {
    name: "Gilbert",
    location: { lat: 33.3528, lng: -111.7890 },
    radius: 12000
  },
  {
    name: "Chandler",
    location: { lat: 33.3062, lng: -111.8413 },
    radius: 12000
  },
  {
    name: "Glendale",
    location: { lat: 33.5387, lng: -112.1860 },
    radius: 12000
  }
];

// Enhanced keyword list for kava establishments
const searchKeywords = [
  "kava",
  "kava bar",
  "kava lounge",
  "kratom",
  "ava",
  "awa",
  "yagona",
  "kava kava",
  "bula",
  "nakamal",
  "ethnobotanical",
  "ceremonial drink",
  "pacific beverage",
  "sakau",
  "grog shop",
  "root bar",
  "root drink"
];

function isKavaRelated(name: string, types: string[]): boolean {
  const nameLower = name.toLowerCase();

  // Enhanced false positive exclusions
  const exclusions = [
    "cava",
    "beauty",
    "sushi",
    "restaurant",
    "java",
    "lava",
    "nava",
    "cavalia",
    "kavari",
    "kavana",
    "savage",
    "savannah",
    "carwash",
    "kavkaz",
    "kavya"
  ];

  if (exclusions.some(term => nameLower.includes(term))) {
    return false;
  }

  // Positive indicators that strengthen likelihood of being a kava bar
  const strongIndicators = [
    "kava bar",
    "kava lounge",
    "bula",
    "nakamal",
    "root bar"
  ];

  const hasStrongIndicator = strongIndicators.some(indicator =>
    nameLower.includes(indicator.toLowerCase())
  );

  const keywordMatches = searchKeywords.some(keyword =>
    nameLower.includes(keyword.toLowerCase())
  );

  // Check for relevant business types
  const relevantTypes = [
    "cafe",
    "bar",
    "store",
    "establishment",
    "food",
    "point_of_interest"
  ];

  const typeMatch = types.some(type => relevantTypes.includes(type));

  // Return true if there's a strong indicator or both keyword match and type match
  return hasStrongIndicator || (keywordMatches && typeMatch);
}

async function searchLocation(area: typeof searchAreas[0]) {
  console.log(`\nSearching in ${area.name}`);
  console.log(`Location: ${area.location.lat}, ${area.location.lng}`);
  console.log(`Radius: ${area.radius} meters\n`);

  for (const keyword of searchKeywords) {
    try {
      const response = await client.placesNearby({
        params: {
          location: area.location,
          radius: area.radius,
          keyword: keyword,
          key: process.env.GOOGLE_MAPS_API_KEY as string
        }
      });

      if (response.data.results && response.data.results.length > 0) {
        console.log(`Found ${response.data.results.length} potential places for keyword "${keyword}"`);

        for (const place of response.data.results) {
          if (isKavaRelated(place.name || "", place.types || [])) {
            console.log(`\nPotential Kava Establishment Found:`);
            console.log(`Name: ${place.name}`);
            console.log(`Address: ${place.vicinity}`);
            console.log(`Types: ${place.types?.join(", ")}`);
            console.log(`Place ID: ${place.place_id}`);

            try {
              const details = await client.placeDetails({
                params: {
                  place_id: place.place_id,
                  fields: ["formatted_address", "formatted_phone_number", "website", "opening_hours", "business_status"],
                  key: process.env.GOOGLE_MAPS_API_KEY as string
                }
              });

              if (details.data.result) {
                console.log(`Full Address: ${details.data.result.formatted_address}`);
                if (details.data.result.formatted_phone_number) {
                  console.log(`Phone: ${details.data.result.formatted_phone_number}`);
                }
                if (details.data.result.website) {
                  console.log(`Website: ${details.data.result.website}`);
                }
                if (details.data.result.business_status) {
                  console.log(`Business Status: ${details.data.result.business_status}`);
                }
              }
            } catch (error) {
              console.error(`Error fetching details for ${place.name}:`, error);
            }
            console.log("----------------------------------------");
          }
        }
      }
    } catch (error: any) {
      console.error(`Error searching with keyword "${keyword}":`, error.message);
      if (error.response?.data?.status === "OVER_QUERY_LIMIT") {
        console.log("Rate limit hit, pausing for 60 seconds...");
        await new Promise(resolve => setTimeout(resolve, 60000));
      }
    }

    // Add delay between searches to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function searchArizona() {
  console.log("Starting expanded keyword search for Arizona kava establishments...\n");

  try {
    for (const area of searchAreas) {
      await searchLocation(area);
      // Add delay between areas
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log("\nSearch complete!");

  } catch (error: any) {
    console.error("Error during search:", error.message);
    throw error;
  }
}

// Run the search if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  searchArizona()
    .then(() => {
      console.log("\nSearch process completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nSearch failed:", error);
      process.exit(1);
    });
}