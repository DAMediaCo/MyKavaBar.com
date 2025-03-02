// Simple script to test Neon database connectivity
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

async function testDatabaseConnection() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Please set it in .env file or as environment variable.");
    return;
  }

  try {
    console.log("Creating connection to Neon...");
    const sql = neon(process.env.DATABASE_URL);
    
    console.log("Querying kava_bars table...");
    const result = await sql`SELECT COUNT(*) FROM kava_bars`;
    console.log("Query successful!");
    console.log("Number of kava bars in database:", result[0].count);
    
    console.log("Fetching first 5 kava bars...");
    const bars = await sql`SELECT id, name, address FROM kava_bars LIMIT 5`;
    console.log("Bars found:", bars);
    
  } catch (error) {
    console.error("Error connecting to database:", error);
  }
}

testDatabaseConnection();