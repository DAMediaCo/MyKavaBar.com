import { Client } from "@googlemaps/google-maps-services-js";

if (!process.env.GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY is required");
}

const client = new Client({});

// Test locations: Known kava bars in South Florida
const testLocations = [
  {
    name: "Mad Hatter Lounge area",
    coords: { lat: 26.1194, lng: -80.1434 }
  },
  {
    name: "Purple Lotus area",
    coords: { lat: 26.7153, lng: -80.0534 }
  }
];

async function verifyGoogleMapsAPI() {
  console.log("Starting Kava Bar Search API verification...");
  console.log("API Key status:", process.env.GOOGLE_MAPS_API_KEY ? "Present" : "Missing");

  for (const location of testLocations) {
    console.log(`\nSearching near ${location.name}`);
    console.log("Coordinates:", location.coords);

    try {
      // Try different keyword combinations to find kava bars
      const keywords = ["kava bar", "kava lounge", "kava cafe"];

      for (const keyword of keywords) {
        console.log(`\nSearching with keyword: "${keyword}"`);

        const response = await client.placesNearby({
          params: {
            location: location.coords,
            radius: 5000, // 5km radius
            keyword: keyword,
            type: "establishment", // Include both bars and cafes
            key: process.env.GOOGLE_MAPS_API_KEY
          }
        });

        // Log complete raw response for verification
        console.log("\nRaw Places API Response:");
        console.log(JSON.stringify(response.data, null, 2));

        if (response.data.status === "OK") {
          console.log(`\nFound ${response.data.results.length} potential places with keyword "${keyword}"`);

          response.data.results.forEach((place, index) => {
            console.log(`\nPlace ${index + 1}:`);
            console.log(`Name: ${place.name}`);
            console.log(`Address: ${place.vicinity}`);
            console.log(`Place ID: ${place.place_id}`);
            console.log(`Types: ${place.types?.join(", ")}`);
            console.log(`Rating: ${place.rating}`);
            console.log(`Business Status: ${place.business_status}`);
          });
        } else {
          console.log(`No results found for keyword "${keyword}"`);
        }
      }
    } catch (error: any) {
      console.error("\nError making Google Maps API request:", error.response?.data || error);
      throw error;
    }
  }
}

// Run the verification
verifyGoogleMapsAPI()
  .then(() => {
    console.log("\nVerification completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\nVerification failed:", error);
    process.exit(1);
  });