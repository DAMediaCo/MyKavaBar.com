import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { eq, inArray, or, isNull, sql } from "drizzle-orm";
import { backupDatabase } from "../utils/backup-database";

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
            fields: ["name", "opening_hours", "formatted_phone_number", "formatted_address", "geometry"],
            key: apiKey,
        },
    });
    return detailsResp.data.result;
}

function isIncomplete(field) {
    return !field || (Array.isArray(field) && field.length === 0) || (typeof field === 'string' && field.trim() === '') || field === '[]';
}

async function fetchKavaBarsByCoordinates(lat, lng) {
    console.log("Starting kava bars search...\n");
    await backupDatabase("pre-operation");
    const apiKey = process.env.GOOGLE_MAPS_API_KEY || "";

    const keyword = "kava";
    const location = { lat, lng };
    const radius = 40000;

    let totalFound = 0, totalAdded = 0, totalUpdated = 0;

    const response = await client.placesNearby({ params: { keyword, location, radius, key: apiKey } });
    const places = response.data.results.filter(isValidKavaBar);
    totalFound = places.length;

    const placeIds = places.map(p => p.place_id);
    const existingRecords = await db.select().from(kavaBars).where(inArray(kavaBars.placeId, placeIds));
    const existingPlaceMap = new Map(existingRecords.map(bar => [bar.placeId, bar]));

    for (const place of places) {
        const existing = existingPlaceMap.get(place.place_id);
        const placeDetails = await fetchPlaceDetails(place.place_id, apiKey);
        const now = new Date();

        const barData = {
            name: placeDetails.name || place.name,
            placeId: place.place_id,
            location: JSON.stringify(placeDetails.geometry?.location || place.geometry.location),
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
            address: placeDetails.formatted_address || existing?.address || place.vicinity || "",
        };

        if (existing) {
            await db.update(kavaBars).set(barData).where(eq(kavaBars.placeId, place.place_id));
            totalUpdated++;
            console.log(`✓ Updated existing bar: ${place.name}`);
        } else {
            await db.insert(kavaBars).values(barData);
            totalAdded++;
            console.log(`✓ Added new bar: ${place.name}`);
        }
    }

    // Explicitly update incomplete bars separately
    const incompleteBars = await db.select().from(kavaBars).where(
        or(
            isNull(kavaBars.hours), sql`${kavaBars.hours} = '[]'`,
            isNull(kavaBars.phone), sql`${kavaBars.phone} = ''`,
            isNull(kavaBars.address), sql`${kavaBars.address} = ''`
        )
    );

    for (const bar of incompleteBars) {
        const details = await fetchPlaceDetails(bar.placeId, apiKey);
        const now = new Date();

        const updatedData = {
            phone: isIncomplete(bar.phone) ? details.formatted_phone_number || null : bar.phone,
            hours: isIncomplete(bar.hours) ? details.opening_hours?.weekday_text || [] : bar.hours,
            address: isIncomplete(bar.address) ? details.formatted_address || bar.address : bar.address,
            location: details.geometry ? JSON.stringify(details.geometry.location) : bar.location,
            lastVerified: now,
        };

        await db.update(kavaBars).set(updatedData).where(eq(kavaBars.placeId, bar.placeId));
        totalUpdated++;
        console.log(`🔄 Explicitly updated incomplete bar: ${bar.name}`);
    }

    await backupDatabase("post-operation");

    console.log("\nSearch Complete:");
    console.log(`Total places found: ${totalFound}`);
    console.log(`New places added: ${totalAdded}`);
    console.log(`Existing bars explicitly updated: ${totalUpdated}`);

    return { totalFound, totalAdded, totalUpdated };
}

export { fetchKavaBarsByCoordinates };