import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { eq } from "drizzle-orm";
import { backupDatabase } from "../utils/backup-database";

const JENSEN_BEACH_LOCATION = {
  lat: 27.2545,
  lng: -80.2298
};

// More specific kava-related keywords
const SEARCH_KEYWORDS = [
  "kava bar jensen beach",
  "kava lounge jensen beach",
  "kava cafe jensen beach",
  "authentic kava bar",
  "traditional kava bar",
  "kava bar stuart",
  "kava bar port st lucie",
  "root bar jensen beach",
  "root lounge florida"
];

// Types to exclude from results
const EXCLUDED_TYPES = [
  "tobacco_store",
  "liquor_store",
  "convenience_store",
  "pharmacy",
  "gas_station",
  "grocery_store"
];

// Keywords that indicate it's not a kava bar
const NEGATIVE_KEYWORDS = [
  "smoke",
  "vape",
  "tobacco",
  "cbd",
  "kratom",
  "hookah",
  "disposable",
  "glass",
  "dispensary",
  "head shop"
];

// Keywords that suggest it's likely a kava bar
const POSITIVE_INDICATORS = [
  "kava",
  "traditional kava",
  "authentic kava",
  "kava lounge",
  "kava cafe",
  "root",        // Many kava bars use "root" in their names
  "island root", // Common kava bar naming pattern
  "roots",       // Variation of "root"
  "awa",         // Hawaiian word for kava
  "bula",        // Fijian kava greeting
  "nakamal",     // Traditional kava meeting place
  "shaka",       // Common in Florida kava bar names
  "ohana",       // Hawaiian word for family, used in kava bars
  "paradise"     // Common in tropical/island themed kava bars
];

// Common kava bar name patterns
const KAVA_BAR_PATTERNS = [
  /\b(kava|awa)\b/i,                    // Contains "kava" or "awa" as a word
  /\broot(s)?\b/i,                      // Contains "root" or "roots" as a word
  /\b(island|pacific|zen|mystic)\b.*(kava|root)/i,  // Common prefix patterns
  /\b(bula|nakamal)\b/i,               // Traditional kava terms
  /(lounge|bar|cafe).*(kava|root)/i,    // Common suffix patterns
  /(kava|root).*(lounge|bar|cafe)/i,    // Reverse suffix patterns
  /\b(shaka|ohana|paradise)\b.*kava/i,  // Florida-specific patterns
  /kava.*\b(shaka|ohana|paradise)\b/i   // Reverse Florida-specific patterns
];

const client = new Client({});

function matchesKavaBarPattern(name: string): boolean {
  const lowercaseName = name.toLowerCase();
  return KAVA_BAR_PATTERNS.some(pattern => pattern.test(lowercaseName));
}

async function isLikelyKavaBar(place: any): Promise<boolean> {
  // Check if any excluded types are present
  if (place.types?.some((type: string) => EXCLUDED_TYPES.includes(type))) {
    console.log(`Skipping ${place.name} - excluded business type: ${place.types?.join(", ")}`);
    return false;
  }

  // Check for negative keywords in the name
  const nameLower = place.name?.toLowerCase() || '';
  if (NEGATIVE_KEYWORDS.some(keyword => nameLower.includes(keyword))) {
    console.log(`Skipping ${place.name} - contains negative keyword`);
    return false;
  }

  // Check for positive indicators or kava bar naming patterns
  const hasPositiveIndicator = POSITIVE_INDICATORS.some(indicator => 
    nameLower.includes(indicator.toLowerCase())
  );

  const matchesPattern = matchesKavaBarPattern(place.name || '');

  if (!hasPositiveIndicator && !matchesPattern) {
    console.log(`Skipping ${place.name} - no kava bar indicators found`);
    return false;
  }

  return true;
}

async function fetchJensenBeachBars() {
  console.log("Starting Jensen Beach kava bars search...\n");
  let totalFound = 0;
  let totalAdded = 0;

  try {
    // Create backup before starting
    await backupDatabase('pre-operation');

    for (const keyword of SEARCH_KEYWORDS) {
      console.log(`\nSearching for: "${keyword}"`);

      // Add delay between searches to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const response = await client.placesNearby({
          params: {
            location: JENSEN_BEACH_LOCATION,
            radius: 20000, // Increased to 20km to cover more area
            keyword: keyword,
            key: process.env.GOOGLE_MAPS_API_KEY || '',
          },
        });

        const places = response.data.results;
        totalFound += places.length;

        console.log(`Found ${places.length} results for "${keyword}"`);

        for (const place of places) {
          // Additional validation to ensure it's a kava bar
          if (!await isLikelyKavaBar(place)) {
            continue;
          }

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
                verificationNotes: `Found in Jensen Beach area search for "${keyword}"`,
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
        continue;
      }
    }

    console.log("\nSearch Complete:");
    console.log(`Total places found: ${totalFound}`);
    console.log(`New places added: ${totalAdded}`);

    // Create final backup
    await backupDatabase('post-operation');

    return { totalFound, totalAdded };

  } catch (error: any) {
    console.error("Error during Jensen Beach search:", error.message);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  fetchJensenBeachBars()
    .then(() => {
      console.log("\nProcess completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nProcess failed:", error);
      process.exit(1);
    });
}

export { fetchJensenBeachBars };