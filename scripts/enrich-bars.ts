import { db } from "../db";
import { kavaBars } from "../db/schema";
import { isNull } from "drizzle-orm";
import { enrichBarData } from "../server/services/ai-enrichment";

async function main() {
  console.log("Starting batch bar enrichment...\n");

  const barsWithoutVibe = await db
    .select({
      id: kavaBars.id,
      name: kavaBars.name,
    })
    .from(kavaBars)
    .where(isNull(kavaBars.vibeText))
    .limit(10);

  if (barsWithoutVibe.length === 0) {
    console.log("All bars already have vibe data. Nothing to process.");
    process.exit(0);
  }

  console.log(`Found ${barsWithoutVibe.length} bars without vibe data.\n`);

  let successCount = 0;
  let failCount = 0;

  for (const bar of barsWithoutVibe) {
    process.stdout.write(`Processing "${bar.name}" (ID: ${bar.id})... `);
    
    try {
      await enrichBarData(bar.id);
      console.log("Success");
      successCount++;
    } catch (error: any) {
      console.log(`Failed: ${error.message}`);
      failCount++;
    }
  }

  console.log(`\nBatch complete: ${successCount} succeeded, ${failCount} failed.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
