
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

async function backupDatabaseFull() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups');
  const backupPath = path.join(backupDir, `full_backup_${timestamp}.sql`);

  // Ensure backup directory exists
  await fs.mkdir(backupDir, { recursive: true });

  try {
    console.log('Starting full database backup...');
    await execAsync(`pg_dump "${process.env.DATABASE_URL}" > "${backupPath}"`);
    console.log(`Backup completed successfully: ${backupPath}`);
  } catch (error) {
    console.error('Backup failed:', error);
    throw error;
  }
}

if (require.main === module) {
  backupDatabaseFull()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Backup script failed:', error);
      process.exit(1);
    });
}
