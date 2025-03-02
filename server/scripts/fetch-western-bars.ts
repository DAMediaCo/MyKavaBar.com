import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { sql } from 'drizzle-orm';
import { backupDatabase } from './backup-database';
import { createLogger } from './utils/logger';
import { createProgressTracker } from './utils/progress-tracker';

const logger = createLogger('fetch-western-bars');

if (!process.env.GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY environment variable is required");
}

const client = new Client({});

// City data by state
const STATE_CITIES = {
  ALABAMA: [
    { name: "Birmingham", location: { lat: 33.5207, lng: -86.8025 } },
    { name: "Montgomery", location: { lat: 32.3792, lng: -86.3077 } },
    { name: "Huntsville", location: { lat: 34.7304, lng: -86.5861 } },
    { name: "Mobile", location: { lat: 30.6954, lng: -88.0399 } },
    { name: "Tuscaloosa", location: { lat: 33.2098, lng: -87.5692 } },
    { name: "Auburn", location: { lat: 32.6099, lng: -85.4808 } },
    { name: "Dothan", location: { lat: 31.2232, lng: -85.3905 } },
    { name: "Hoover", location: { lat: 33.4054, lng: -86.8117 } },
    { name: "Gulf Shores", location: { lat: 30.2461, lng: -87.7008 } },
    { name: "Orange Beach", location: { lat: 30.2697, lng: -87.5863 } }
  ],
  FLORIDA: [
    { name: "Miami", location: { lat: 25.7617, lng: -80.1918 } },
    { name: "Orlando", location: { lat: 28.5383, lng: -81.3792 } },
    { name: "Tampa", location: { lat: 27.9506, lng: -82.4572 } },
    { name: "Jacksonville", location: { lat: 30.3322, lng: -81.6557 } },
    { name: "Fort Lauderdale", location: { lat: 26.1224, lng: -80.1373 } },
    { name: "St. Petersburg", location: { lat: 27.7676, lng: -82.6403 } },
    { name: "Clearwater", location: { lat: 27.9659, lng: -82.8001 } },
    { name: "Sarasota", location: { lat: 27.3364, lng: -82.5307 } },
    { name: "Fort Myers", location: { lat: 26.6406, lng: -81.8723 } },
    { name: "Tallahassee", location: { lat: 30.4383, lng: -84.2807 } }
  ]
} as const;

// More specific about kava-related businesses
const SEARCH_KEYWORDS = [
  "kava bar",
  "kava lounge",
  "kava house",
  "kratom cafe",
  "kava tea",
  "noble kava"
] as const;

async function isInState(address: string, state: string, city: string): Promise<boolean> {
  const addressLower = address.toLowerCase();
  const stateLower = state.toLowerCase();
  const cityLower = city.toLowerCase();

  // State indicators
  const stateIndicators = [
    `, ${state.slice(0, 2).toLowerCase()} `, 
    `, ${state.slice(0, 2).toLowerCase()},`, 
    `, ${stateLower}`, 
    ` ${stateLower},`,
    `, ${state.slice(0, 2).toLowerCase()}.`
  ];

  const hasStateIndicator = stateIndicators.some(indicator => 
    addressLower.includes(indicator));

  // Verify city is in the state
  const isStateCity = STATE_CITIES[state.toUpperCase() as keyof typeof STATE_CITIES]?.some(c => 
    addressLower.includes(c.name.toLowerCase())
  ) ?? false;

  return hasStateIndicator || 
         (addressLower.includes(cityLower) && isStateCity);
}

async function isLikelyKavaBar(place: any, state: string, cityName: string): Promise<boolean> {
  const name = place.name?.toLowerCase() || '';
  const address = place.vicinity?.toLowerCase() || '';

  // Skip permanently closed businesses
  if (place.business_status === 'CLOSED_PERMANENTLY') {
    return false;
  }

  // Must be in the specified state
  if (!await isInState(address, state, cityName)) {
    return false;
  }

  // Strong indicators of a kava bar
  const strongIndicators = [
    "kava bar",
    "noble kava",
    "kava lounge",
    "kava house",
    "kava cafe"
  ];

  if (strongIndicators.some(indicator => name.includes(indicator))) {
    return true;
  }

  // Skip obvious non-kava businesses
  const excludeKeywords = [
    "restaurant", "coffee shop", "cafe", "grill", "bistro",
    "grocery", "food court", "deli", "vape", "smoke shop",
    "tobacco", "cigar", "gas station", "convenience store",
    "cbd", "thc", "marijuana", "cannabis"
  ];

  if (excludeKeywords.some(keyword => name.includes(keyword))) {
    return false;
  }

  // Check business types
  if (place.types) {
    const validTypes = ["bar", "night_club", "cafe", "food"];
    const hasValidType = place.types.some((type: string) => 
      validTypes.includes(type.toLowerCase()));

    // If it mentions kava and has a valid business type
    if (name.includes("kava") && hasValidType) {
      return true;
    }
  }

  return false;
}

async function fetchStateData(state: string) {
  logger.info(`Starting ${state} kava bars search...`);

  // Validate state
  const stateKey = state.toUpperCase() as keyof typeof STATE_CITIES;
  const cities = STATE_CITIES[stateKey];

  if (!cities) {
    throw new Error(`No city data available for state: ${state}`);
  }

  // Create backup before starting
  logger.info("Creating pre-search backup...");
  await backupDatabase('pre-operation');

  // Initialize progress tracker
  const tracker = createProgressTracker(state);
  let progress = await tracker.load();

  logger.info(`Resuming from city ${progress.cityIndex}, keyword ${progress.keywordIndex}`);
  logger.info(`Previously found: ${progress.found}, added: ${progress.added}`);

  try {
    for (let i = progress.cityIndex; i < cities.length; i++) {
      const city = cities[i];
      logger.info(`\nSearching in ${city.name}...`);

      for (let j = i === progress.cityIndex ? progress.keywordIndex : 0; j < SEARCH_KEYWORDS.length; j++) {
        const keyword = SEARCH_KEYWORDS[j];

        // Update progress before each search
        progress.cityIndex = i;
        progress.keywordIndex = j;
        await tracker.save(progress);

        // Add delay between searches
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
          const response = await client.placesNearby({
            params: {
              location: city.location,
              radius: 25000, // 25km radius
              keyword: keyword,
              key: process.env.GOOGLE_MAPS_API_KEY as string,
            },
          });

          const places = response.data.results;
          progress.found += places.length;

          logger.info(`Found ${places.length} results for "${keyword}" in ${city.name}`);

          // Process places using database transaction
          await db.transaction(async (tx) => {
            for (const place of places) {
              try {
                // Skip if already processed or no place_id
                if (!place.place_id || progress.processedPlaceIds.includes(place.place_id)) {
                  continue;
                }

                progress.processedPlaceIds.push(place.place_id);

                // Skip if not a kava bar in the specified state
                if (!await isLikelyKavaBar(place, state, city.name)) {
                  continue;
                }

                // Check if place already exists within transaction
                const existing = await tx.select()
                  .from(kavaBars)
                  .where(sql`place_id = ${place.place_id}`)
                  .limit(1);

                if (existing.length === 0) {
                  const location = place.geometry?.location;
                  if (location) {
                    await tx.insert(kavaBars).values({
                      name: place.name || '',
                      address: place.vicinity || '',
                      placeId: place.place_id,
                      location: JSON.stringify({
                        lat: location.lat,
                        lng: location.lng
                      }),
                      rating: place.rating?.toString() || '0',
                      googleRating: place.rating?.toString() || '0',
                      businessStatus: place.business_status || 'OPERATIONAL',
                      verificationStatus: 'pending',
                      verificationNotes: `Found in ${state} search - Needs verification`,
                      isSponsored: false,
                      createdAt: new Date(),
                      lastVerified: new Date()
                    });
                    progress.added++;
                    logger.info(`✓ Added: ${place.name}`);
                  }
                } else {
                  logger.info(`- Skipped existing: ${place.name}`);
                }
              } catch (error: any) {
                // Log error but continue processing
                await tracker.addError(progress, {
                  city: city.name,
                  keyword: keyword,
                  error: error.message
                });
                logger.error(`Error processing place ${place.name}:`, error.message);
                continue;
              }
            }
          });

          // Save progress after each batch
          await tracker.save(progress);

        } catch (error: any) {
          // Log error and potentially retry
          await tracker.addError(progress, {
            city: city.name,
            keyword: keyword,
            error: error.message
          });
          logger.error(`Error searching for "${keyword}" in ${city.name}:`, error.message);

          if (error.response?.data?.status === "OVER_QUERY_LIMIT") {
            logger.info("Rate limit hit, pausing for 60 seconds...");
            await new Promise(resolve => setTimeout(resolve, 60000));
            j--; // Retry this keyword
          }
          continue;
        }
      }
    }

    // Create backup after completion
    logger.info("\nCreating post-search backup...");
    await backupDatabase('post-operation');

    return {
      found: progress.found,
      added: progress.added,
      errors: progress.errors
    };
  } catch (error: any) {
    logger.error("Fatal error:", error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const state = process.env.STATE_TO_PROCESS;
  if (!state) {
    logger.error("Please set STATE_TO_PROCESS environment variable");
    process.exit(1);
  }

  fetchStateData(state)
    .then((results) => {
      logger.info(`\n${state} search completed:`);
      logger.info(`Places found: ${results.found}`);
      logger.info(`Places added: ${results.added}`);
      if (results.errors.length > 0) {
        logger.info(`\nErrors encountered: ${results.errors.length}`);
      }
      process.exit(0);
    })
    .catch((error) => {
      logger.error(`\n${state} search failed:`, error);
      process.exit(1);
    });
}

export { fetchStateData };