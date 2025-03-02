import { db } from "@db";
import { kavaBars } from "@db/schema";
import { sql } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import { createLogger } from './utils/logger';

const logger = createLogger('backup-database');

// Configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds

interface BackupMetadata {
  timestamp: string;
  totalCount: number;
  backupType: 'scheduled' | 'manual' | 'pre-operation';
  databaseVersion?: string;
  tables: string[];
}

async function createBackupMetadata(type: 'scheduled' | 'manual' | 'pre-operation'): Promise<BackupMetadata> {
  const timestamp = new Date().toISOString();
  const tablesResult = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
  `);

  const tables = tablesResult.rows.map((row: any) => row.table_name);
  const totalCount = (await db.select({ count: sql<number>`count(*)` }).from(kavaBars)).length;

  return {
    timestamp,
    totalCount,
    backupType: type,
    tables,
    databaseVersion: process.env.DATABASE_VERSION
  };
}

async function backupDatabase(type: 'scheduled' | 'manual' | 'pre-operation' = 'manual', retryCount = 0): Promise<{ success: boolean; file?: string; count?: number; error?: string }> {
  try {
    logger.info(`Starting database backup (type: ${type})`);

    // Create backups directory if it doesn't exist
    const backupDir = path.join(process.cwd(), 'backups');
    await fs.mkdir(backupDir, { recursive: true });

    // Generate backup filename with timestamp and type
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `kava_bars_${type}_${timestamp}.json`);

    // Start a transaction for consistent backup
    const result = await db.transaction(async (tx) => {
      // Get metadata first
      const metadata = await createBackupMetadata(type);

      // Fetch all kava bars within the transaction
      const bars = await tx.query.kavaBars.findMany({
        orderBy: (kavaBars, { asc }) => [asc(kavaBars.id)]
      });

      // Prepare backup data
      const backupData = {
        metadata,
        bars,
      };

      // Write to file
      await fs.writeFile(
        backupFile,
        JSON.stringify(backupData, null, 2)
      );

      return {
        success: true,
        file: backupFile,
        count: bars.length
      };
    });

    logger.info(`✓ Backup completed: ${result.file}`);
    logger.info(`Total bars backed up: ${result.count}`);

    return result;
  } catch (error: any) {
    logger.error(`Backup failed: ${error.message}`);

    // Implement retry logic
    if (retryCount < MAX_RETRIES) {
      logger.info(`Retrying backup (attempt ${retryCount + 1} of ${MAX_RETRIES})...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return backupDatabase(type, retryCount + 1);
    }

    return {
      success: false,
      error: error.message
    };
  }
}

async function validateBackup(backupFile: string): Promise<boolean> {
  try {
    const data = JSON.parse(await fs.readFile(backupFile, 'utf8'));

    // Validate structure
    if (!data.metadata || !data.bars || !Array.isArray(data.bars)) {
      logger.error('Invalid backup file structure');
      return false;
    }

    // Compare counts
    const currentCount = (await db.select({ count: sql<number>`count(*)` }).from(kavaBars)).length;
    const backupCount = data.bars.length;

    if (Math.abs(currentCount - backupCount) > currentCount * 0.1) { // Allow 10% difference
      logger.warn(`Significant count difference - Current: ${currentCount}, Backup: ${backupCount}`);
    }

    return true;
  } catch (error: any) {
    logger.error(`Backup validation failed: ${error.message}`);
    return false;
  }
}

// Function to restore from a backup
async function restoreFromBackup(backupFile: string): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    logger.info(`Restoring from backup: ${backupFile}`);

    // Validate backup before restoration
    if (!await validateBackup(backupFile)) {
      throw new Error('Backup validation failed');
    }

    // Read and parse backup file
    const backupData = JSON.parse(
      await fs.readFile(backupFile, 'utf8')
    );

    // Start a transaction for the restore
    const result = await db.transaction(async (tx) => {
      let restoredCount = 0;

      for (const bar of backupData.bars) {
        const existing = await tx
          .select()
          .from(kavaBars)
          .where(sql`place_id = ${bar.placeId}`)
          .limit(1);

        if (existing.length === 0) {
          await tx.insert(kavaBars).values(bar);
          restoredCount++;
        }
      }

      return { success: true, count: restoredCount };
    });

    logger.info(`✓ Restore completed. Processed ${backupData.bars.length} entries`);
    return result;
  } catch (error: any) {
    logger.error(`Restore failed: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

// List available backups with metadata
async function listBackups(): Promise<Array<{ file: string; metadata?: BackupMetadata }>> {
  const backupDir = path.join(process.cwd(), 'backups');
  try {
    const files = await fs.readdir(backupDir);
    const backups = await Promise.all(
      files
        .filter(f => f.startsWith('kava_bars_') && f.endsWith('.json'))
        .map(async f => {
          try {
            const filePath = path.join(backupDir, f);
            const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
            return {
              file: f,
              metadata: data.metadata || {
                timestamp: data.timestamp || new Date(f.replace('kava_bars_', '').replace('.json', '').replace(/-/g, ':')).toISOString(),
                totalCount: data.totalCount || data.bars?.length || 0,
                backupType: 'manual',
                tables: ['kava_bars']
              }
            };
          } catch (error) {
            logger.warn(`Failed to parse backup file ${f}:`, error);
            // Return basic info for corrupted/old backups
            return {
              file: f,
              metadata: {
                timestamp: new Date(f.replace('kava_bars_', '').replace('.json', '').replace(/-/g, ':')).toISOString(),
                totalCount: 0,
                backupType: 'unknown',
                tables: ['unknown']
              }
            };
          }
        })
    );
    return backups;
  } catch (error) {
    logger.error('Failed to list backups:', error);
    return [];
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  const backupFile = process.argv[3];

  if (command === 'backup') {
    backupDatabase('manual')
      .then((result) => {
        if (!result.success) process.exit(1);
      });
  } else if (command === 'restore' && backupFile) {
    restoreFromBackup(backupFile)
      .then((result) => {
        if (!result.success) process.exit(1);
      });
  } else if (command === 'list') {
    listBackups()
      .then((backups) => {
        console.log('\nAvailable backups:');
        backups.forEach(b => {
          console.log(`- ${b.file}`);
          if (b.metadata) {
            console.log(`  Type: ${b.metadata.backupType}`);
            console.log(`  Date: ${b.metadata.timestamp}`);
            console.log(`  Count: ${b.metadata.totalCount}`);
          }
        });
      });
  } else {
    console.log('\nUsage:');
    console.log('  backup  : Create new backup');
    console.log('  restore : Restore from backup file');
    console.log('  list   : List available backups\n');
    process.exit(1);
  }
}

export { backupDatabase, restoreFromBackup, listBackups, validateBackup };