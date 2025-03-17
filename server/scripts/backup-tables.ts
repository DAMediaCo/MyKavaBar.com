
import { db } from "../../db";
import { sql } from "drizzle-orm";

async function backupTables() {
  try {
    console.log('Starting table backups...');

    // Backup reviews table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS z_backup_reviews AS 
      SELECT * FROM reviews
    `);
    console.log('Reviews table backed up to z_backup_reviews');

    // Backup kava_bar_photos table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS z_backup_kava_bar_photos AS 
      SELECT * FROM kava_bar_photos
    `);
    console.log('Photos table backed up to z_backup_kava_bar_photos');

    console.log('Backup completed successfully');
  } catch (error) {
    console.error('Backup failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === import.meta.resolve(process.argv[1])) {
  backupTables()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Backup script failed:', error);
      process.exit(1);
    });
}
