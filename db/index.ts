import { drizzle } from "drizzle-orm/neon-http";
import { neon, neonConfig } from "@neondatabase/serverless";
import * as schema from "@db/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure Neon for optimal serverless performance
// These settings are documented in the Neon docs for serverless optimization
neonConfig.fetchConnectionCache = true; // Enable connection pooling
neonConfig.useSecureWebSocket = true;   // Use secure WebSocket connection

// Extract connection details from DATABASE_URL
const databaseUrl = process.env.DATABASE_URL!;
console.log("Configuring database connection with Neon serverless optimizations...");

// Create a connection to Neon Serverless
// We don't pass poolSize or poolIdleTimeout here as they're not supported options
const sql = neon(databaseUrl);

// Log for debugging
console.log("Database connection initialized with serverless optimizations");

// Create the database instance with drizzle
export const db = drizzle(sql, { 
  schema,
  logger: process.env.NODE_ENV === 'development'
});

// Log readiness
console.log("Database ready");
