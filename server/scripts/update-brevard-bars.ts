import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { sql } from 'drizzle-orm';

const googleMapsClient = new Client({});

async function updateBrevardBars() {
  console.log("Updating Brevard County kava bar locations and ratings...");

  try {
    // Get all Brevard County bars
    const bars = await db.execute(sql`
      SELECT * FROM kava_bars 
      WHERE (
        -- All possible city variations in Brevard County
        address ILIKE '%rockledge%'
        OR address ILIKE '%cocoa%'
        OR address ILIKE '%merritt island%'
        OR address ILIKE '%port st john%'
        OR address ILIKE '%titusville%'
        OR address ILIKE '%cape canaveral%'
        OR address ILIKE '%cocoa beach%'
        OR address ILIKE '%satellite beach%'
        OR address ILIKE '%viera%'
        OR address ILIKE '%suntree%'
        OR address ILIKE '%melbourne%'
        OR address ILIKE '%palm bay%'
        OR address ILIKE '%brevard%'
      )
      AND verification_status != 'not_kava_bar'
      ORDER BY CASE
        WHEN address ILIKE '%rockledge%' THEN 1
        WHEN address ILIKE '%cocoa%' THEN 2
        WHEN address ILIKE '%merritt island%' THEN 3
        ELSE 4
      END,
      name ASC;
    `);

    console.log(`Found ${bars.rows.length} bars to update`);

    for (const bar of bars.rows) {
      try {
        console.log(`\nProcessing ${bar.name} at ${bar.address}`);

        // Try different search strategies
        let placeDetails = null;
        let searchResponse = null;

        // Strategy 1: Use existing place_id if available
        if (bar.placeId) {
          try {
            const response = await googleMapsClient.placeDetails({
              params: {
                place_id: bar.placeId,
                fields: ['rating', 'geometry', 'formatted_address', 'business_status', 'opening_hours'],
                key: process.env.GOOGLE_MAPS_API_KEY!
              }
            });
            if (response.data.result) {
              placeDetails = response.data.result;
            }
          } catch (error) {
            console.log(`Error fetching details for existing place_id: ${error}`);
          }
        }

        // Strategy 2: Search by name and address if no place_id or details
        if (!placeDetails) {
          try {
            searchResponse = await googleMapsClient.findPlaceFromText({
              params: {
                input: `${bar.name} ${bar.address}`,
                inputtype: 'textquery',
                fields: ['place_id', 'formatted_address', 'geometry', 'rating', 'business_status', 'opening_hours'],
                key: process.env.GOOGLE_MAPS_API_KEY!
              }
            });

            if (searchResponse.data.candidates && searchResponse.data.candidates.length > 0) {
              const place = searchResponse.data.candidates[0];
              console.log('Found place:', place);

              // Get full details using place_id
              const detailsResponse = await googleMapsClient.placeDetails({
                params: {
                  place_id: place.place_id,
                  fields: ['rating', 'geometry', 'formatted_address', 'business_status', 'opening_hours'],
                  key: process.env.GOOGLE_MAPS_API_KEY!
                }
              });

              if (detailsResponse.data.result) {
                placeDetails = detailsResponse.data.result;
              }
            }
          } catch (error) {
            console.log(`Error searching for place: ${error}`);
          }
        }

        // Strategy 3: Fallback to geocoding if no place found
        if (!placeDetails) {
          try {
            console.log('Falling back to geocoding...');
            const geocodeResponse = await googleMapsClient.geocode({
              params: {
                address: bar.address,
                key: process.env.GOOGLE_MAPS_API_KEY!
              }
            });

            if (geocodeResponse.data.results.length > 0) {
              const result = geocodeResponse.data.results[0];
              placeDetails = {
                geometry: result.geometry,
                formatted_address: result.formatted_address
              };
            }
          } catch (error) {
            console.log(`Error geocoding address: ${error}`);
          }
        }

        // Update bar data if we found any details
        if (placeDetails) {
          try {
            const updateData: any = {
              location: placeDetails.geometry?.location ? JSON.stringify(placeDetails.geometry.location) : bar.location
            };

            if (placeDetails.rating) {
              updateData.rating = placeDetails.rating;
            }

            if (placeDetails.business_status) {
              updateData.businessStatus = placeDetails.business_status.toLowerCase();
            }

            if (placeDetails.opening_hours?.weekday_text) {
              updateData.hours = JSON.stringify(placeDetails.opening_hours.weekday_text);
            }

            // Only update place_id if it's different to avoid unique constraint violations
            if (searchResponse?.data.candidates?.[0]?.place_id && 
                searchResponse.data.candidates[0].place_id !== bar.placeId) {
              updateData.placeId = searchResponse.data.candidates[0].place_id;
            }

            await db.update(kavaBars)
              .set(updateData)
              .where(sql`${kavaBars.id} = ${bar.id}`);

            console.log(`Updated ${bar.name} with Google Maps data`);
            console.log('Place details:', {
              location: placeDetails.geometry?.location,
              rating: placeDetails.rating,
              business_status: placeDetails.business_status,
              opening_hours: placeDetails.opening_hours?.weekday_text
            });
          } catch (error) {
            if (error.message?.includes('unique constraint')) {
              console.log(`Skipping place_id update for ${bar.name} due to duplicate`);
            } else {
              console.error(`Error updating data for ${bar.name}:`, error);
            }
          }
        } else {
          console.log(`No place details found for ${bar.name}`);
        }

        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error processing ${bar.name}:`, error);
      }
    }

    console.log("\nFinished updating Brevard County bar locations and ratings");

    // Log the updated locations and ratings
    const updatedBars = await db.query.kavaBars.findMany({
      where: (bars, { or, like }) => or(
        like(bars.address, '%rockledge%'),
        like(bars.address, '%cocoa%'),
        like(bars.address, '%merritt island%'),
        like(bars.address, '%port st john%'),
        like(bars.address, '%titusville%'),
        like(bars.address, '%cape canaveral%'),
        like(bars.address, '%cocoa beach%'),
        like(bars.address, '%satellite beach%'),
        like(bars.address, '%viera%'),
        like(bars.address, '%suntree%'),
        like(bars.address, '%melbourne%'),
        like(bars.address, '%palm bay%'),
        like(bars.address, '%brevard%')
      )
    });

    console.log("\nVerifying updated data:");
    updatedBars.forEach(bar => {
      console.log(`${bar.name}: ${bar.address}`);
      console.log('Location:', typeof bar.location === 'string' ? JSON.parse(bar.location) : bar.location);
      console.log('Rating:', bar.rating);
      console.log('Place ID:', bar.placeId);
      console.log('Business Status:', bar.businessStatus);
      console.log('Hours:', bar.hours);
      console.log('---');
    });

  } catch (error) {
    console.error("Error updating Brevard County bar locations:", error);
  }
}

updateBrevardBars();