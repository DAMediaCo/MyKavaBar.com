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
        // Create backup before starting
        await backupDatabase("pre-operation");

        const keyword = "kava";
        const location = { lat, lng };

        console.log("Searching location: ", location);

        // Fetch places from Google Maps API
        const response = await client.placesNearby({
            params: {
                location,
                radius: 40000, // 40km
                keyword,
                key: process.env.GOOGLE_MAPS_API_KEY || "",
            },
        });

        const places = response.data.results;
        totalFound = places.length;

        console.log(`Found ${places.length} results for "${keyword}"`);

        if (places.length === 0) {
            console.log("No places found.");
            await backupDatabase("post-operation");
            return { totalFound, totalAdded };
        }

        // Extract all place IDs
        const placeIds = places.map((place) => place.place_id);

        // Batch check for existing places in the database
        const existingRecords = await db
            .select({ placeId: kavaBars.placeId })
            .from(kavaBars)
            .where(inArray(kavaBars.placeId, placeIds));

        const existingPlaceIds = new Set(existingRecords.map((row) => row.placeId));

        // Separate new and existing places
        const newPlaces = places.filter((place) => !existingPlaceIds.has(place.place_id));
        const existingPlaces = places.filter((place) => existingPlaceIds.has(place.place_id));

        // Fetch details for new places concurrently
        const detailsPromises = newPlaces.map((place) =>
            client
                .placeDetails({
                    params: {
                        place_id: place.place_id,
                        fields: ["formatted_phone_number", "opening_hours"],
                        key: process.env.GOOGLE_MAPS_API_KEY || "",
                    },
                })
                .then((response) => ({ place, details: response.data.result }))
        );

        const detailsResults = await Promise.all(detailsPromises);

        // Insert new places
        for (const { place, details } of detailsResults) {
            const formatted_phone = details.formatted_phone_number || null;
            const opening_hours = details.opening_hours || null;
            const now = new Date();

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
                    verificationStatus: "pending",
                    dataCompletenessScore: 0.5,
                    isVerifiedKavaBar: false,
                    verificationNotes: `Found by coordinates: ${lat}, ${lng}`,
                    createdAt: now,
                    lastVerified: now,
                    phone: formatted_phone,
                    hours: opening_hours,
                });
                totalAdded++;
                console.log(`✓ Added: ${place.name}`);
            } catch (insertError) {
                console.error(`Error inserting ${place.name}:`, insertError.message);
            }
        }

        // Update existing places with available data only
        for (const place of existingPlaces) {
            const now = new Date();

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
                        // Do not update phone or hours
                    })
                    .where(eq(kavaBars.placeId, place.place_id));
                console.log(`✓ Updated: ${place.name}`);
            } catch (updateError) {
                console.error(`Error updating ${place.name}:`, updateError.message);
            }
        }

        console.log("\nSearch Complete:");
        console.log(`Total places found: ${totalFound}`);
        console.log(`New places added: ${totalAdded}`);

        // Create final backup
        await backupDatabase("post-operation");

        return { totalFound, totalAdded };
    } catch (error) {
        console.error("Error during kava bar search:", error.message);
        await backupDatabase("post-operation"); // Ensure backup even on failure
        throw error;
    }
}

export { fetchKavaBarsByCoordinates };