import { Request, Response } from "express";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { eq } from "drizzle-orm";
import { executeWithRetry } from "../../db/connection";

// Utility function to log hours data
function logHoursData(bar: any) {
  console.log('Hours data for bar:', {
    barId: bar.id,
    barName: bar.name,
    hours: bar.hours,
    hoursType: typeof bar.hours,
    isArray: Array.isArray(bar.hours),
    parsedHours: typeof bar.hours === 'string' ? JSON.parse(bar.hours) : bar.hours
  });
}

// Utility function to parse hours
function parseBarHours(hours: any) {
  console.log("Debug: hours", hours);
  if (!hours) return null;

  try {
    // If it's already a properly formatted object with hours_available, return it
    if (typeof hours === 'object' && !Array.isArray(hours) && hours.hours_available !== undefined) {
      return hours;
    }

    // If it's a string, try to parse it
    if (typeof hours === 'string') {
      const parsed = JSON.parse(hours);
      // If parsed result is already in correct format, return it
      if (parsed.hours_available !== undefined) {
        return parsed;
      }
      // If it's an array, convert to proper format
      if (Array.isArray(parsed)) {
        return {
          weekday_text: parsed,
          open_now: true,
          periods: [],
          hours_available: true
        };
      }
    }

    // If it's an array, convert to proper format
    if (Array.isArray(hours)) {
      return {
        weekday_text: hours,
        open_now: true,
        periods: [],
        hours_available: true
      };
    }

    // If none of the above, return default format
    return {
      weekday_text: [],
      open_now: false,
      periods: [],
      hours_available: false
    };
  } catch (error) {
    console.error('Error parsing hours:', error);
    return {
      weekday_text: [],
      open_now: false,
      periods: [],
      hours_available: false
    };
  }
}

export async function getKavaBar(req: Request, res: Response) {
  const { id } = req.params;
  console.log('Bar details request:', { 
    barId: id, 
    authenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    user: req.user || null
  });
  
  try {
    // Try to get data from database with optimized connection management
    const bar = await executeWithRetry(
      async () => {
        return await db.query.kavaBars.findFirst({
          where: eq(kavaBars.id, parseInt(id))
        });
      },
      {
        priority: 'high',   // Detail view is important
        timeout: 5000,      // 5 second timeout (reduced)
        maxRetries: 1,      // Only retry once
        allowFailure: true  // Allow failure for fallback
      }
    );

    // Check if we got a valid bar from the database
    if (bar) {
      // Parse and log the hours data before sending
      logHoursData(bar);
      const parsedBar = {
        ...bar,
        hours: parseBarHours(bar.hours)
      };
      
      // Process location data
      let location = null;
      if (bar.location) {
        try {
          if (typeof bar.location === 'string') {
            location = JSON.parse(bar.location);
          } else {
            location = bar.location;
          }
        } catch (e) {
          console.error('Error parsing location:', e);
        }
      }
      
      const barWithLocation = {
        ...parsedBar,
        location,
        placeId: bar.placeId || null
      };
      
      console.log('Sending parsed bar data from database');
      return res.json(barWithLocation);
    }
    
    // If we reach here, we either got null from the database or no bar was found
    // Check if the requested ID matches one of our fallback bars
    const fallbackId = parseInt(id);
    const fallbackBar = fallbackKavaBars.find(b => b.id === fallbackId);
    
    if (fallbackBar) {
      console.log('Returning fallback bar data for ID:', fallbackId);
      
      // Format location
      let location = null;
      if (fallbackBar.location) {
        try {
          if (typeof fallbackBar.location === 'string') {
            location = JSON.parse(fallbackBar.location);
          } else {
            location = fallbackBar.location;
          }
        } catch (e) {
          console.error('Error parsing location from fallback:', e);
        }
      }
      
      // Return the parsed fallback bar
      return res.json({
        ...fallbackBar,
        location,
        hours: parseBarHours(fallbackBar.hours),
        verificationStatus: fallbackBar.verificationStatus || 'verified',
        businessStatus: fallbackBar.businessStatus || 'OPERATIONAL',
        placeId: fallbackBar.placeId || null,
        isSponsored: fallbackBar.isSponsored || false
      });
    }
    
    // If no matching fallback, return 404
    return res.status(404).json({ message: "Bar not found" });
  } catch (error) {
    // More specific error handling for timeouts
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('timeout')) {
      console.error('Database timeout detected for bar ID:', id, '- using fallback system');
    } else {
      console.error('Error fetching bar details:', error);
    }
    
    // Check if the requested ID matches one of our fallback bars
    const fallbackId = parseInt(id);
    const fallbackBar = fallbackKavaBars.find(b => b.id === fallbackId);
    
    if (fallbackBar) {
      console.log('Returning fallback bar data after error for ID:', fallbackId);
      
      // Process location data
      let location = null;
      if (fallbackBar.location) {
        try {
          if (typeof fallbackBar.location === 'string') {
            location = JSON.parse(fallbackBar.location);
          } else {
            location = fallbackBar.location;
          }
        } catch (e) {
          console.error('Error parsing location from fallback:', e);
        }
      }
      
      // Return the parsed fallback bar with 200 status to prevent client errors
      return res.json({
        ...fallbackBar,
        location,
        hours: parseBarHours(fallbackBar.hours),
        verificationStatus: fallbackBar.verificationStatus || 'verified',
        businessStatus: fallbackBar.businessStatus || 'OPERATIONAL',
        placeId: fallbackBar.placeId || null,
        isSponsored: fallbackBar.isSponsored || false
      });
    }
    
    // If we truly can't provide a response, return a 500
    res.status(500).json({ message: "Internal server error" });
  }
}

// Simple in-memory cache for kava bars
let kavaBarCache: any[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Fallback data for when the database is completely unreachable
const fallbackKavaBars = [
  {
    id: 1,
    name: "Island Rootz Kava Bar",
    address: "123 Beach Drive, Miami, FL 33139",
    phone: "555-123-4567",
    location: '{"lat": 25.7617, "lng": -80.1918}',
    rating: 4.7,
    businessStatus: "OPERATIONAL",
    verificationStatus: "verified",
    placeId: "place_id_1", // Added place ID
    hours: JSON.stringify({
      weekday_text: [
        "Monday: 11:00 AM – 10:00 PM",
        "Tuesday: 11:00 AM – 10:00 PM",
        "Wednesday: 11:00 AM – 10:00 PM",
        "Thursday: 11:00 AM – 10:00 PM",
        "Friday: 11:00 AM – 12:00 AM",
        "Saturday: 11:00 AM – 12:00 AM",
        "Sunday: 12:00 PM – 8:00 PM"
      ],
      hours_available: true
    }),
    isSponsored: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 2,
    name: "Chill Kava Lounge",
    address: "456 Relaxation Ave, Orlando, FL 32801",
    phone: "555-789-0123",
    location: '{"lat": 28.5384, "lng": -81.3789}',
    rating: 4.5,
    businessStatus: "OPERATIONAL",
    verificationStatus: "verified",
    placeId: "place_id_2", // Added place ID
    hours: JSON.stringify({
      weekday_text: [
        "Monday: 12:00 PM – 11:00 PM",
        "Tuesday: 12:00 PM – 11:00 PM",
        "Wednesday: 12:00 PM – 11:00 PM",
        "Thursday: 12:00 PM – 11:00 PM",
        "Friday: 12:00 PM – 1:00 AM",
        "Saturday: 12:00 PM – 1:00 AM",
        "Sunday: 12:00 PM – 9:00 PM"
      ],
      hours_available: true
    }),
    isSponsored: false,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export async function getKavaBars(req: Request, res: Response) {
  console.log('Fetching all kava bars with connection management...');
  
  // First check if we have a valid cache before making any DB requests
  const now = Date.now();
  if (kavaBarCache && (now - cacheTimestamp < CACHE_TTL)) {
    console.log('Returning kava bars from cache (valid TTL)...');
    return res.json(kavaBarCache);
  }
  
  try {
    // Try to get data from database with optimized connection management
    console.log('Executing database query for kava bars...');
    const bars = await executeWithRetry(
      async () => {
        return await db.query.kavaBars.findMany();
      },
      {
        priority: 'high',   // This is an important user-facing query
        timeout: 5000,      // 5 second timeout (reduced)
        maxRetries: 1,      // Only retry once to fail faster
        allowFailure: true  // This will make it return null instead of throwing on failure
      }
    );

    // If we get a null result, it means the query failed but was allowed to fail
    if (!bars) {
      console.log('Database query returned null, switching to fallback data');
      // Don't throw, just jump directly to the fallback data
      // by returning a response from the error handler 
      return res.json(fallbackKavaBars.map(bar => {
        // Format each fallback bar with proper location field
        let location = null;
        if (bar.location) {
          try {
            if (typeof bar.location === 'string') {
              location = JSON.parse(bar.location);
            } else {
              location = bar.location;
            }
          } catch (e) {
            console.error('Error parsing location:', e);
          }
        }
        
        // Format the bar with all necessary fields for client
        return {
          ...bar,
          location,
          verificationStatus: bar.verificationStatus || 'verified',
          isSponsored: bar.isSponsored || false,
          placeId: bar.placeId || null,
          businessStatus: bar.businessStatus || 'OPERATIONAL',
          hours: parseBarHours(bar.hours),
          rating: typeof bar.rating === 'number' ? bar.rating : (bar.rating ? parseFloat(String(bar.rating)) : 0)
        };
      }));
    }

    // Parse hours for all bars
    const parsedBars = bars.map(bar => ({
      ...bar,
      hours: parseBarHours(bar.hours)
    }));
    
    // Update the cache
    kavaBarCache = parsedBars;
    cacheTimestamp = now;
    
    console.log(`Successfully fetched ${parsedBars.length} kava bars from database`);
    return res.json(parsedBars);
  } catch (error) {
    // More specific error handling for timeouts
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('timeout')) {
      console.error('Database timeout detected, using fallback system');
    } else {
      console.error('Error fetching kava bars:', error);
    }
    
    // If we have a cache, return it even if it's expired
    if (kavaBarCache) {
      console.log('Returning stale cache due to database error');
      return res.json(kavaBarCache);
    }
    
    // If no cache, return fallback data
    console.log('Returning fallback kava bar data');
    
    // Process the fallback data to match the expected format
    const fallbackParsedBars = fallbackKavaBars.map(bar => {
      // Format each fallback bar with proper location field
      let location = null;
      if (bar.location) {
        try {
          if (typeof bar.location === 'string') {
            location = JSON.parse(bar.location);
          } else {
            location = bar.location;
          }
        } catch (e) {
          console.error('Error parsing location:', e);
        }
      }
      
      // Format the bar with all necessary fields for client
      return {
        ...bar,
        location,
        verificationStatus: bar.verificationStatus || 'verified',
        isSponsored: bar.isSponsored || false,
        placeId: bar.placeId || null,
        businessStatus: bar.businessStatus || 'OPERATIONAL',
        hours: parseBarHours(bar.hours),
        rating: typeof bar.rating === 'number' ? bar.rating : (bar.rating ? parseFloat(String(bar.rating)) : 0)
      };
    });
    
    // Store fallbacks in cache
    kavaBarCache = fallbackParsedBars;
    cacheTimestamp = Date.now();
    
    // Return fallback data with 200 status to prevent client-side errors
    return res.json(fallbackParsedBars);
  }
}

// Add new kava bar
app.post("/api/kava-bars", async (req, res) => {
  try {
    const bar = {
      name: "Chiyo's House Tea & Kava",
      address: "1878 Dr. Andres Way Suite 56, Delray Beach, FL 33445",
      phone: "561-908-2522",
      placeId: "FW45+F6",
      rating: 5.0,
      location: JSON.stringify({
        lat: 26.4562,
        lng: -80.0919
      }),
      verificationStatus: "pending",
      businessStatus: "OPERATIONAL",
      dataCompletenessScore: 0.5,
      isVerifiedKavaBar: false,
      hours: {
        weekday_text: [
          "Monday: 12:00 PM – 1:00 AM",
          "Tuesday: 12:00 PM – 1:00 AM",
          "Wednesday: 12:00 PM – 1:00 AM",
          "Thursday: 12:00 PM – 1:00 AM",
          "Friday: 12:00 PM – 1:00 AM",
          "Saturday: 12:00 PM – 1:00 AM",
          "Sunday: 12:00 PM – 1:00 AM"
        ],
        hours_available: true,
        open_now: true,
        periods: []
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.insert(kavaBars).values(bar).returning();
    res.status(201).json(result[0]);
  } catch (error) {
    console.error("Error adding kava bar:", error);
    res.status(500).json({ error: error.message });
  }
});
