import { Client } from "@googlemaps/google-maps-services-js";

// Test Google Maps Places API connectivity and data retrieval
async function testGoogleMapsAPI() {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error("GOOGLE_MAPS_API_KEY is required");
  }

  const client = new Client({});
  
  // Test location: Mad Hatter Kava Bar in Fort Lauderdale (known kava bar)
  const testLocation = {
    lat: 26.1194,
    lng: -80.1434
  };

  try {
    console.log("Testing Google Maps Places API connection...");
    console.log("Using test coordinates:", testLocation);

    const response = await client.placesNearby({
      params: {
        location: testLocation,
        radius: 1000, // 1km radius
        keyword: "kava bar",
        type: "establishment",
        key: process.env.GOOGLE_MAPS_API_KEY
      },
    });

    console.log("\nRaw API Response:");
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.status === "OK") {
      console.log("\nAPI connection successful!");
      console.log(`Found ${response.data.results.length} places near test location`);
      
      response.data.results.forEach((place, index) => {
        console.log(`\nPlace ${index + 1}:`);
        console.log(`Name: ${place.name}`);
        console.log(`Address: ${place.vicinity}`);
        console.log(`Place ID: ${place.place_id}`);
        console.log(`Types: ${place.types?.join(", ")}`);
        console.log(`Rating: ${place.rating}`);
      });
    } else {
      console.error("API returned non-OK status:", response.data.status);
    }
  } catch (error: any) {
    console.error("Error testing Google Maps API:");
    if (error.response) {
      console.error("API Error Response:", error.response.data);
    } else {
      console.error(error);
    }
    throw error;
  }
}

testGoogleMapsAPI()
  .then(() => {
    console.log("\nTest completed successfully");
  })
  .catch((error) => {
    console.error("Test failed:", error);
    process.exit(1);
  });
