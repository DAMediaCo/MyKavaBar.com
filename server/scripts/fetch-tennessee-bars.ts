import { Client as GoogleMapsClient } from "@googlemaps/google-maps-services-js";
import fs from "fs/promises";
import path from "path";
import { setTimeout } from "timers/promises";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY environment variable not set");
}

const mapsClient = new GoogleMapsClient({});

interface ProgressData {
  processedPlaceIds: string[];
  processedNames: string[];
  completedAreas: string[];
  lastAreaIndex: number;
  lastPlaceIndex: number;
}

const tennesseeAreas = [
  { name: "Nashville", location: { lat: 36.1627, lng: -86.7816 }, radius: 50000 },
  { name: "Memphis", location: { lat: 35.1495, lng: -90.0490 }, radius: 50000 },
  { name: "Knoxville", location: { lat: 35.9606, lng: -83.9207 }, radius: 50000 },
  { name: "Chattanooga", location: { lat: 35.0456, lng: -85.3097 }, radius: 50000 },
  { name: "Clarksville", location: { lat: 36.5297, lng: -87.3594 }, radius: 40000 },
  { name: "Murfreesboro", location: { lat: 35.8456, lng: -86.3903 }, radius: 30000 }
];

const searchQueries = [
  "kava bar",
  "kava lounge",
  "kava cafe",
  "kratom bar",
  "kava tea",
  "kava coffee"
];

const progressFilePath = path.join(__dirname, "tennessee_progress.json");

let progress: ProgressData = {
  processedPlaceIds: [],
  processedNames: [],
  completedAreas: [],
  lastAreaIndex: 0,
  lastPlaceIndex: -1
};

async function initProgress() {
  try {
    await fs.access(progressFilePath);
    const data = await fs.readFile(progressFilePath, "utf-8");
    progress = JSON.parse(data);
  } catch {
    // Use default progress if file doesn't exist
  }
}

async function searchPlaces(query: string, location: { lat: number; lng: number }, radius: number) {
  try {
    const response = await mapsClient.placesNearby({
      params: {
        key: GOOGLE_MAPS_API_KEY!,
        location,
        radius,
        keyword: query,
        type: "establishment"
      }
    });

    return response.data.results;
  } catch (error) {
    console.error(`Error searching for "${query}" near ${location.lat},${location.lng}:`, error);
    return [];
  }
}

async function fetchTennesseeBars() {
  console.log("Starting Tennessee kava bar search...");
  await initProgress();

  for (let areaIndex = progress.lastAreaIndex; areaIndex < tennesseeAreas.length; areaIndex++) {
    const area = tennesseeAreas[areaIndex];
    console.log(`\nSearching in ${area.name}...`);

    if (progress.completedAreas.includes(area.name)) {
      console.log(`${area.name} already completed, skipping...`);
      continue;
    }

    for (const query of searchQueries) {
      console.log(`\nSearching for "${query}" in ${area.name}...`);

      try {
        const places = await searchPlaces(query, area.location, area.radius);
        console.log(`Found ${places.length} results for "${query}"`);

        for (const place of places) {
          if (place.place_id && !progress.processedPlaceIds.includes(place.place_id)) {
            progress.processedPlaceIds.push(place.place_id);
            if (place.name) {
              progress.processedNames.push(place.name.toLowerCase());
              console.log(`Added: ${place.name}`);
            }

            // Save progress after each new place
            await fs.writeFile(progressFilePath, JSON.stringify(progress, null, 2));
            await setTimeout(200); // Respect rate limits
          }
        }
      } catch (error) {
        console.error(`Error processing ${query} in ${area.name}:`, error);
      }
    }

    progress.completedAreas.push(area.name);
    progress.lastAreaIndex = areaIndex;
    progress.lastPlaceIndex = -1;
    await fs.writeFile(progressFilePath, JSON.stringify(progress, null, 2));
  }

  console.log("\nTennessee kava bar search completed!");
  return progress;
}

// Run the fetch process
fetchTennesseeBars().catch(console.error);

export { fetchTennesseeBars };