import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { eq, inArray } from "drizzle-orm";
import { backupDatabase } from "@utils/backup";

const client = new Client({});

const isValidKavaBar = (place) => {
  const name = place.name.toLowerCase();
  const types = place.types || [];

  const hasKavaKeyword = name.includes('kava') || types.some(t => t.includes('kava'));
  const negativeKeywords = ['restaurant', 'pizza', 'burger', 'sandwich', 'taco', 'vape', 'hookah', 'smoke'];

  const isFalsePositive = negativeKeywords.some(kw => name.includes(kw) && !name.includes('kava'));

  return hasKavaKeyword && !isFalsePositive;
};

async function fetchPlaceDetails(placeId, apiKey) {
  const detailsResp = await client.placeDetails({
    params: {
      place_id: placeId,
      fields: ["name", "opening_hours", "formatted_phone_number", "types"],
      key: apiKey,
    },
  });
  return detailsResp.data.result;
};

const fetchAndUpdateBars = async (lat, lng, apiKey) => {
  await backupDatabase("pre-operation");

  const keyword = "kava";
  const location = { lat, lng };
  const radius = 4000; // Adjust as necessary

  let totalFound = 0, totalAdded = 0, totalUpdated = 0;

  const response = await client.placesNearby({
    params: { keyword, location, radius, key: apiKey },
  });

  const places = response.data.results.filter(isValidKavaBar);
  totalFound = places.length;

  if (!totalFound) {
    console.log("No valid kava bars found.");
    await backupDatabase("post-operation");
    return { totalFound, totalAdded, totalUpdated };
  }

  const placeIds = places.map(p => p.place_id);

  // Fetch existing bars once, batch-wise
  const existingRecords = await db.select().from(kavaBars).where(inArray(kavaBars.placeId, placeIds));
  const existingPlaceMap = new Map(existingRecords.map(bar => [bar.placeId, bar]));

  for (const place of places) {
    const existing = existingPlaceMap.get(place.place_id);

    if (existing && existing.hours && existing.phone) {
      console.log(`Skipped complete entry: ${place.name}`);
      continue; // No details call for fully populated entries
    }

    const placeDetails = await fetchPlaceDetails(place.place_id, apiKey);
    const now = new Date();

    const barData = {
      name: placeDetails.name || place.name,
      placeId: place.place_id,
      location: JSON.stringify(place.geometry.location),
      rating: place.rating || 0,
      businessStatus: place.business_status || "OPERATIONAL",
      verificationStatus: "pending",
      dataCompletenessScore: 0.5,
      isVerifiedKavaBar: false,
      verificationNotes: `Found by coordinates: ${lat}, ${lng}`,
      createdAt: existing ? existing.createdAt : now,
      lastVerified: now,
      phone: placeDetails.formatted_phone_number || existing?.phone || null,
      hours: placeDetails.opening_hours?.weekday_text || existing?.hours || [],
    };

    if (existing) {
      await db.update(kavaBars).set(barData).where(eq(kavaBars.placeId, place.place_id));
      totalUpdated++;
      console.log(`Updated existing bar: ${place.name}`);
    } else {
      await db.insert(kavaBars).values(barData);
      totalAdded++;
      console.log(`Added new bar: ${place.name}`);
    }
  }

  await backupDatabase("post-operation");

  console.log("\nOperation completed efficiently:");
  console.log(`Found valid bars: ${totalFound}`);
  console.log(`New bars added: ${totalAdded}`);
  console.log(`Bars updated: ${totalUpdated}`);

  return { totalFound, totalAdded, totalUpdated };
};

export default fetchAndUpdateBars;