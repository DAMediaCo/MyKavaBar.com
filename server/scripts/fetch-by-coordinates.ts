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
                // Check if place already exists by place ID
                const placeId = place.place_id;
                const existing = await db.query.kavaBars.findFirst({
                    where: (bars) => eq(bars.placeId, placeId),
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
                    const formatted_phone = details.formatted_phone_number || null;
                    const opening_hours = details.opening_hours || null;

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
                                rating: place.rating || 0,
                                businessStatus:
                                    place.business_status || "OPERATIONAL",
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
                        } catch (insertError: any) {
                            console.error(
                                `Error inserting ${place.name}:`,
                                insertError.message,
                            );
                        }
                    } else {
                        console.log(`Updating existing bar: ${place.name}`);

                        await db.update(kavaBars)
                            .set({
                                name: place.name || "",
                                address: place.vicinity || "",
                                location: JSON.stringify({
                                    lat: place.geometry.location.lat,
                                    lng: place.geometry.location.lng,
                                }),
                                rating: place.rating || 0,
                                businessStatus:
                                    place.business_status || "OPERATIONAL",
                                verificationStatus: "pending",
                                dataCompletenessScore: 0.5,
                                verificationNotes: `Found by coordinates: ${lat}, ${lng}`,
                                lastVerified: now,
                                phone: formatted_phone,
                                hours: opening_hours,
                            })
                            .where((bars) => eq(bars.placeId, placeId))
                            .execute();

                        console.log("debug: phone: ", formatted_phone);
                        console.log("debug: hours: ", opening_hours);
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
