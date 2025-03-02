import { Client } from "@googlemaps/google-maps-services-js";
import { db } from "@db";
import { kavaBars } from "@db/schema";
import { sql } from 'drizzle-orm';
import { eq, or, isNull } from "drizzle-orm";
import fs from 'fs/promises';
import path from 'path';

if (!process.env.GOOGLE_MAPS_API_KEY) {
  throw new Error("GOOGLE_MAPS_API_KEY environment variable is required");
}

const client = new Client({});

// Define batch size and rate limiting parameters
const BATCH_SIZE = 30;
const BASE_DELAY = 2000; // 2 seconds
const MAX_DELAY = 60000; // 60 seconds
const BATCH_DELAY = 10000; // 10 seconds between batches

// Progress tracking file
const progressFilePath = path.join(process.cwd(), 'verification_progress.json');

// Progress tracking interface
interface VerificationProgress {
  lastProcessedId: number;
  verified: number;
  failed: number;
  startTime: string;
}

// Default hours format
const DEFAULT_HOURS = {
  open_now: false,
  periods: [],
  weekday_text: [],
  hours_available: false
};

async function delay(attempt: number) {
  const backoff = Math.min(MAX_DELAY, BASE_DELAY * Math.pow(2, attempt));
  const jitter = Math.random() * 1000;
  await new Promise(resolve => setTimeout(resolve, backoff + jitter));
}

function parseTimeString(timeStr: string): string {
  // Handle various time formats
  const timeMatch = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
  if (!timeMatch) return '0000';

  let [, hours, minutes = '00', period] = timeMatch;
  let hour = parseInt(hours);

  // Convert to 24-hour format if AM/PM is specified
  if (period) {
    if (period.toUpperCase() === 'PM' && hour < 12) hour += 12;
    if (period.toUpperCase() === 'AM' && hour === 12) hour = 0;
  }

  return `${hour.toString().padStart(2, '0')}${minutes}`;
}

async function verifyKavaBar(bar: { id: number; name: string; placeId: string | null; address: string; location: any; hours: any }) {
  console.log(`\nVerifying: ${bar.name}`);
  console.log(`Current hours format:`, bar.hours);

  // If bar has legacy array format hours, convert to new format
  if (Array.isArray(bar.hours)) {
    try {
      const formattedHours = {
        open_now: true,
        periods: bar.hours.map((text: string, index: number) => {
          const [, timeRange] = text.split(': ');
          const [openStr, closeStr] = timeRange.split(/[–-]/).map(t => t.trim());

          return {
            close: { 
              day: index, 
              time: parseTimeString(closeStr)
            },
            open: { 
              day: index, 
              time: parseTimeString(openStr)
            }
          };
        }),
        weekday_text: bar.hours,
        hours_available: true
      };

      await db
        .update(kavaBars)
        .set({
          hours: formattedHours,
          lastVerified: new Date()
        })
        .where(eq(kavaBars.id, bar.id));

      console.log(`✓ Updated legacy hours format for: ${bar.name}`);
      return true;
    } catch (error) {
      console.error(`Error converting legacy hours for ${bar.name}:`, error);
      await db
        .update(kavaBars)
        .set({
          hours: DEFAULT_HOURS,
          lastVerified: new Date()
        })
        .where(eq(kavaBars.id, bar.id));
      return false;
    }
  }

  // Skip bars without placeId but set default hours
  if (!bar.placeId) {
    await db
      .update(kavaBars)
      .set({
        hours: DEFAULT_HOURS,
        lastVerified: new Date()
      })
      .where(eq(kavaBars.id, bar.id));

    console.log(`✓ Set default hours for: ${bar.name} (no place ID)`);
    return true;
  }

  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      console.log(`Fetching details for place ID: ${bar.placeId}`);
      const response = await client.placeDetails({
        params: {
          place_id: bar.placeId as string,
          fields: [
            "name",
            "formatted_address",
            "formatted_phone_number",
            "business_status",
            "geometry",
            "opening_hours",
            "rating"
          ],
          key: process.env.GOOGLE_MAPS_API_KEY as string
        },
      });

      if (response.data.status === "OK" && response.data.result) {
        const place = response.data.result;

        // Format hours data ensuring all required fields are present
        const formattedHours = place.opening_hours ? {
          open_now: place.opening_hours.open_now ?? false,
          periods: place.opening_hours.periods ?? [],
          weekday_text: place.opening_hours.weekday_text ?? [],
          hours_available: true
        } : DEFAULT_HOURS;

        console.log('Updating with hours format:', JSON.stringify(formattedHours, null, 2));

        await db
          .update(kavaBars)
          .set({
            hours: formattedHours,
            lastVerified: new Date()
          })
          .where(eq(kavaBars.id, bar.id));

        console.log(`✓ Updated hours format for: ${bar.name}`);
        return true;
      }

      await db
        .update(kavaBars)
        .set({
          hours: DEFAULT_HOURS,
          lastVerified: new Date()
        })
        .where(eq(kavaBars.id, bar.id));

      console.log(`✓ Set default hours for: ${bar.name} (no place details)`);
      return true;

    } catch (error: any) {
      console.error(`Error verifying ${bar.name}:`, error.message);

      if (error.response?.data?.status === "OVER_QUERY_LIMIT") {
        attempts++;
        if (attempts < maxAttempts) {
          console.log(`Rate limit hit, attempt ${attempts}/${maxAttempts}, backing off...`);
          await delay(attempts);
          continue;
        }
      }

      await db
        .update(kavaBars)
        .set({
          hours: DEFAULT_HOURS,
          lastVerified: new Date()
        })
        .where(eq(kavaBars.id, bar.id));

      console.log(`✓ Set default hours for: ${bar.name} (after error)`);
      return true;
    }
  }

  return false;
}

async function loadProgress(): Promise<VerificationProgress> {
  try {
    const data = await fs.readFile(progressFilePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return {
      lastProcessedId: 0,
      verified: 0,
      failed: 0,
      startTime: new Date().toISOString()
    };
  }
}

async function saveProgress(progress: VerificationProgress) {
  await fs.writeFile(progressFilePath, JSON.stringify(progress, null, 2));
}

async function verifyKavaBars() {
  console.log("Starting kava bar hours verification process...\n");

  try {
    // Start fresh with progress
    const progress: VerificationProgress = {
      lastProcessedId: 0,
      verified: 0,
      failed: 0,
      startTime: new Date().toISOString()
    };

    console.log("Starting fresh verification process");

    while (true) {
      // Query for bars that need hours verification
      const bars = await db
        .select({
          id: kavaBars.id,
          name: kavaBars.name,
          placeId: kavaBars.placeId,
          address: kavaBars.address,
          location: kavaBars.location,
          hours: kavaBars.hours
        })
        .from(kavaBars)
        .where(
          or(
            isNull(kavaBars.hours),
            sql`${kavaBars.hours}::text LIKE '[%]'`,
            sql`${kavaBars.hours} IS NOT NULL AND (${kavaBars.hours}::text NOT LIKE '%"hours_available"%')`
          )
        )
        .orderBy(kavaBars.id)
        .limit(BATCH_SIZE)
        .offset(progress.lastProcessedId);

      if (bars.length === 0) {
        console.log("\nAll bars have been processed!");
        break;
      }

      console.log(`\nProcessing batch of ${bars.length} bars...`);

      for (const bar of bars) {
        const success = await verifyKavaBar(bar);
        if (success) {
          progress.verified++;
        } else {
          progress.failed++;
        }

        progress.lastProcessedId = bar.id;
        await saveProgress(progress);

        // Add delay between API calls to avoid rate limiting
        await delay(0);
      }

      // Show progress after each batch
      const totalProcessed = progress.verified + progress.failed;
      console.log("\nCurrent Progress:");
      console.log(`✓ ${progress.verified} bars updated successfully`);
      console.log(`❌ ${progress.failed} bars failed update`);
      console.log(`Total processed: ${totalProcessed} bars`);

      // Add a longer delay between batches to avoid rate limiting
      await delay(2);
    }

  } catch (error: any) {
    console.error("Error during verification:", error.message);
    throw error;
  }
}

// Run verification if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyKavaBars()
    .then(() => {
      console.log("\nVerification process completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\nVerification failed:", error);
      process.exit(1);
    });
}

export default verifyKavaBars;