import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { and, or, like, sql } from "drizzle-orm";

const googleMapsClient = new Client({});

async function updateMelbourneLocations() {
  console.log("Updating Melbourne area kava bar locations and ratings...");

  try {
    // Get all Melbourne area bars
    const bars = await db.execute(sql`
      SELECT * FROM kava_bars 
      WHERE (
        address ILIKE '%melbourne%' 
        OR address ILIKE '%palm bay%'
        OR address ILIKE '%satellite beach%'
        OR address ILIKE '%indian harbour%'
        OR address ILIKE '%rockledge%'
        OR address ILIKE '%cocoa%'
        OR address ILIKE '%merritt island%'
      )
    `);

    console.log(`Found ${bars.rows.length} bars to update`);

    for (const bar of bars.rows) {
      try {
        console.log(`\nProcessing ${bar.name} at ${bar.address}`);

        // If no placeId, try to find it first
        if (!bar.placeId) {
          console.log('No place ID found, searching for bar...');
          const searchResponse = await googleMapsClient.findPlaceFromText({
            params: {
              input: `${bar.name} ${bar.address}`,
              inputtype: 'textquery',
              fields: ['place_id', 'formatted_address', 'geometry', 'rating', 'business_status'],
              key: process.env.GOOGLE_MAPS_API_KEY!
            }
          });

          if (searchResponse.data.candidates && searchResponse.data.candidates.length > 0) {
            const place = searchResponse.data.candidates[0];
            console.log('Found place:', place);

            // Update the placeId
            await db.update(kavaBars)
              .set({
                placeId: place.place_id,
                location: JSON.stringify(place.geometry?.location),
              })
              .where(sql`${kavaBars.id} = ${bar.id}`);

            bar.placeId = place.place_id;
          } else {
            console.log('Could not find place, falling back to geocoding');
          }
        }

        // If we have a placeId now, get full details
        if (bar.placeId) {
          const placeResponse = await googleMapsClient.placeDetails({
            params: {
              place_id: bar.placeId,
              fields: ['rating', 'geometry', 'formatted_address', 'business_status'],
              key: process.env.GOOGLE_MAPS_API_KEY!
            }
          });

          if (placeResponse.data.result) {
            const place = placeResponse.data.result;
            console.log('Place details:', {
              location: place.geometry?.location,
              rating: place.rating,
              business_status: place.business_status
            });

            await db.update(kavaBars)
              .set({
                location: place.geometry?.location ? JSON.stringify(place.geometry.location) : bar.location,
                rating: place.rating || bar.rating,
                businessStatus: place.business_status?.toLowerCase() || bar.businessStatus
              })
              .where(sql`${kavaBars.id} = ${bar.id}`);

            console.log(`Updated ${bar.name} with Google Maps data`);
          }
        } else {
          // Fall back to geocoding if we still don't have place details
          const geocodeResponse = await googleMapsClient.geocode({
            params: {
              address: bar.address,
              key: process.env.GOOGLE_MAPS_API_KEY!,
              region: 'us'
            }
          });

          if (geocodeResponse.data.results.length > 0) {
            const location = geocodeResponse.data.results[0].geometry.location;
            console.log(`Found coordinates through geocoding for ${bar.name}:`, location);

            await db.update(kavaBars)
              .set({
                location: JSON.stringify(location)
              })
              .where(sql`${kavaBars.id} = ${bar.id}`);

            console.log(`Updated location for ${bar.name}`);
          } else {
            console.log(`No location found for ${bar.name}`);
          }
        }

        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error updating data for ${bar.name}:`, error);
      }
    }

    console.log("\nFinished updating Melbourne area bar locations and ratings");

    // Log the updated locations and ratings
    const updatedBars = await db.query.kavaBars.findMany({
      where: (bars, { or, like }) => or(
        like(bars.address, '%melbourne%'),
        like(bars.address, '%palm bay%'),
        like(bars.address, '%satellite beach%'),
        like(bars.address, '%indian harbour%'),
        like(bars.address, '%rockledge%'),
        like(bars.address, '%cocoa%'),
        like(bars.address, '%merritt island%')
      )
    });

    console.log("\nVerifying updated data:");
    updatedBars.forEach(bar => {
      console.log(`${bar.name}: ${bar.address}`);
      console.log('Location:', typeof bar.location === 'string' ? JSON.parse(bar.location) : bar.location);
      console.log('Rating:', bar.rating);
      console.log('Place ID:', bar.placeId);
      console.log('Business Status:', bar.businessStatus);
      console.log('---');
    });

  } catch (error) {
    console.error("Error updating Melbourne bar locations:", error);
  }
}

updateMelbourneLocations();