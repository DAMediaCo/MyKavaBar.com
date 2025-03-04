import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { eq } from "drizzle-orm";
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

        try {
            let location = {
                lat: lat,
                lng: lng,
            };

            console.log("Searching location: ", location);

            const response = await client.placesNearby({
                params: {
                    location: location,
                    radius: 20000, // Increased to 20km to cover more area
                    keyword: keyword,
                    key: process.env.GOOGLE_MAPS_API_KEY || "",
                },
            });

            const places = response.data.results;
            totalFound += places.length;

            console.log(`Found ${places.length} results for "${keyword}"`);

            for (const place of places) {
                // Check if place already exists
                const existing = await db.query.kavaBars.findFirst({
                    where: eq(kavaBars.placeId, place.place_id),
                });

                const now = new Date();

                if (place.geometry?.location) {
                    let details_request = await client.placeDetails({
                        params: {
                            place_id: place.place_id,
                            fields: ["formatted_phone_number", "opening_hours"],
                            key: process.env.GOOGLE_MAPS_API_KEY || "",
                        },
                    });

                    let details = details_request.data.result;

                    console.log("debug: place name: ", place.name);
                    console.log("debug: details: ", details);

                    if (!existing) {
                        console.log(`Adding new bar: ${place.name}`);
                        try {
                            await db.insert(kavaBars).values({
                                name: place.name || "",
                                address: place.vicinity || "",
                                placeId: place.place_id,
                                location: JSON.stringify({
                                    lat: place.geometry.location.lat,
                                    lng: place.geometry.location.lng,
                                }),
                                rating: (place.rating || 0).toString(),
                                googleRating: (place.rating || 0).toString(),
                                businessStatus:
                                    place.business_status || "OPERATIONAL",
                                googleTypes: place.types || [],
                                verificationStatus: "pending",
                                dataCompletenessScore: "0.5",
                                isVerifiedKavaBar: false,
                                verificationNotes: `Found by coordinates: ${lat}, ${lng}`,
                                createdAt: now,
                                lastVerified: now,
                                phone: details.formatted_phone_number || "",
                                hours: details.opening_hours || {},
                            });

                            totalAdded++;
                            console.log(`✓ Added: ${place.name}`);
                        } catch (insertError: any) {
                            console.error(
                                `Error inserting ${place.name}:`,
                                insertError.message,
                            );
                        }
                    } else {
                        console.log(`Updating existing bar: ${place.name}`);

                        db.update(kavaBars)
                            .set({
                                name: place.name || "",
                                address: place.vicinity || "",
                                location: JSON.stringify({
                                    lat: place.geometry.location.lat,
                                    lng: place.geometry.location.lng,
                                }),
                                rating: (place.rating || 0).toString(),
                                googleRating: (place.rating || 0).toString(),
                                businessStatus:
                                    place.business_status || "OPERATIONAL",
                                googleTypes: place.types || [],
                                verificationStatus: "pending",
                                dataCompletenessScore: "0.5",
                                verificationNotes: `Found by coordinates: ${lat}, ${lng}`,
                                lastVerified: now,
                                phone: details.formatted_phone_number || "",
                                hours: details.opening_hours || {},
                            })
                            .where(eq(kavaBars.placeId, place.place_id))
                            .execute();

                        console.log(
                            "debug: phone: ",
                            place.formatted_phone_number,
                        );
                        console.log("debug: hours: ", place.opening_hours);

                        console.log("debug: place: ", place);
                    }
                }
            }
        } catch (error: any) {
            console.error(`Error searching for "${keyword}":`, error.message);

            // Handle rate limiting
            /*
            if (error.response?.data?.status === "OVER_QUERY_LIMIT") {
                console.log("Rate limit hit, pausing for 60 seconds...");
                await new Promise((resolve) => setTimeout(resolve, 60000));
            }
            */
        }

        console.log("\nSearch Complete:");
        console.log(`Total places found: ${totalFound}`);
        console.log(`New places added: ${totalAdded}`);

        // Create final backup
        await backupDatabase("post-operation");

        return { totalFound, totalAdded };
    } catch (error: any) {
        console.error("Error during kava bar search:", error.message);
        throw error;
    }
}

export { fetchKavaBarsByCoordinates };
