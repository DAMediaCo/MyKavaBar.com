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
        await backupDatabase('pre-operation');

        // Add delay between searches to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));

        const keyword = "kava";

        try {
            const response = await client.placesNearby({
                params: {
                    location: {
                        lat: lat,
                        lng: lng
                    },
                    radius: 20000, // Increased to 20km to cover more area
                    keyword: keyword,
                    key: process.env.GOOGLE_MAPS_API_KEY || '',
                },
            });

            const places = response.data.results;
            totalFound += places.length;

            console.log(`Found ${places.length} results for "${keyword}"`);

            for (const place of places) {

                // Check if place already exists
                const existing = await db.query.kavaBars.findFirst({
                    where: eq(kavaBars.placeId, place.place_id)
                });

                if (!existing && place.geometry?.location) {
                    console.log(`Adding new bar: ${place.name}`);

                    const now = new Date();

                    try {
                        await db.insert(kavaBars).values({
                            name: place.name || '',
                            address: place.vicinity || '',
                            placeId: place.place_id,
                            location: JSON.stringify({
                                lat: place.geometry.location.lat,
                                lng: place.geometry.location.lng
                            }),
                            rating: (place.rating || 0).toString(),
                            googleRating: (place.rating || 0).toString(),
                            businessStatus: place.business_status || 'OPERATIONAL',
                            googleTypes: place.types || [],
                            verificationStatus: 'pending',
                            dataCompletenessScore: '0.5',
                            isVerifiedKavaBar: false,
                            verificationNotes: `Found by coordinates: ${lat}, ${lng}`,
                            createdAt: now,
                            lastVerified: now
                        });

                        totalAdded++;
                        console.log(`✓ Added: ${place.name}`);
                    } catch (insertError: any) {
                        console.error(`Error inserting ${place.name}:`, insertError.message);
                    }
                } else {
                    console.log(`Skipping existing bar: ${place.name}`);
                }
            }
        } catch (error: any) {
            console.error(`Error searching for "${keyword}":`, error.message);

            // Handle rate limiting
            if (error.response?.data?.status === "OVER_QUERY_LIMIT") {
                console.log("Rate limit hit, pausing for 60 seconds...");
                await new Promise(resolve => setTimeout(resolve, 60000));
            }
        }


        console.log("\nSearch Complete:");
        console.log(`Total places found: ${totalFound}`);
        console.log(`New places added: ${totalAdded}`);

        // Create final backup
        await backupDatabase('post-operation');

        return { totalFound, totalAdded };

    } catch (error: any) {
        console.error("Error during kava bar search:", error.message);
        throw error;
    }
}


export { fetchKavaBarsByCoordinates };
