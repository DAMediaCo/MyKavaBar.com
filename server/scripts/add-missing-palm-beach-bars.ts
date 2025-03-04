import { db } from '../../db';
import { kavaBars } from '../../db/schema';
import { sql } from 'drizzle-orm';

// Missing Palm Beach kava bars to add
const missingBars = [
  {
    name: "Herb'n Roots Exotic Tea Lounge",
    address: "307 E Atlantic Ave, Delray Beach, FL 33483",
    place_id: null, // To be determined with Google Maps search
    phone: "(561) 562-9273",
    business_status: "OPERATIONAL",
    rating: 5.0,
    verification_status: "pending",
    location: { lat: 26.4617, lng: -80.0671 }, // Approximate location in Delray Beach
    hours: null,
    data_completeness_score: 0.6,
    is_verified_kava_bar: false,
    verification_notes: "Added manually from user request, needs verification",
    last_verified: null,
    owner_id: null,
    is_sponsored: false,
    created_at: new Date()
  },
  {
    name: "Kavasutra Kava Bar Boca",
    address: "4640 N Federal Hwy, Boca Raton, FL 33431",
    place_id: null, // To be determined with Google Maps search
    phone: "(561) 931-6090",
    business_status: "OPERATIONAL",
    rating: 4.5,
    verification_status: "pending",
    location: { lat: 26.3895, lng: -80.0753 }, // Approximate location in Boca Raton
    hours: null,
    data_completeness_score: 0.7,
    is_verified_kava_bar: false,
    verification_notes: "Added manually from user request, part of Kavasutra chain",
    last_verified: null,
    owner_id: null,
    is_sponsored: false,
    created_at: new Date()
  }
];

/**
 * Add missing Palm Beach kava bars to the database
 */
async function addMissingPalmBeachBars() {
  console.log("Adding missing Palm Beach kava bars to the database...");
  
  // Check if bars already exist with similar names
  for (const bar of missingBars) {
    // Check for similar name
    const similarBars = await db.select({
      id: kavaBars.id,
      name: kavaBars.name,
      address: kavaBars.address
    })
    .from(kavaBars)
    .where(sql`LOWER(name) LIKE ${`%${bar.name.toLowerCase().substring(0, 10)}%`}`);
    
    if (similarBars.length > 0) {
      console.log(`WARNING: Found similar bars to "${bar.name}":`);
      for (const similarBar of similarBars) {
        console.log(`- ${similarBar.name} (ID: ${similarBar.id}) at ${similarBar.address}`);
      }
      
      console.log("Continuing with insertion anyway...");
    }
    
    try {
      // Insert the bar
      const result = await db.insert(kavaBars).values(bar);
      console.log(`Successfully added "${bar.name}" to the database.`);
    } catch (error) {
      console.error(`Error adding "${bar.name}" to the database:`, error);
    }
  }
}

// Run the script
addMissingPalmBeachBars()
  .then(() => {
    console.log("Operation complete!");
    process.exit(0);
  })
  .catch(error => {
    console.error("Script failed:", error);
    process.exit(1);
  });