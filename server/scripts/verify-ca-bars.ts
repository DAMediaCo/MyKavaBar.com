import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { sql } from 'drizzle-orm';
import { verifyKavaBarType } from "../services/bar-verification";

if (!process.env.GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY environment variable is required");
}

async function verifyCABars() {
  console.log("Starting California kava bars verification...\n");

  try {
    // Get all CA kava bars
    const bars = await db.execute<{ id: number, name: string, address: string, place_id: string }>(sql`
      SELECT id, name, address, place_id 
      FROM kava_bars 
      WHERE address ILIKE '%california%' OR address ILIKE '%, ca%'
      ORDER BY name ASC;
    `);

    console.log(`Found ${bars.rows.length} bars to verify\n`);

    let verified = 0;
    let issues = 0;

    for (const bar of bars.rows) {
      if (!bar.place_id) {
        console.log(`❌ ${bar.name} - No place_id available`);
        issues++;
        continue;
      }

      // Add delay between API calls
      await new Promise(resolve => setTimeout(resolve, 2000));

      const result = await verifyKavaBarType(bar.place_id);
      
      if (result.success && result.isKavaBar) {
        console.log(`✓ ${bar.name} verified`);
        verified++;
      } else {
        console.log(`❌ ${bar.name} - ${result.verificationNotes || 'Verification failed'}`);
        issues++;
      }
    }

    console.log("\nVerification Complete:");
    console.log(`✓ ${verified} bars verified`);
    console.log(`❌ ${issues} bars with issues`);

    return { verified, issues };

  } catch (error: any) {
    console.error("Error during verification:", error.message);
    throw error;
  }
}

// Run verification if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyCABars()
    .then(() => {
      console.log("\nVerification process completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nVerification failed:", error);
      process.exit(1);
    });
}

export default verifyCABars;
