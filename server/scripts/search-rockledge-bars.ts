import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { sql } from 'drizzle-orm';

const googleMapsClient = new Client({});

async function searchRockledgeBars() {
  console.log("Searching for kava bars in Rockledge, FL...");

  try {
    // Multiple search queries to maximize coverage
    const searchQueries = [
      "kava bar in Rockledge, FL",
      "kava lounge Rockledge",
      "kratom bar Rockledge Florida",
      "kava tea Rockledge",
      "ethnobotanical bar Rockledge"
    ];

    const foundPlaces = new Set();

    for (const query of searchQueries) {
      console.log(`\nSearching for: "${query}"`);
      
      try {
        const response = await googleMapsClient.textSearch({
          params: {
            query,
            location: {
              lat: 28.3108,
              lng: -80.7351
            },
            radius: 8000, // 8km radius around Rockledge
            key: process.env.GOOGLE_MAPS_API_KEY!
          }
        });

        if (response.data.results.length > 0) {
          for (const place of response.data.results) {
            // Skip if we've already found this place
            if (foundPlaces.has(place.place_id)) continue;
            foundPlaces.add(place.place_id);

            console.log("\nPotential New Location:");
            console.log(`Name: ${place.name}`);
            console.log(`Address: ${place.formatted_address}`);
            console.log(`Place ID: ${place.place_id}`);
            console.log(`Rating: ${place.rating}`);
            console.log(`Types: ${place.types?.join(", ")}`);

            // Check if this place already exists in our database
            const existing = await db.query.kavaBars.findFirst({
              where: (kavaBars, { eq }) => eq(kavaBars.placeId, place.place_id)
            });

            if (!existing) {
              // Get more detailed place information
              const detailsResponse = await googleMapsClient.placeDetails({
                params: {
                  place_id: place.place_id,
                  fields: ['opening_hours', 'formatted_phone_number', 'website', 'business_status'],
                  key: process.env.GOOGLE_MAPS_API_KEY!
                }
              });

              const details = detailsResponse.data.result;

              // Insert new bar into database
              await db.insert(kavaBars).values({
                name: place.name,
                address: place.formatted_address,
                placeId: place.place_id,
                location: JSON.stringify(place.geometry.location),
                rating: place.rating || 0,
                businessStatus: place.business_status?.toLowerCase() || 'operational',
                phone: details.formatted_phone_number,
                website: details.website,
                hours: details.opening_hours?.weekday_text ? JSON.stringify(details.opening_hours.weekday_text) : null,
                verificationStatus: 'pending',
                createdAt: new Date()
              });

              console.log(`Added new bar: ${place.name}`);
            } else {
              console.log(`${place.name} already exists in database`);
            }
          }
        }

        // Add delay between searches
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        console.error(`Error searching for "${query}":`, error);
      }
    }

    // Log final database state for Rockledge area
    const bars = await db.query.kavaBars.findMany({
      where: (bars, { or, like }) => or(
        like(bars.address, '%rockledge%'),
        like(bars.address, '%cocoa%'),
        like(bars.address, '%merritt island%')
      )
    });

    console.log("\nCurrent Rockledge area bars in database:");
    bars.forEach(bar => {
      console.log(`${bar.name}: ${bar.address}`);
      console.log('Rating:', bar.rating);
      console.log('Status:', bar.businessStatus);
      console.log('---');
    });

  } catch (error) {
    console.error("Error searching for Rockledge bars:", error);
  }
}

// Run the search
searchRockledgeBars();
