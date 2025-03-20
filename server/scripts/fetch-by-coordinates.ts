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

        const keyword = "kava";
        const location = { lat, lng };

        console.log("Searching location: ", location);

        const response = await client.placesNearby({
            params: {
                location,
                radius: 40000,
                keyword,
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

        const placeIds = places.map((place) => place.place_id);
        const existingRecords = await db
            .select({ placeId: kavaBars.placeId })
            .from(kavaBars)
            .where(inArray(kavaBars.placeId, placeIds));
        const existingPlaceIds = new Set(existingRecords.map((row) => row.placeId));

        const newPlaces = places.filter((place) => !existingPlaceIds.has(place.place_id));
        const existingPlaces = places.filter((place) => existingPlaceIds.has(place.place_id));

        // Fetch details for ALL places (new and existing) concurrently
        const detailsPromises = places.map((place) =>
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
        for (const { place, details } of detailsResults.filter((r) => !existingPlaceIds.has(r.place.place_id))) {
            const formatted_phone = details.formatted_phone_number || null;
            const opening_hours = details.opening_hours || null;
            const now = new Date();

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
        }

        // Update existing places, including phone and hours
        for (const { place, details } of detailsResults.filter((r) => existingPlaceIds.has(r.place.place_id))) {
            const formatted_phone = details.formatted_phone_number || null;
            const opening_hours = details.opening_hours || null;
            const now = new Date();

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
                    phone: formatted_phone, // Now updated
                    hours: opening_hours,   // Now updated
                })
                .where(eq(kavaBars.placeId, place.place_id));
            console.log(`✓ Updated: ${place.name}`);
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