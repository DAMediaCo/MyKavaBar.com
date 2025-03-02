import { verifyKavaBarType } from "../services/bar-verification";

// List of place IDs to verify
const placeIds = [
  "ChIJD5b_c6Ht3ogRw4m-i2Cmzlw", // Island Root Kava Bar St Lucie West
  "ChIJ9ZxeZ0Lp3ogRkMBu1czoBRI", // Island Root Kava Bar Port Saint Lucie
  "ChIJPfHxPP3o3ogRBgEc7Z2jcsM", // Kava Kat
  "ChIJOwQXO1vv3ogR0tweAxEqo-Q", // Shaka Kava 772
  "ChIJ4SwTVb_p3ogR9r5mlFngB0s", // Kavasutra Kava Bar Port Saint Lucie
  "ChIJA_G85gnn3ogRo8cPmplYldI", // Kava Me Krazy
  "ChIJ1d_PewDn3ogRp_i8vmoIIoQ"  // Island Vibes Kava Bar - Jensen Beach
];

async function verifyBars() {
  console.log("Starting verification of multiple bars...");

  for (const placeId of placeIds) {
    try {
      console.log(`\nVerifying bar with place ID: ${placeId}`);
      const result = await verifyKavaBarType(placeId);
      console.log("Verification Result:", JSON.stringify(result, null, 2));
    } catch (error) {
      console.error(`Error verifying bar ${placeId}:`, error);
    }
  }
}

verifyBars();