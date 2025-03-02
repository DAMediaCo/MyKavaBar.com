import { backupDatabase } from './backup-database';
import { validateDatabaseData } from './validate-data';
import { createLogger } from './utils/logger';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger('schedule-backups');

const BACKUP_INTERVAL = 3600000; // 1 hour in milliseconds
const MAX_BACKUPS = 24; // Keep 24 hours worth of backups
const BACKUP_TYPES = ['hourly', 'daily', 'weekly'] as const;

interface BackupConfig {
  interval: number;  // milliseconds
  retain: number;    // number of backups to keep
}

const BACKUP_CONFIGS: Record<typeof BACKUP_TYPES[number], BackupConfig> = {
  hourly: {
    interval: 3600000,    // 1 hour
    retain: 24
  },
  daily: {
    interval: 86400000,   // 24 hours
    retain: 7
  },
  weekly: {
    interval: 604800000,  // 7 days
    retain: 4
  }
};

async function cleanupOldBackups() {
  const backupDir = path.join(process.cwd(), 'backups');

  try {
    const files = await fs.readdir(backupDir);

    // Group files by backup type
    const backupFiles = files
      .filter(f => f.startsWith('kava_bars_') && f.endsWith('.json'))
      .reduce((acc, f) => {
        const type = BACKUP_TYPES.find(t => f.includes(t)) || 'manual';
        if (!acc[type]) acc[type] = [];
        acc[type].push({
          name: f,
          path: path.join(backupDir, f),
          time: new Date(f.replace('kava_bars_', '').replace('.json', '').replace(/-/g, ':'))
        });
        return acc;
      }, {} as Record<string, Array<{name: string; path: string; time: Date}>>);

    // Cleanup each type according to its retention policy
    for (const type of BACKUP_TYPES) {
      const files = backupFiles[type] || [];
      if (files.length > BACKUP_CONFIGS[type].retain) {
        // Sort by date descending
        const sortedFiles = files.sort((a, b) => b.time.getTime() - a.time.getTime());

        // Remove excess files
        for (const file of sortedFiles.slice(BACKUP_CONFIGS[type].retain)) {
          try {
            await fs.unlink(file.path);
            logger.info(`Removed old ${type} backup: ${file.name}`);
          } catch (error) {
            logger.error(`Failed to remove old backup ${file.name}:`, error);
          }
        }
      }
    }
  } catch (error) {
    logger.error('Failed to cleanup old backups:', error);
  }
}

async function scheduleBackups() {
  logger.info('Starting automated backup scheduler...');

  // Schedule different types of backups
  for (const type of BACKUP_TYPES) {
    const config = BACKUP_CONFIGS[type];

    setInterval(async () => {
      try {
        // Validate data before backup
        logger.info(`Running pre-backup validation for ${type} backup...`);
        const validation = await validateDatabaseData();

        if (!validation.isValid) {
          logger.error(`Data validation failed before ${type} backup:`, validation.errors);
        }

        // Perform backup
        logger.info(`Starting scheduled ${type} backup...`);
        const result = await backupDatabase('scheduled');

        if (result.success) {
          logger.info(`${type} backup completed successfully:`, {
            file: result.file,
            count: result.count
          });

          // Cleanup old backups
          await cleanupOldBackups();
        } else {
          logger.error(`${type} backup failed:`, result.error);
        }
      } catch (error) {
        logger.error(`Scheduled ${type} backup failed:`, error);
      }
    }, config.interval);

    logger.info(`Scheduled ${type} backups every ${config.interval / 1000 / 60} minutes`);
  }

  // Perform initial backup
  try {
    logger.info('Performing initial backup...');
    await backupDatabase('scheduled');
    await cleanupOldBackups();
  } catch (error) {
    logger.error('Initial backup failed:', error);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  scheduleBackups()
    .catch((error) => {
      logger.error('Failed to start backup scheduler:', error);
      process.exit(1);
    });
}

export { scheduleBackups, cleanupOldBackups };