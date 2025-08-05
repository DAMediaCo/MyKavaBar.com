import { Client } from "@googlemaps/google-maps-services-js";
import * as fs from "fs";
import * as path from "path";
import { sleep } from "../utils/helpers";

// Get API key from environment variable
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY environment variable is required");
}

const googleMapsClient = new Client({});

// Major cities by state
const state_cities: Record<string, string[]> = {
  Florida: [
    "Miami",
    "Orlando",
    "Tampa",
    "Jacksonville",
    "Fort Lauderdale",
    "West Palm Beach",
    "Gainesville",
    "Tallahassee",
    "Pensacola",
  ],
  California: [
    "Los Angeles",
    "San Francisco",
    "San Diego",
    "Sacramento",
    "San Jose",
    "Oakland",
    "Long Beach",
    "Fresno",
  ],
  // Add more states and cities as needed
};

interface KavaBarDetails {
  name: string;
  address: string;
  phone: string;
  hours: string[] | null;
  place_id: string;
  lat: number;
  lng: number;
  rating: string;
  business_status: string;
}

export async function fetchKavaBars(state: string): Promise<KavaBarDetails[]> {
  if (!(state in state_cities)) {
    console.log(`No cities defined for state: ${state}`);
    return [];
  }

  const allKavaBars: KavaBarDetails[] = [];
  const cities = state_cities[state];

  for (const city of cities) {
    console.log(`\nSearching for kava bars in ${city}, ${state}...`);
    const kavaBars = await searchKavaBars(city, state);
    allKavaBars.push(...kavaBars);
    console.log(`Found ${kavaBars.length} kava bars in ${city}`);
  }

  return allKavaBars;
}

async function searchKavaBars(
  city: string,
  state: string,
): Promise<KavaBarDetails[]> {
  const query = `kava bar in ${city}, ${state}`;
  try {
    const placesResponse = await googleMapsClient.textSearch({
      params: {
        query,
        key: API_KEY,
      },
    });

    const results: KavaBarDetails[] = [];

    for (const place of placesResponse.data.results) {
      const placeId = place.place_id;
      // Get detailed information for each place
      const details = await googleMapsClient.placeDetails({
        params: {
          place_id: placeId,
          fields: [
            "name",
            "formatted_address",
            "formatted_phone_number",
            "opening_hours",
            "geometry",
            "rating",
            "business_status",
          ],
          key: API_KEY,
        },
      });

      const result = details.data.result;

      // Ensure hours are properly extracted and handled
      let hours = null;
      if (
        result.opening_hours &&
        Array.isArray(result.opening_hours.weekday_text)
      ) {
        hours = result.opening_hours.weekday_text;
      }

      const barDetails: KavaBarDetails = {
        name: result.name || "N/A",
        address: result.formatted_address || "N/A",
        phone: result.formatted_phone_number || "N/A",
        hours: hours,
        place_id: placeId,
        lat: result.geometry?.location.lat || 0,
        lng: result.geometry?.location.lng || 0,
        rating: result.rating?.toString() || "N/A",
        business_status: result.business_status || "N/A",
      };
      results.push(barDetails);

      // Respect API rate limits
      await sleep(2000);
    }

    return results;
  } catch (error) {
    console.error(`Error searching for kava bars in ${city}, ${state}:`, error);
    return [];
  }
}

// Run script if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const state = process.env.STATE_TO_PROCESS || "Florida";
  fetchKavaBars(state)
    .then((allKavaBars) => {
      // Save to CSV
      const csvFile = `kava_bars_${state.toLowerCase()}.csv`;
      const csvContent = [
        [
          "name",
          "address",
          "phone",
          "hours",
          "place_id",
          "lat",
          "lng",
          "rating",
          "business_status",
        ],
        ...allKavaBars.map((bar) => [
          bar.name,
          bar.address,
          bar.phone,
          bar.hours?.join(";") || "",
          bar.place_id,
          bar.lat,
          bar.lng,
          bar.rating,
          bar.business_status,
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n");

      fs.writeFileSync(csvFile, csvContent, "utf-8");
      console.log(
        `\nFound total of ${allKavaBars.length} kava bars in ${state}`,
      );
      console.log(`Data saved to ${csvFile}`);
    })
    .catch((error) => {
      console.error("\nScript failed:", error);
      process.exit(1);
    });
}

export default fetchKavaBars;
