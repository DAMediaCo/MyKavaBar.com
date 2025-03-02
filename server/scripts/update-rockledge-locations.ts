import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { sql } from 'drizzle-orm';

const googleMapsClient = new Client({});

async function updateRockledgeBars() {
  console.log("Updating Rockledge area kava bar locations and ratings...");

  try {
    const newBars = [
      {
        name: "Flamingo Kava & Acai Bar",
        address: "3695 Murrell Rd, Rockledge, FL 32955",
        placeId: "ChIJY0tmV04B3ogRi5JDK9jcvvI"
      },
      {
        name: "Pacha Kava Lounge",
        address: "910 Barton Blvd Unit 2, Rockledge, FL 32955",
        placeId: "ChIJMe-3j1YB3ogRuzTaFRnmo_k"
      },
      {
        name: "Calm Collective Kava Bar",
        address: "2025 Murrell Rd #160, Rockledge, FL 32955",
        placeId: "ChIJS6ZgMgAB3ogRBmdCoButTKQ"
      },
      {
        name: "The Health Bar Rockledge",
        address: "1854 US-1, Rockledge, FL 32955",
        placeId: "ChIJqQWq_-YD3ogRv2ej-Ruzxw4"
      }
    ];

    for (const bar of newBars) {
      try {
        // Check if bar already exists
        const existing = await db.query.kavaBars.findFirst({
          where: (kavaBar, { eq }) => eq(kavaBar.placeId, bar.placeId)
        });

        if (!existing) {
          // Get detailed place information
          const placeResponse = await googleMapsClient.placeDetails({
            params: {
              place_id: bar.placeId,
              fields: ['rating', 'geometry', 'formatted_address', 'business_status', 'opening_hours'],
              key: process.env.GOOGLE_MAPS_API_KEY!
            }
          });

          if (placeResponse.data.result) {
            const place = placeResponse.data.result;

            // Insert new bar
            await db.insert(kavaBars).values({
              name: bar.name,
              address: bar.address,
              placeId: bar.placeId,
              location: place.geometry?.location ? JSON.stringify(place.geometry.location) : null,
              rating: place.rating || 0,
              businessStatus: place.business_status?.toLowerCase() || 'operational',
              hours: place.opening_hours?.weekday_text ? JSON.stringify(place.opening_hours.weekday_text) : null,
              verificationStatus: 'pending',
              createdAt: new Date()
            });

            console.log(`Added ${bar.name} with Google Maps data:`, {
              rating: place.rating,
              location: place.geometry?.location,
              hours: place.opening_hours?.weekday_text
            });
          }
        } else {
          console.log(`${bar.name} already exists in database`);
        }

        // Add delay between API calls
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error processing ${bar.name}:`, error);
      }
    }


    // Get all Rockledge area bars
    const bars = await db.execute(sql`
      SELECT * FROM kava_bars 
      WHERE (
        address ILIKE '%rockledge%'
        OR address ILIKE '%cocoa%'
        OR address ILIKE '%merritt island%'
        OR address ILIKE '%port st john%'
        OR address ILIKE '%port saint john%'
        OR address ILIKE '%titusville%'
      )
      ORDER BY name ASC;
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
              fields: ['rating', 'geometry', 'formatted_address', 'business_status', 'opening_hours'],
              key: process.env.GOOGLE_MAPS_API_KEY!
            }
          });

          if (placeResponse.data.result) {
            const place = placeResponse.data.result;
            console.log('Place details:', {
              location: place.geometry?.location,
              rating: place.rating,
              business_status: place.business_status,
              opening_hours: place.opening_hours?.weekday_text
            });

            await db.update(kavaBars)
              .set({
                location: place.geometry?.location ? JSON.stringify(place.geometry.location) : bar.location,
                rating: place.rating || bar.rating,
                businessStatus: place.business_status?.toLowerCase() || bar.businessStatus,
                hours: place.opening_hours?.weekday_text ? JSON.stringify(place.opening_hours.weekday_text) : bar.hours
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

    console.log("\nFinished updating Rockledge area bar locations and ratings");

    // Log the updated locations and ratings
    const updatedBars = await db.query.kavaBars.findMany({
      where: (bars, { or, like }) => or(
        like(bars.address, '%rockledge%'),
        like(bars.address, '%cocoa%'),
        like(bars.address, '%merritt island%'),
        like(bars.address, '%port st john%'),
        like(bars.address, '%port saint john%'),
        like(bars.address, '%titusville%')
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
    console.error("Error updating Rockledge bar locations:", error);
  }
}

updateRockledgeBars();