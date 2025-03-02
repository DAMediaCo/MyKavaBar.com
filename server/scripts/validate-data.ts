import { db } from "@db";
import { kavaBars } from "@db/schema";
import { sql } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import { backupDatabase } from './backup-database';

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalBars: number;
    verifiedBars: number;
    pendingBars: number;
    invalidLocations: number;
    duplicatePlaceIds: number;
    missingRequiredFields: number;
  };
}

export async function validateDatabaseData(): Promise<ValidationResult> {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    stats: {
      totalBars: 0,
      verifiedBars: 0,
      pendingBars: 0,
      invalidLocations: 0,
      duplicatePlaceIds: 0,
      missingRequiredFields: 0
    }
  };

  try {
    // Check for duplicate place IDs
    const duplicates = await db.execute<{ place_id: string, count: number }>(sql`
      SELECT place_id, COUNT(*) as count
      FROM kava_bars
      WHERE place_id IS NOT NULL
      GROUP BY place_id
      HAVING COUNT(*) > 1
    `);

    if (duplicates.rows.length > 0) {
      result.isValid = false;
      result.stats.duplicatePlaceIds = duplicates.rows.length;
      result.errors.push(`Found ${duplicates.rows.length} duplicate place IDs`);

      // Log the duplicates for investigation
      for (const dup of duplicates.rows) {
        result.errors.push(`Place ID ${dup.place_id} appears ${dup.count} times`);
      }
    }

    // Get general statistics
    const stats = await db.execute<{ 
      total: number,
      verified: number,
      pending: number 
    }>(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN verification_status = 'verified_kava_bar' THEN 1 END) as verified,
        COUNT(CASE WHEN verification_status = 'pending' THEN 1 END) as pending
      FROM kava_bars
    `);

    result.stats.totalBars = stats.rows[0].total;
    result.stats.verifiedBars = stats.rows[0].verified;
    result.stats.pendingBars = stats.rows[0].pending;

    // Check for invalid locations with more precise JSON validation
    const invalidLocations = await db.execute<{ id: number, name: string }>(sql`
      SELECT id, name
      FROM kava_bars
      WHERE location IS NULL 
         OR location::text = ''
         OR location::text = '{}'
         OR NOT (
           location::jsonb ? 'lat' 
           AND location::jsonb ? 'lng'
           AND (location->>'lat')::numeric IS NOT NULL
           AND (location->>'lng')::numeric IS NOT NULL
           AND (location->>'lat')::numeric BETWEEN -90 AND 90
           AND (location->>'lng')::numeric BETWEEN -180 AND 180
         )
    `);

    if (invalidLocations.rows.length > 0) {
      result.warnings.push(`Found ${invalidLocations.rows.length} bars with invalid or missing location data`);
      result.stats.invalidLocations = invalidLocations.rows.length;

      // Add detailed information about invalid locations
      const invalidBars = invalidLocations.rows.map(bar => `- ${bar.name} (ID: ${bar.id})`);
      result.warnings.push("Invalid location bars:\n" + invalidBars.join("\n"));
    }

    // Check for missing required fields
    const missingFields = await db.execute<{ id: number, name: string }>(sql`
      SELECT id, name
      FROM kava_bars
      WHERE name IS NULL 
        OR name = ''
        OR address IS NULL 
        OR address = ''
        OR (place_id IS NULL AND verification_status = 'verified_kava_bar')
    `);

    if (missingFields.rows.length > 0) {
      result.isValid = false;
      result.stats.missingRequiredFields = missingFields.rows.length;
      result.errors.push(`Found ${missingFields.rows.length} bars with missing required fields`);
    }

    // Create a backup if any issues were found
    if (!result.isValid || result.warnings.length > 0) {
      console.log("Issues found during validation, creating backup...");
      await backupDatabase();
    }

    return result;
  } catch (error: any) {
    result.isValid = false;
    result.errors.push(`Validation failed: ${error.message}`);
    return result;
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  validateDatabaseData()
    .then((result) => {
      console.log("\nDatabase Validation Results:");
      console.log("==========================");
      console.log(`Status: ${result.isValid ? 'VALID' : 'INVALID'}`);

      if (result.errors.length > 0) {
        console.log("\nErrors:");
        result.errors.forEach(err => console.log(`- ${err}`));
      }

      if (result.warnings.length > 0) {
        console.log("\nWarnings:");
        result.warnings.forEach(warn => console.log(`- ${warn}`));
      }

      console.log("\nStatistics:");
      console.log("-----------");
      Object.entries(result.stats).forEach(([key, value]) => {
        console.log(`${key}: ${value}`);
      });

      if (!result.isValid) {
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("Validation script failed:", error);
      process.exit(1);
    });
}