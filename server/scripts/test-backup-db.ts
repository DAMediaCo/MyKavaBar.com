import { db } from '@db';
import { kavaBars } from '@db/schema';
import { backupDatabase } from '../utils/backup-database';

async function testBackupDatabase() {
  console.log("Testing backup database functionality");
  
  try {
    console.log("Database connection status:", db ? "Connected" : "Not connected");
    
    // First, count kava bars
    const count = await db.select().from(kavaBars).count();
    console.log("Current kava bar count:", count);
    
    // Now try to create a backup
    console.log("Creating backup...");
    const result = await backupDatabase("test");
    console.log("Backup result:", result);
    
    console.log("Test completed successfully");
  } catch (error) {
    console.error("Test failed:", error);
  }
}

// Run the test
testBackupDatabase()
  .then(() => {
    console.log("Test execution completed");
    process.exit(0);
  })
  .catch(error => {
    console.error("Test execution failed:", error);
    process.exit(1);
  });