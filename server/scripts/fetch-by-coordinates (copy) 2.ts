import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { eq, inArray } from "drizzle-orm";
import { backupDatabase } from "../utils/backup-database";

const client = new Client({});

async function fetchKavaBarsByCoordinates(lat: number, lng: number) {
    console.log("Starting kava bars search...\n");
    let totalFound = 0;
    let totalAdded = 0;

    try {
        await backupDatabase("pre-operation");

        const keyword = "kava bar"; // More specific than just "kava"
        const location = { lat, lng };

        console.log("Searching location: ", location);

        const response = await client.placesNearby({
            params: {
                location,
                radius: 40000,
                keyword,
                type: "bar", // Restrict to bars
                key: process.env.GOOGLE_MAPS_API_KEY || "",
            },
        });

        const places = response.data.results;
        totalFound = places.length;

        console.log(`Found ${places.length} results for "${keyword}"`);
        if (places.length === 0) {
            await backupDatabase("post-operation");
            return { totalFound, totalAdded };
        }

        // Filter out false positives
        const filteredPlaces = places.filter((place) => {
            const types = place.types || [];
            const name = (place.name || "").toLowerCase();

            // Exclude obvious non-kava bars
            const isRestaurant = types.includes("restaurant") || types.includes("meal_takeaway");
            const isStore = types.includes("store") || name.includes("smoke") || name.includes("vape");
            const isKavaRelated = name.includes("kava") || types.includes("bar");

            return isKavaRelated && !isRestaurant && !isStore;
        });

        console.log(`Filtered to ${filteredPlaces.length} potential kava bars`);

        if (filteredPlaces.length === 0) {
            await backupDatabase("post-operation");
            return { totalFound, totalAdded };
        }

        const placeIds = filteredPlaces.map((place) => place.place_id);
        const existingRecords = await db
            .select({
                placeId: kavaBars.placeId,
                phone: kavaBars.phone,
                hours: kavaBars.hours,
            })
            .from(kavaBars)
            .where(inArray(kavaBars.placeId, placeIds));

        const existingPlaceIds = new Set(existingRecords.map((row) => row.placeId));
        const existingDataMap = new Map(
            existingRecords.map((row) => [row.placeId, { phone: row.phone, hours: row.hours }])
        );

        const newPlaces = filteredPlaces.filter((place) => !existingPlaceIds.has(place.place_id));
        const existingPlaces = filteredPlaces.filter((place) => existingPlaceIds.has(place.place_id));

        // Fetch details for all filtered places
        const detailsPromises = filteredPlaces.map((place) =>
            client
                .placeDetails({
                    params: {
                        place_id: place.place_id,
                        fields: ["formatted_phone_number", "opening_hours", "types", "name"],
                        key: process.env.GOOGLE_MAPS_API_KEY || "",
                    },
                })
                .then((response) => ({ place, details: response.data.result }))
        );

        const detailsResults = await Promise.all(detailsPromises);

        // Insert new places
        for (const { place, details } of detailsResults.filter((r) => !existingPlaceIds.has(r.place.place_id))) {
            const formatted_phone = details.formatted_phone_number || null;
            const opening_hours = details.opening_hours || null;
            const now = new Date();
            const types = details.types || place.types || [];
            const name = (details.name || place.name || "").toLowerCase();

            // Double-check with details
            const isRestaurant = types.includes("restaurant") || types.includes("meal_takeaway");
            const isStore = types.includes("store") || name.includes("smoke") || name.includes("vape");
            if (isRestaurant || isStore) {
                console.log(`Skipping ${place.name} (likely not a kava bar)`);
                continue;
            }

            const verificationStatus = name.includes("kava") && types.includes("bar") ? "pending" : "needs_review";

            try {
                await db.insert(kavaBars).values({
                    name: place.name || "",
                    address: place.vicinity || "",
                    placeId: place.place_id,
                    location: JSON.stringify({
                        lat: place.geometry?.location?.lat || 0,
                        lng: place.geometry?.location?.lng || 0,
                    }),
                    rating: place.rating || 0,
                    businessStatus: place.business_status || "OPERATIONAL",
                    verificationStatus,
                    dataCompletenessScore: 0.5,
                    isVerifiedKavaBar: false,
                    verificationNotes: `Found by coordinates: ${lat}, ${lng}`,
                    createdAt: now,
                    lastVerified: now,
                    phone: formatted_phone,
                    hours: opening_hours,
                });
                totalAdded++;
                console.log(`✓ Added: ${place.name} (${verificationStatus})`);
            } catch (insertError) {
                console.error(`Error inserting ${place.name}:`, insertError.message);
            }
        }

        // Update existing places, adding missing data
        for (const { place, details } of detailsResults.filter((r) => existingPlaceIds.has(r.place.place_id))) {
            const now = new Date();
            const existingData = existingDataMap.get(place.place_id);
            const formatted_phone = details.formatted_phone_number || null;
            const opening_hours = details.opening_hours || null;

            try {
                await db
                    .update(kavaBars)
                    .set({
                        name: place.name || "",
                        address: place.vicinity || "",
                        location: JSON.stringify({
                            lat: place.geometry?.location?.lat || 0,
                            lng: place.geometry?.location?.lng || 0,
                        }),
                        rating: place.rating || 0,
                        businessStatus: place.business_status || "OPERATIONAL",
                        lastVerified: now,
                        phone: existingData?.phone == null ? formatted_phone : existingData.phone,
                        hours: existingData?.hours == null ? opening_hours : existingData.hours,
                    })
                    .where(eq(kavaBars.placeId, place.place_id));

                if (existingData?.phone == null || existingData?.hours == null) {
                    console.log(`✓ Updated ${place.name} with missing data`);
                } else {
                    console.log(`✓ Updated ${place.name}`);
                }
            } catch (updateError) {
                console.error(`Error updating ${place.name}:`, updateError.message);
            }
        }

        console.log("\nSearch Complete:");
        console.log(`Total places found: ${totalFound}`);
        console.log(`New places added: ${totalAdded}`);

        await backupDatabase("post-operation");
        return { totalFound, totalAdded };
    } catch (error) {
        console.error("Error during kava bar search:", error.message);
        await backupDatabase("post-operation");
        throw error;
    }
}

export { fetchKavaBarsByCoordinates };