import { verifyKavaBarType } from "../services/bar-verification";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { eq } from "drizzle-orm";
import { verifyFortPierceBars } from "./verify-specific-bars";

// Fort Pierce area kava bars to verify
const barsToVerify = [
  {
    placeId: "ChIJoe0TM_Lx3ogRO95yp6dgQJQ",
    name: "Rooted Reef Kava Bar"
  },
  {
    placeId: "ChIJr2HJSfzx3ogRdUpxYX6hQeA",
    name: "Namaste Kava & Botanicals"
  }
];

async function verifyAndUpsertBar(placeId: string, name: string) {
  try {
    console.log(`\nVerifying bar with place ID: ${placeId}`);
    const result = await verifyKavaBarType(placeId);
    console.log("Verification Result:", JSON.stringify(result, null, 2));

    if (result.success && result.isKavaBar) {
      // Check if bar already exists
      const existingBar = await db
        .select()
        .from(kavaBars)
        .where(eq(kavaBars.placeId, placeId));

      if (existingBar.length === 0) {
        // Insert new bar
        await db.insert(kavaBars).values({
          name: result.name,
          placeId: placeId,
          verificationStatus: 'verified_kava_bar',
          businessStatus: result.status,
          verificationNotes: result.verificationNotes,
          address: '', // Will be updated by verify-specific-bars.ts
          isVerifiedKavaBar: true,
          createdAt: new Date()
        });
        console.log(`✓ Inserted new bar: ${result.name}`);
      } else {
        console.log(`ℹ Bar already exists: ${result.name}`);
      }
    } else {
      console.log(`❌ Verification failed for ${name}`);
    }
  } catch (error) {
    console.error(`Error verifying bar ${placeId}:`, error);
  }
}

async function verifyBars() {
  console.log("Starting verification of Fort Pierce kava bars...");

  for (const bar of barsToVerify) {
    await verifyAndUpsertBar(bar.placeId, bar.name);
  }

  // Run specific verification to get full details
  console.log("\nRunning detailed verification...");
  await verifyFortPierceBars();
}

// Run verification if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyBars()
    .then(() => {
      console.log("\nVerification process completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nVerification failed:", error);
      process.exit(1);
    });
}

export default verifyBars;