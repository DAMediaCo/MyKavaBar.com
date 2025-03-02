import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { eq } from "drizzle-orm";
import fs from "fs/promises";
import path from "path";

const googleMapsClient = new Client({});

interface PlaceDetails {
  name: string;
  formatted_address: string;
  formatted_phone_number?: string;
  business_status: string;
  types: string[];
  opening_hours?: {
    periods: Array<any>;
    weekday_text: string[];
  };
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
}

function calculateDataCompletenessScore(bar: any, placeDetails: PlaceDetails): string {
  let score = 0;
  const weights = {
    verificationStatus: 0.3,
    businessHours: 0.2,
    contactInfo: 0.2,
    photos: 0.15,
    location: 0.15
  };

  // Verification status check
  if (bar.verificationStatus === "verified_kava_bar") {
    score += weights.verificationStatus;
  }

  // Business hours completeness
  if (placeDetails.opening_hours?.periods?.length === 7) {
    score += weights.businessHours;
  } else if (placeDetails.opening_hours?.periods?.length) {
    score += (weights.businessHours * placeDetails.opening_hours.periods.length) / 7;
  }

  // Contact information completeness
  if (placeDetails.formatted_phone_number) {
    score += weights.contactInfo;
  }

  // Photos check
  const photos = bar.googlePhotos as any[];
  if (photos && photos.length > 0) {
    score += weights.photos * Math.min(photos.length / 5, 1); // Cap at 5 photos
  }

  // Location data completeness
  if (bar.location && typeof bar.location === 'object') {
    score += weights.location;
  }

  // Convert to string with 2 decimal places for PostgreSQL decimal type
  return score.toFixed(2);
}

export async function verifyKavaBarType(placeId: string) {
  try {
    const response = await googleMapsClient.placeDetails({
      params: {
        place_id: placeId,
        key: process.env.GOOGLE_MAPS_API_KEY!,
        fields: [
          "name",
          "formatted_address",
          "formatted_phone_number",
          "business_status",
          "types",
          "opening_hours",
          "geometry"
        ]
      }
    });

    const details = response.data.result as PlaceDetails;
    console.log("Place details:", {
      name: details.name,
      types: details.types,
      business_status: details.business_status
    });

    // Check if it's a kava bar based on name
    const kavaIndicators = ["kava", "kratom", "ethnobotanical", "herbal bar"];
    const isNameMatch = kavaIndicators.some(term => 
      details.name.toLowerCase().includes(term)
    );

    // Accept more generic business types since kava bars might be categorized differently
    const acceptableTypes = [
      "cafe",
      "bar",
      "food",
      "store",
      "point_of_interest",
      "establishment",
      "restaurant",
      "health"
    ];

    const isTypeMatch = details.types.some(type => 
      acceptableTypes.includes(type)
    );

    // If it has "kava" in the name and is a valid business type, consider it a kava bar
    const isKavaBar = isNameMatch && isTypeMatch;
    const verificationNotes = isKavaBar 
      ? `Confirmed kava bar based on name containing '${kavaIndicators.find(term => details.name.toLowerCase().includes(term))}' and business type`
      : `Not a kava bar. Business types: ${details.types.join(", ")}`;

    console.log("Verification result:", {
      isNameMatch,
      isTypeMatch,
      isKavaBar,
      verificationNotes
    });

    // Get the existing bar data
    const [existingBar] = await db
      .select()
      .from(kavaBars)
      .where(eq(kavaBars.placeId, placeId))
      .limit(1);

    if (existingBar) {
      const completenessScore = calculateDataCompletenessScore(existingBar, details);

      // Update the bar with verification results and completeness score
      await db.update(kavaBars)
        .set({
          verificationStatus: isKavaBar ? "verified_kava_bar" : "not_kava_bar",
          lastVerified: new Date(),
          businessStatus: details.business_status,
          isVerifiedKavaBar: isKavaBar,
          verificationNotes: verificationNotes,
          dataCompletenessScore: completenessScore,
          hours: details.opening_hours || null,
          phone: details.formatted_phone_number || existingBar.phone
        })
        .where(eq(kavaBars.placeId, placeId));
    }

    return {
      success: true,
      placeId,
      isKavaBar,
      name: details.name,
      status: details.business_status,
      verificationNotes
    };
  } catch (error) {
    console.error(`Error verifying place ${placeId}:`, error);
    return {
      success: false,
      placeId,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export async function verifyAllBars() {
  try {
    // Read the florida_progress.json file
    const progressFile = await fs.readFile(
      path.join(process.cwd(), "florida_progress.json"),
      "utf-8"
    );
    const progress = JSON.parse(progressFile);
    const placeIds = progress.processedPlaceIds as string[];

    const results = [];
    // Process bars in batches to avoid rate limiting
    const batchSize = 10;

    for (let i = 0; i < placeIds.length; i += batchSize) {
      const batch = placeIds.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(placeId => verifyKavaBarType(placeId))
      );
      results.push(...batchResults);

      // Add a small delay between batches
      if (i + batchSize < placeIds.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return {
      success: true,
      total: placeIds.length,
      verified: results.filter(r => r.status === "verified_kava_bar").length,
      failed: results.filter(r => r.success === false).length,
      results
    };
  } catch (error) {
    console.error("Error in batch verification:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}